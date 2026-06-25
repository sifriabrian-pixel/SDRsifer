// Importa/actualiza emails sin duplicar prospectos ya existentes (por teléfono)
// Uso: node scripts/import-emails-railway.js <archivo.csv>

import 'dotenv/config';
import { initDb, getDb } from '../src/db.js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/import-emails-railway.js <archivo.csv>');
  process.exit(1);
}

initDb();
const db = getDb();

const content = readFileSync(file, 'utf8');
const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });

let updated = 0;
let inserted = 0;

const findStmt = db.prepare(`SELECT id FROM prospects WHERE gatekeeper_phone = ?`);
const updateStmt = db.prepare(`UPDATE prospects SET gatekeeper_email = ? WHERE gatekeeper_phone = ? AND (gatekeeper_email IS NULL OR gatekeeper_email = '')`);
const insertStmt = db.prepare(`
  INSERT INTO prospects (agency_name, gatekeeper_phone, gatekeeper_email, city, country)
  VALUES (?, ?, ?, ?, ?)
`);

for (const row of rows) {
  const phone = (row.phone || '').replace(/\D/g, '');
  const email = (row.email || '').trim();
  if (!phone || !email) continue;

  const existing = findStmt.get(phone);
  if (existing) {
    const result = updateStmt.run(email, phone);
    if (result.changes > 0) updated++;
  } else {
    insertStmt.run(row.agency_name, phone, email, row.city || '', row.country || '');
    inserted++;
  }
}

console.log(`✅ Actualizados: ${updated} | Insertados nuevos: ${inserted}`);
