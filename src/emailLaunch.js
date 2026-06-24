import { getPendingEmailProspects, updateProspect } from './db.js';
import { sendEmail } from './email.js';
import { enqueueEmail } from './emailScheduler.js';
import { EMAIL_FASE1 } from '../data/emailSequences.js';

export async function runEmailLaunchBatch(limit) {
  console.log(`\n📧 Enviando emails a ${limit} prospectos nuevos...\n`);

  let enviados = 0;
  const batch = getPendingEmailProspects(limit);

  for (const prospect of batch) {
    const pais = prospect.country || '[país]';
    const { subject, text } = EMAIL_FASE1(pais);

    try {
      const info = await enqueueEmail(() => sendEmail({ to: prospect.gatekeeper_email, subject, text }));
      await updateProspect(prospect.id, {
        email_stage: 'FASE1_SENT',
        email_last_message_at: new Date().toISOString(),
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
