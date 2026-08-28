// Equivalente a router.js pero para mensajes entrantes vía webhook de Kapso.
// No hay LIDs en la API Oficial — siempre es el número de teléfono real.

import { getProspectByJid } from './db.js';
import { handleMessage } from './stateMachine.js';

const processing = new Set();

export async function handleIncomingKapso(fromPhone, text) {
  if (!fromPhone || !text) return;

  const fromJid = `${fromPhone.replace(/\D/g, '')}@s.whatsapp.net`;
  const prospect = getProspectByJid(fromJid);

  if (!prospect) {
    console.log(`[UNKNOWN] ${fromJid}: "${text.slice(0, 60)}"`);
    return;
  }

  if (['DISCARDED', 'HANDED_OFF'].includes(prospect.stage)) return;

  if (processing.has(prospect.id)) {
    console.log(`[SKIP-DUP] ${prospect.agency_name} — mensaje ignorado, ya procesando otro`);
    return;
  }

  console.log(`[IN] ${prospect.agency_name} (${prospect.stage}): "${text.slice(0, 60)}"`);

  processing.add(prospect.id);
  try {
    await handleMessage(prospect, text, fromJid);
  } catch (err) {
    console.error(`[ERROR] ${prospect.agency_name} — ${err.message}`);
    console.error(err.stack?.split('\n')[1] || '');
  } finally {
    processing.delete(prospect.id);
  }
}
