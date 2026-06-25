// Envío manual de Email 1 (Toque 1) saltando la ventana horaria — uso puntual/testeo
// Uso: node scripts/manual-send-email.js <cantidad>

import 'dotenv/config';
import { initDb, getPendingEmailProspects, updateProspect } from '../src/db.js';
import { sendEmail, initEmailTransporter } from '../src/email.js';
import { enqueueEmail } from '../src/emailScheduler.js';
import { EMAIL_TOQUE_1 } from '../data/emailSequences.js';

const limit = parseInt(process.argv[2]) || 15;

initDb();
initEmailTransporter();

const prospects = getPendingEmailProspects(limit);
console.log(`\n📧 Enviando Email 1 a ${prospects.length} prospectos (manual, fuera de ventana)...\n`);

let enviados = 0;
for (const prospect of prospects) {
  const { subject, text } = EMAIL_TOQUE_1(prospect.country, prospect.dm_name);
  try {
    const info = await enqueueEmail(() => sendEmail({ to: prospect.gatekeeper_email, subject, text }));
    const now = new Date().toISOString();
    updateProspect(prospect.id, {
      email_stage: 'TOQUE_1_SENT',
      email_first_sent_at: now,
      email_last_message_at: now,
      email_subject: subject,
      email_message_id: info.messageId || null,
    });
    console.log(`[SENT] ${prospect.agency_name} (${prospect.country}) → ${prospect.gatekeeper_email}`);
    enviados++;
  } catch (err) {
    console.error(`[ERROR] ${prospect.agency_name} — ${err.message}`);
  }
}

console.log(`\n✅ Completado — ${enviados} enviados\n`);
process.exit(0);
