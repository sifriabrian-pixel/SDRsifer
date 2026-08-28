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
// Usamos el estado ya guardado en la DB: si el prospecto no está en PENDING, ya le escribimos antes.
export function chatExists(jid) {
  try {
    const db = getDb();
    const row = db.prepare(
      `SELECT 1 FROM prospects WHERE (gatekeeper_jid = ? OR dm_jid = ?) AND stage != 'PENDING' LIMIT 1`
    ).get(jid, jid);
    return !!row;
  } catch {
    return false;
  }
}

export function getSock() {
  return null; // no aplica con la API oficial
}
