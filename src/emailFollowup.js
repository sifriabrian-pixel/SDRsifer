import {
  getEmailDueForToque2,
  getEmailDueForToque3,
  getEmailDueForToque4,
  getEmailDueForNoReply,
  updateProspect,
} from './db.js';
import { sendEmail } from './email.js';
import { enqueueEmail } from './emailScheduler.js';
import { EMAIL_TOQUE_2, EMAIL_TOQUE_3, EMAIL_TOQUE_4 } from '../data/emailSequences.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // cada 30 minutos

async function sendToque(prospect, stageAfter, buildFn, isReply) {
  const pais = prospect.country || '[país]';
  const built = buildFn(pais, prospect.dm_name);
  const subject = isReply ? `${built.subjectPrefix}${prospect.email_subject}` : built.subject;

  try {
    const info = await enqueueEmail(() =>
      sendEmail({ to: prospect.gatekeeper_email, subject, text: built.text, inReplyTo: isReply ? prospect.email_message_id : null })
    );
    await updateProspect(prospect.id, {
      email_stage: stageAfter,
      email_last_message_at: new Date().toISOString(),
      email_message_id: info.messageId || prospect.email_message_id,
    });
    console.log(`[EMAIL-TOQUE] ${prospect.agency_name} → ${stageAfter}`);
  } catch (err) {
    console.error(`[EMAIL-TOQUE ERROR] ${prospect.agency_name} — ${err.message}`);
  }
}

async function runEmailSequenceCheck() {
  for (const prospect of getEmailDueForToque2()) {
    await sendToque(prospect, 'TOQUE_2_SENT', EMAIL_TOQUE_2, true);
  }
  for (const prospect of getEmailDueForToque3()) {
    await sendToque(prospect, 'TOQUE_3_SENT', EMAIL_TOQUE_3, false);
  }
  for (const prospect of getEmailDueForToque4()) {
    await sendToque(prospect, 'TOQUE_4_SENT', EMAIL_TOQUE_4, false);
  }
  for (const prospect of getEmailDueForNoReply()) {
    await updateProspect(prospect.id, { email_stage: 'NO_REPLY' });
    console.log(`[EMAIL-NO_REPLY] ${prospect.agency_name} — secuencia completa sin respuesta`);
  }
}

export function startEmailFollowupScheduler() {
  setTimeout(async () => {
    await runEmailSequenceCheck();
    setInterval(runEmailSequenceCheck, CHECK_INTERVAL_MS);
  }, 5 * 60 * 1000);

  console.log('📧⏰ Email sequence scheduler activo — revisa cada 30 minutos (toques día 3/10/17)');
}
