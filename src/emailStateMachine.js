import { updateProspect } from './db.js';
import { sendEmail } from './email.js';
import { enqueueEmail } from './emailScheduler.js';
import { sendHandoff } from './notifier.js';
import { classifyColdEmailReply } from './claude.js';
import { EMAIL_TOQUE_1, EMAIL_NO_ES_DECISOR } from '../data/emailSequences.js';

function appendNote(existing, note) {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${existing || ''}\n[${ts}] ${note}`.trim();
}

const ACTIVE_STAGES = ['TOQUE_1_SENT', 'TOQUE_2_SENT', 'TOQUE_3_SENT', 'TOQUE_4_SENT', 'AGUARDANDO_REDIRECT'];

export async function handleEmailMessage(prospect, incomingText, fromEmail, subject, messageId) {
  const { email_stage: stage, country, notes } = prospect;
  const pais = country || '[país]';

  if (!ACTIVE_STAGES.includes(stage)) return;

  const result = await classifyColdEmailReply(incomingText);

  await updateProspect(prospect.id, {
    email_last_reply_at: new Date().toISOString(),
    notes: appendNote(notes, `Email respondió (${stage}): "${incomingText.slice(0, 80)}"`),
  });

  if (result.action === 'NOT_DECISION_MAKER') {
    // Si ya nos dieron el contacto del verdadero decisor en el mismo mensaje, redirigir la secuencia
    const emailMatch = incomingText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const redirectEmail = result.redirect_email || (emailMatch ? emailMatch[0] : null);

    if (redirectEmail) {
      const { subject: newSubject, text } = EMAIL_TOQUE_1(pais, result.redirect_name);
      const info = await enqueueEmail(() => sendEmail({ to: redirectEmail, subject: newSubject, text }));
      const now = new Date().toISOString();
      await updateProspect(prospect.id, {
        email_stage: 'TOQUE_1_SENT',
        gatekeeper_email: redirectEmail,
        dm_name: result.redirect_name || prospect.dm_name,
        email_first_sent_at: now,
        email_last_message_at: now,
        email_subject: newSubject,
        email_message_id: info.messageId || null,
        notes: appendNote(notes, `Redirigido a ${redirectEmail} — secuencia reiniciada`),
      });
      console.log(`[EMAIL-REDIRECT] ${prospect.agency_name} → ${redirectEmail}`);
      return;
    }

    // No dieron el contacto todavía — preguntar y esperar
    await enqueueEmail(() =>
      sendEmail({ to: fromEmail, subject: `Re: ${subject}`, text: EMAIL_NO_ES_DECISOR(), inReplyTo: messageId })
    );
    await updateProspect(prospect.id, {
      email_stage: 'AGUARDANDO_REDIRECT',
      email_last_message_at: new Date().toISOString(),
    });
    console.log(`[EMAIL] ${prospect.agency_name} — no es decisor, pidiendo contacto`);
    return;
  }

  // HANDOFF — cualquier otra respuesta
  await updateProspect(prospect.id, {
    email_stage: 'HANDED_OFF',
    notes: appendNote(notes, `Email HANDOFF — respondió a la secuencia — Brian toma la conversación`),
  });
  await sendHandoff({ ...prospect, stage: 'HANDED_OFF', channel: 'email' });
  console.log(`[EMAIL-HANDOFF] ${prospect.agency_name}`);
}
