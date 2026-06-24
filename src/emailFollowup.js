import { getEmailProspectsNeedingFollowup, getEmailProspectsNoReply, updateProspect } from './db.js';
import { sendEmail } from './email.js';
import { enqueueEmail } from './emailScheduler.js';
import { EMAIL_FOLLOWUP } from '../data/emailSequences.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // cada 30 minutos

async function runEmailFollowupCheck() {
  const needFollowup = getEmailProspectsNeedingFollowup();
  for (const prospect of needFollowup) {
    try {
      const { subject, text } = EMAIL_FOLLOWUP();
      await enqueueEmail(() => sendEmail({ to: prospect.gatekeeper_email, subject, text, inReplyTo: prospect.email_message_id }));
      await updateProspect(prospect.id, {
        email_stage: 'FASE2_FOLLOWUP_SENT',
        email_last_message_at: new Date().toISOString(),
      });
      console.log(`[EMAIL-FOLLOWUP] ${prospect.agency_name} — follow-up enviado`);
    } catch (err) {
      console.error(`[EMAIL-FOLLOWUP ERROR] ${prospect.agency_name} — ${err.message}`);
    }
  }

  const noReply = getEmailProspectsNoReply();
  for (const prospect of noReply) {
    await updateProspect(prospect.id, { email_stage: 'NO_REPLY' });
    console.log(`[EMAIL-NO_REPLY] ${prospect.agency_name} — sin respuesta, contacto cerrado`);
  }
}

export function startEmailFollowupScheduler() {
  setTimeout(async () => {
    await runEmailFollowupCheck();
    setInterval(runEmailFollowupCheck, CHECK_INTERVAL_MS);
  }, 5 * 60 * 1000);

  console.log('📧⏰ Email follow-up scheduler activo — revisa cada 30 minutos');
}
