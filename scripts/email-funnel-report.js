// Reporte del funnel de email: cuántos prospectos hay en cada etapa
// Uso: node scripts/email-funnel-report.js

import 'dotenv/config';
import { initDb, getDb } from '../src/db.js';

initDb();
const db = getDb();

const rows = db.prepare(`
  SELECT email_stage, COUNT(*) as cantidad
  FROM prospects
  WHERE gatekeeper_email IS NOT NULL AND gatekeeper_email != ''
  GROUP BY email_stage
  ORDER BY cantidad DESC
`).all();

console.log('\n📊 Funnel de email:\n');
console.table(rows);

const total = rows.reduce((sum, r) => sum + r.cantidad, 0);
const enviados = rows.filter(r => r.email_stage !== 'PENDING').reduce((sum, r) => sum + r.cantidad, 0);
const handoffs = rows.find(r => r.email_stage === 'HANDED_OFF')?.cantidad || 0;
const bounced = rows.find(r => r.email_stage === 'BOUNCED')?.cantidad || 0;

console.log(`Total con email: ${total}`);
console.log(`Ya contactados: ${enviados}`);
console.log(`Handoffs (respondieron): ${handoffs}`);
console.log(`Rebotados: ${bounced}`);
if (enviados > 0) {
  console.log(`Tasa de respuesta: ${((handoffs / enviados) * 100).toFixed(1)}%`);
  console.log(`Tasa de rebote: ${((bounced / enviados) * 100).toFixed(1)}%`);
}
console.log('');
process.exit(0);
