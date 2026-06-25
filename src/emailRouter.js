import { getProspectByEmail, updateProspect } from './db.js';
import { handleEmailMessage } from './emailStateMachine.js';
import { isBounceEmail, extractBouncedAddress } from './bounceDetector.js';

const processing = new Set(); // lock por prospecto, igual que en WhatsApp

function appendNote(existing, note) {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${existing || ''}\n[${ts}] ${note}`.trim();
}

export async function handleIncomingEmail(parsedMail) {
  if (isBounceEmail(parsedMail)) {
    const bouncedEmail = extractBouncedAddress(parsedMail);
    if (!bouncedEmail) {
      console.log('[EMAIL-BOUNCE] No se pudo extraer la dirección rebotada');
      return;
    }
    const prospect = getProspectByEmail(bouncedEmail);
    if (!prospect) {
      console.log(`[EMAIL-BOUNCE] Sin prospecto asociado: ${bouncedEmail}`);
      return;
    }
    await updateProspect(prospect.id, {
      email_stage: 'BOUNCED',
      notes: appendNote(prospect.notes, `Email rebotó (${bouncedEmail}) — dirección inválida`),
    });
    console.log(`[EMAIL-BOUNCE] ${prospect.agency_name} — ${bouncedEmail} rebotó, contacto cerrado`);
    return;
  }

  const fromAddress = parsedMail.from?.value?.[0]?.address?.toLowerCase();
  if (!fromAddress) return;

  const text = (parsedMail.text || '').trim();
  if (!text) return;

  const subject = parsedMail.subject || '';
  const messageId = parsedMail.messageId || null;

  const prospect = getProspectByEmail(fromAddress);

  if (!prospect) {
    console.log(`[EMAIL-UNKNOWN] ${fromAddress}`);
    return;
  }

  if (['DISCARDED', 'HANDED_OFF'].includes(prospect.email_stage)) return;

  if (processing.has(prospect.id)) {
    console.log(`[EMAIL-SKIP-DUP] ${prospect.agency_name} — ya procesando otro mensaje`);
    return;
  }

  console.log(`[EMAIL-IN] ${prospect.agency_name} (${prospect.email_stage}): "${text.slice(0, 60)}"`);

  processing.add(prospect.id);
  try {
    await handleEmailMessage(prospect, text, fromAddress, subject, messageId);
  } catch (err) {
    console.error(`[EMAIL-ERROR] ${prospect.agency_name} — ${err.message}`);
    console.error(err.stack?.split('\n')[1] || '');
  } finally {
    processing.delete(prospect.id);
  }
}
