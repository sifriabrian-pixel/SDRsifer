import { updateProspect } from './db.js';
import { sendEmail } from './email.js';
import { enqueueEmail } from './emailScheduler.js';
import { sendHandoff } from './notifier.js';
import {
  classifyGatekeeperReply,
  classifyDmFirstResponse,
  classifyDmReply,
} from './claude.js';
import {
  EMAIL_OBJECIONES,
  EMAIL_DM_APERTURA,
  EMAIL_DM_PITCH,
  EMAIL_DM_OBJECIONES,
} from '../data/emailSequences.js';

function appendNote(existing, note) {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${existing || ''}\n[${ts}] ${note}`.trim();
}

async function sendReply(to, subject, text, inReplyTo) {
  return enqueueEmail(() => sendEmail({ to, subject: `Re: ${subject}`, text, inReplyTo }));
}

export async function handleEmailMessage(prospect, incomingText, fromEmail, subject, messageId) {
  const { email_stage: stage, country, dm_name, notes } = prospect;
  const pais = country || '[país]';
  const refSubject = prospect.email_subject || subject;

  // ─── FASE1_SENT: respuesta al primer email ──────────────────────────────
  if (stage === 'FASE1_SENT') {
    const result = await classifyGatekeeperReply(incomingText);

    if (result.action === 'GAVE_CONTACT' && result.dm_phone) {
      // Si dieron teléfono por email, lo guardamos pero seguimos esperando el email del DM si lo dieron
    }

    if (result.action === 'QUIERE_INFO') {
      await sendReply(fromEmail, refSubject, EMAIL_OBJECIONES.que_se_trata(pais), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'FASE2_PORTERO',
        email_last_message_at: new Date().toISOString(),
        email_last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'MANDAME_INFO') {
      await sendReply(fromEmail, refSubject, EMAIL_OBJECIONES.mandame_info(pais), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'FASE2_PORTERO',
        email_last_message_at: new Date().toISOString(),
        email_last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'PIDE_WEB') {
      await sendReply(fromEmail, refSubject, EMAIL_OBJECIONES.piden_web(), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'FASE2_PORTERO',
        email_last_message_at: new Date().toISOString(),
        email_last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'YA_TIENEN') {
      await sendReply(fromEmail, refSubject, EMAIL_OBJECIONES.ya_tienen(), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'FASE2_YA_TIENEN',
        email_last_message_at: new Date().toISOString(),
        email_last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'NO_CONTACTO') {
      await sendReply(fromEmail, refSubject, EMAIL_OBJECIONES.no_contacto(), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'FASE2_PORTERO',
        email_last_message_at: new Date().toISOString(),
        email_last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'REJECTED') {
      await updateProspect(prospect.id, {
        email_stage: 'DISCARDED',
        notes: appendNote(notes, `Email: rechazo explícito`),
      });
      console.log(`[EMAIL-DISCARDED] ${prospect.agency_name}`);
      return;
    }

    // Dieron contacto del DM por email — enviar 1A al email del DM si vino, o seguir mismo hilo
    if (result.action === 'GAVE_CONTACT') {
      const dmEmail = fromEmail; // si derivan, asumimos que el DM va a responder por este mismo hilo o nos da otro email en el texto
      const dmEmailMatch = incomingText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const targetEmail = dmEmailMatch ? dmEmailMatch[0] : dmEmail;

      const { subject: dmSubject, text: dmText } = EMAIL_DM_APERTURA(result.dm_name, pais);
      await enqueueEmail(() => sendEmail({ to: targetEmail, subject: dmSubject, text: dmText }));
      await updateProspect(prospect.id, {
        email_stage: 'FASE3_BIFURCACION',
        dm_email: targetEmail,
        dm_name: result.dm_name || dm_name,
        email_last_message_at: new Date().toISOString(),
        email_last_reply_at: new Date().toISOString(),
        email_subject: dmSubject,
        notes: appendNote(notes, `Email: portero dio contacto del DM (${targetEmail})`),
      });
      return;
    }

    // UNKNOWN — fallback genérico
    await sendReply(fromEmail, refSubject, EMAIL_OBJECIONES.quienes_son(pais), messageId);
    await updateProspect(prospect.id, {
      email_stage: 'FASE2_PORTERO',
      email_last_message_at: new Date().toISOString(),
    });
    return;
  }

  // ─── FASE2_PORTERO / FASE2_YA_TIENEN: siguiente respuesta del portero ───
  if (stage === 'FASE2_PORTERO' || stage === 'FASE2_YA_TIENEN') {
    const result = await classifyGatekeeperReply(incomingText);

    if (result.action === 'GAVE_CONTACT') {
      const dmEmailMatch = incomingText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const targetEmail = dmEmailMatch ? dmEmailMatch[0] : fromEmail;

      const { subject: dmSubject, text: dmText } = EMAIL_DM_APERTURA(result.dm_name, pais);
      await enqueueEmail(() => sendEmail({ to: targetEmail, subject: dmSubject, text: dmText }));
      await updateProspect(prospect.id, {
        email_stage: 'FASE3_BIFURCACION',
        dm_email: targetEmail,
        dm_name: result.dm_name || dm_name,
        email_last_message_at: new Date().toISOString(),
        email_last_reply_at: new Date().toISOString(),
        email_subject: dmSubject,
        notes: appendNote(notes, `Email: dio contacto del DM (${targetEmail})`),
      });
      return;
    }

    if (result.action === 'REJECTED' || (stage === 'FASE2_YA_TIENEN')) {
      await updateProspect(prospect.id, {
        email_stage: 'DISCARDED',
        notes: appendNote(notes, `Email: cierre — ${result.action}`),
      });
      console.log(`[EMAIL-DISCARDED] ${prospect.agency_name}`);
      return;
    }

    // Cualquier otra respuesta → fallback genérico, mantener en FASE2_PORTERO
    await sendReply(fromEmail, refSubject, EMAIL_OBJECIONES.quienes_son(pais), messageId);
    await updateProspect(prospect.id, {
      email_stage: 'FASE2_PORTERO',
      email_last_message_at: new Date().toISOString(),
      email_last_reply_at: new Date().toISOString(),
    });
    return;
  }

  // ─── FASE3_BIFURCACION: primera respuesta del DM ─────────────────────────
  if (stage === 'FASE3_BIFURCACION') {
    const result = await classifyDmFirstResponse(incomingText);
    await updateProspect(prospect.id, {
      email_last_reply_at: new Date().toISOString(),
      notes: appendNote(notes, `Email DM respondió: ${result.action}`),
    });

    if (result.action === 'REJECTED') {
      await sendReply(fromEmail, refSubject, EMAIL_DM_OBJECIONES.no_interesa(), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'DISCARDED',
        notes: appendNote(notes, `Email: DM rechazó`),
      });
      console.log(`[EMAIL-DISCARDED] ${prospect.agency_name} — DM rechazó`);
      return;
    }

    if (result.action === 'ASK_NUMBER') {
      await sendReply(fromEmail, refSubject, EMAIL_DM_OBJECIONES.como_conseguiste_numero(), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'FASE3_OBJECION',
        email_last_message_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'MANDAME_INFO') {
      await sendReply(fromEmail, refSubject, EMAIL_DM_OBJECIONES.mandame_info(), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'FASE3_OBJECION',
        email_last_message_at: new Date().toISOString(),
      });
      return;
    }

    // HANDOFF — cualquier otra respuesta (interés, pregunta, neutra)
    await sendReply(fromEmail, refSubject, EMAIL_DM_PITCH(pais), messageId);
    await updateProspect(prospect.id, {
      email_stage: 'HANDED_OFF',
      notes: appendNote(notes, `Email HANDOFF — pitch enviado — Brian toma la conversación`),
    });
    await sendHandoff({ ...prospect, stage: 'HANDED_OFF', channel: 'email' });
    console.log(`[EMAIL-HANDOFF] ${prospect.agency_name}`);
    return;
  }

  // ─── FASE3_OBJECION: seguimiento del DM ──────────────────────────────────
  if (stage === 'FASE3_OBJECION') {
    const context = prospect.notes || '';
    const result = await classifyDmReply(incomingText, context);
    await updateProspect(prospect.id, {
      email_last_reply_at: new Date().toISOString(),
      notes: appendNote(notes, `Email DM seguimiento: "${incomingText.slice(0, 80)}"`),
    });

    if (result.action === 'REJECTED') {
      await sendReply(fromEmail, refSubject, EMAIL_DM_OBJECIONES.no_interesa(), messageId);
      await updateProspect(prospect.id, {
        email_stage: 'DISCARDED',
        notes: appendNote(notes, `Email: DM rechazó en seguimiento`),
      });
      console.log(`[EMAIL-DISCARDED] ${prospect.agency_name}`);
      return;
    }

    if (result.action === 'MANDAME_INFO') {
      await sendReply(fromEmail, refSubject, EMAIL_DM_OBJECIONES.mandame_info(), messageId);
      await updateProspect(prospect.id, { email_last_message_at: new Date().toISOString() });
      return;
    }

    // HANDOFF
    await updateProspect(prospect.id, {
      email_stage: 'HANDED_OFF',
      notes: appendNote(notes, `Email HANDOFF en seguimiento — Brian toma la conversación`),
    });
    await sendHandoff({ ...prospect, stage: 'HANDED_OFF', channel: 'email' });
    console.log(`[EMAIL-HANDOFF] ${prospect.agency_name} — seguimiento`);
    return;
  }
}
