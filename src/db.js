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
      gatekeeper_email TEXT,
      dm_email TEXT,
      email_stage TEXT NOT NULL DEFAULT 'PENDING',
      email_rejection_count INTEGER NOT NULL DEFAULT 0,
      email_last_message_at TEXT,
      email_last_reply_at TEXT,
      email_message_id TEXT,
      email_subject TEXT,
      email_first_sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migración: agregar columnas si la tabla ya existía sin ellas (debe correr ANTES de crear índices que las referencian)
  const existingCols = db.prepare(`PRAGMA table_info(prospects)`).all().map((c) => c.name);
  const migrations = {
    gatekeeper_lid: `ALTER TABLE prospects ADD COLUMN gatekeeper_lid TEXT`,
    dm_lid: `ALTER TABLE prospects ADD COLUMN dm_lid TEXT`,
    gatekeeper_email: `ALTER TABLE prospects ADD COLUMN gatekeeper_email TEXT`,
    dm_email: `ALTER TABLE prospects ADD COLUMN dm_email TEXT`,
    email_stage: `ALTER TABLE prospects ADD COLUMN email_stage TEXT NOT NULL DEFAULT 'PENDING'`,
    email_rejection_count: `ALTER TABLE prospects ADD COLUMN email_rejection_count INTEGER NOT NULL DEFAULT 0`,
    email_last_message_at: `ALTER TABLE prospects ADD COLUMN email_last_message_at TEXT`,
    email_last_reply_at: `ALTER TABLE prospects ADD COLUMN email_last_reply_at TEXT`,
    email_message_id: `ALTER TABLE prospects ADD COLUMN email_message_id TEXT`,
    email_subject: `ALTER TABLE prospects ADD COLUMN email_subject TEXT`,
    email_first_sent_at: `ALTER TABLE prospects ADD COLUMN email_first_sent_at TEXT`,
  };
  for (const [col, sql] of Object.entries(migrations)) {
    if (!existingCols.includes(col)) db.exec(sql);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stage ON prospects(stage);
    CREATE INDEX IF NOT EXISTS idx_gatekeeper_jid ON prospects(gatekeeper_jid);
    CREATE INDEX IF NOT EXISTS idx_dm_jid ON prospects(dm_jid);
    CREATE INDEX IF NOT EXISTS idx_email_stage ON prospects(email_stage);
    CREATE INDEX IF NOT EXISTS idx_gatekeeper_email ON prospects(gatekeeper_email);
    CREATE INDEX IF NOT EXISTS idx_dm_email ON prospects(dm_email);
  `);

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

export function getProspectByEmail(email) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM prospects
    WHERE gatekeeper_email = ? OR dm_email = ?
    LIMIT 1
  `).get(email, email);
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
    INSERT OR IGNORE INTO prospects (agency_name, gatekeeper_phone, gatekeeper_email, city, country)
    VALUES (@agency_name, @gatekeeper_phone, @gatekeeper_email, @city, @country)
  `);
  const insertMany = d.transaction((list) => {
    for (const row of list) stmt.run({ gatekeeper_email: null, ...row });
  });
  insertMany(rows);
}

// Actualiza el email de prospectos ya existentes (por nombre de agencia + teléfono) sin duplicar filas
export function updateEmailsByPhone(rows) {
  const d = getDb();
  const stmt = d.prepare(`
    UPDATE prospects SET gatekeeper_email = @email
    WHERE gatekeeper_phone = @phone AND (gatekeeper_email IS NULL OR gatekeeper_email = '')
  `);
  const updateMany = d.transaction((list) => {
    let count = 0;
    for (const row of list) {
      if (!row.email) continue;
      const result = stmt.run(row);
      if (result.changes > 0) count++;
    }
    return count;
  });
  return updateMany(rows);
}

export function getPendingProspects(limit = 50, offset = 0) {
  return getDb().prepare(`SELECT * FROM prospects WHERE stage = 'PENDING' LIMIT ? OFFSET ?`).all(limit, offset);
}

// Prospectos con email conocido y pipeline de email aún no iniciado
export function getPendingEmailProspects(limit = 50) {
  return getDb().prepare(`
    SELECT * FROM prospects
    WHERE email_stage = 'PENDING' AND gatekeeper_email IS NOT NULL AND gatekeeper_email != ''
    LIMIT ?
  `).all(limit);
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

// Secuencia cold email — 4 toques en días fijos desde el primer envío (1, 3, 10, 17)
// Solo avanza si no hubo respuesta (email_last_reply_at) después del envío anterior

export function getEmailDueForToque2() {
  return getDb().prepare(`
    SELECT * FROM prospects
    WHERE email_stage = 'TOQUE_1_SENT'
    AND email_first_sent_at <= datetime('now', '-3 days')
    AND (email_last_reply_at IS NULL OR email_last_reply_at < email_first_sent_at)
  `).all();
}

export function getEmailDueForToque3() {
  return getDb().prepare(`
    SELECT * FROM prospects
    WHERE email_stage = 'TOQUE_2_SENT'
    AND email_first_sent_at <= datetime('now', '-10 days')
    AND (email_last_reply_at IS NULL OR email_last_reply_at < email_first_sent_at)
  `).all();
}

export function getEmailDueForToque4() {
  return getDb().prepare(`
    SELECT * FROM prospects
    WHERE email_stage = 'TOQUE_3_SENT'
    AND email_first_sent_at <= datetime('now', '-17 days')
    AND (email_last_reply_at IS NULL OR email_last_reply_at < email_first_sent_at)
  `).all();
}

export function getEmailDueForNoReply() {
  return getDb().prepare(`
    SELECT * FROM prospects
    WHERE email_stage = 'TOQUE_4_SENT'
    AND email_first_sent_at <= datetime('now', '-24 days')
    AND (email_last_reply_at IS NULL OR email_last_reply_at < email_first_sent_at)
  `).all();
}
