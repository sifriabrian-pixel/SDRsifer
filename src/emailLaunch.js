import { getPendingEmailProspects, updateProspect } from './db.js';
import { sendEmail } from './email.js';
import { enqueueEmail } from './emailScheduler.js';
import { EMAIL_TOQUE_1 } from '../data/emailSequences.js';

export async function runEmailLaunchBatch(limit) {
  console.log(`\n📧 Enviando Email 1 (Día 1) a ${limit} prospectos nuevos...\n`);

  let enviados = 0;
  const batch = getPendingEmailProspects(limit);

  for (const prospect of batch) {
    const pais = prospect.country || '[país]';
    const { subject, text } = EMAIL_TOQUE_1(pais, prospect.dm_name);

    try {
      const info = await enqueueEmail(() => sendEmail({ to: prospect.gatekeeper_email, subject, text }));
      const now = new Date().toISOString();
      await updateProspect(prospect.id, {
        email_stage: 'TOQUE_1_SENT',
        email_first_sent_at: now,
        email_last_message_at: now,
        email_subject: subject,
        email_message_id: info.messageId || null,
      });
      console.log(`[EMAIL-SENT] ${prospect.agency_name} → ${prospect.gatekeeper_email}`);
      enviados++;
    } catch (err) {
      console.error(`[EMAIL-SEND-ERROR] ${prospect.agency_name} — ${err.message}`);
    }
  }

  console.log(`\n✅ Lote de email completado — ${enviados} enviados\n`);
  return { enviados };
}
