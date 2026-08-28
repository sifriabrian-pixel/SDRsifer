// Transporte Kapso (API Oficial de Meta) — alternativa a whatsapp.js (Baileys)
// Activar con TRANSPORT=kapso en .env

import { WhatsAppClient, buildTemplateSendPayload } from '@kapso/whatsapp-cloud-api';
import { enqueue } from './scheduler.js';
import { getDb } from './db.js';

const client = new WhatsAppClient({
  baseUrl: 'https://api.kapso.ai/meta/whatsapp',
  kapsoApiKey: process.env.KAPSO_API_KEY,
});

const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;

function phoneFromJid(jid) {
  return jid.split('@')[0];
}

export async function sendMessage(jid, text) {
  const to = phoneFromJid(jid);
  return enqueue(async () => {
    const result = await client.messages.sendText({ phoneNumberId, to, body: text });
    return result;
  });
}

export async function sendTemplateMessage(jid, templateName, language = 'es_AR') {
  const to = phoneFromJid(jid);
  return enqueue(async () => {
    const template = buildTemplateSendPayload({ name: templateName, language });
    const result = await client.messages.sendTemplate({ phoneNumberId, to, template });
    return result;
  });
}

// La API oficial no tiene un chequeo de "¿este número tiene WhatsApp?" como onWhatsApp() de Baileys.
// Se intenta enviar directo; si el número no es válido, Meta devuelve error al enviar (se captura en launch.js).
export async function resolveJid(phone) {
  const clean = phone.replace(/\D/g, '');
  return { jid: `${clean}@s.whatsapp.net`, lid: null };
}

// Ya no existe el concepto de "chats cargados" del socket de Baileys.
// Chequeamos dos cosas: 1) nuestra propia DB (ya le escribimos antes en esta campaña),
// 2) la API de Conversaciones de Kapso (ya existe un chat con ese número, aunque no
//    lo hayamos originado nosotros — evita reabrir con un lead/cliente existente).
export async function chatExists(jid) {
  try {
    const db = getDb();
    const row = db.prepare(
      `SELECT 1 FROM prospects WHERE (gatekeeper_jid = ? OR dm_jid = ?) AND stage != 'PENDING' LIMIT 1`
    ).get(jid, jid);
    if (row) return true;
  } catch {}

  try {
    const to = phoneFromJid(jid);
    const result = await client.conversations.list({ phoneNumberId, phoneNumber: to, limit: 1 });
    return (result?.data?.length || 0) > 0;
  } catch (err) {
    console.error('[KAPSO] Error chequeando conversación existente:', err.message);
    return false; // ante la duda, no bloquear el envío por un error de red/API
  }
}

export function getSock() {
  return null; // no aplica con la API oficial
}
