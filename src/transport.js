// Selector de transporte: Baileys (default) o Kapso (API Oficial), según TRANSPORT en .env
// El resto del código (router, stateMachine, launch) importa de acá en vez de whatsapp.js/kapso.js directo.

import { FASE1_INICIAL } from '../data/sequences.js';

const isKapso = process.env.TRANSPORT === 'kapso';
const impl = isKapso ? await import('./kapso.js') : await import('./whatsapp.js');

export const sendMessage = impl.sendMessage;
export const resolveJid = impl.resolveJid;
export const chatExists = impl.chatExists;
export const getSock = impl.getSock;

// El primer mensaje (frío, sin conversación previa) tiene que ser un template aprobado
// cuando se usa la API Oficial. Con Baileys sigue siendo el texto libre de siempre.
export async function sendFase1(jid) {
  if (isKapso) {
    return impl.sendTemplateMessage(jid, process.env.KAPSO_TEMPLATE_NAME || 'sdr_apertura_v1');
  }
  return impl.sendMessage(jid, FASE1_INICIAL);
}

// El follow-up de 24hs también se manda fuera de la ventana de conversación,
// así que con la API Oficial también necesita template propio (todavía no está cargado en Kapso).
export async function sendFollowup(jid, freeText) {
  if (isKapso) {
    const templateName = process.env.KAPSO_FOLLOWUP_TEMPLATE_NAME;
    if (!templateName) {
      console.log('[KAPSO] Follow-up sin template aprobado configurado (KAPSO_FOLLOWUP_TEMPLATE_NAME) — no se envía.');
      return null;
    }
    return impl.sendTemplateMessage(jid, templateName);
  }
  return impl.sendMessage(jid, freeText);
}
