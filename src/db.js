import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './sifer.db';

let db;

export function initDb() {
  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prospects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_name TEXT NOT NULL,
      gatekeeper_phone TEXT NOT NULL,
      gatekeeper_jid TEXT,
      gatekeeper_lid TEXT,
      dm_name TEXT,
      dm_phone TEXT,
      dm_jid TEXT,
      dm_lid TEXT,
      city TEXT,
      country TEXT,
      stage TEXT NOT NULL DEFAULT 'PENDING',
      step INTEGER NOT NULL DEFAULT 0,
      rejection_count INTEGER NOT NULL DEFAULT 0,
      last_message_at TEXT,
      last_reply_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_stage ON prospects(stage);
    CREATE INDEX IF NOT EXISTS idx_gatekeeper_jid ON prospects(gatekeeper_jid);
    CREATE INDEX IF NOT EXISTS idx_dm_jid ON prospects(dm_jid);
  `);

  // Migración: agregar columnas si la tabla ya existía sin ellas
  const existingCols = db.prepare(`PRAGMA table_info(prospects)`).all().map((c) => c.name);
  if (!existingCols.includes('gatekeeper_lid')) {
    db.exec(`ALTER TABLE prospects ADD COLUMN gatekeeper_lid TEXT`);
  }
  if (!existingCols.includes('dm_lid')) {
    db.exec(`ALTER TABLE prospects ADD COLUMN dm_lid TEXT`);
  }

  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialized — call initDb() first');
  return db;
}

export function getProspectByJid(jid) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM prospects
    WHERE gatekeeper_jid = ? OR dm_jid = ?
       OR gatekeeper_lid = ? OR dm_lid = ?
    LIMIT 1
  `).get(jid, jid, jid, jid);
}

export function updateProspect(id, fields) {
  const d = getDb();
  const entries = Object.entries(fields);
  const set = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  d.prepare(`UPDATE prospects SET ${set} WHERE id = ?`).run(...values, id);
}

export function insertProspects(rows) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT OR IGNORE INTO prospects (agency_name, gatekeeper_phone, city, country)
    VALUES (@agency_name, @gatekeeper_phone, @city, @country)
  `);
  const insertMany = d.transaction((list) => {
    for (const row of list) stmt.run(row);
  });
  insertMany(rows);
}

export function getPendingProspects(limit = 50, offset = 0) {
  return getDb().prepare(`SELECT * FROM prospects WHERE stage = 'PENDING' LIMIT ? OFFSET ?`).all(limit, offset);
}

export function getAllProspects() {
  return getDb().prepare(`SELECT * FROM prospects ORDER BY created_at DESC`).all();
}

// Prospectos en FASE2_PORTERO sin respuesta hace más de 24hs → necesitan follow-up
export function getProspectsNeedingFollowup() {
  return getDb().prepare(`
    SELECT * FROM prospects
    WHERE stage = 'FASE2_PORTERO'
    AND last_message_at < datetime('now', '-24 hours')
    AND (last_reply_at IS NULL OR last_reply_at < last_message_at)
  `).all();
}

// Prospectos con follow-up enviado y sin respuesta hace más de 24hs → cerrar
export function getProspectsNoReply() {
  return getDb().prepare(`
    SELECT * FROM prospects
    WHERE stage = 'FASE2_FOLLOWUP_SENT'
    AND last_message_at < datetime('now', '-24 hours')
    AND (last_reply_at IS NULL OR last_reply_at < last_message_at)
  `).all();
}
