import { getPendingProspects, updateProspect } from './db.js';
import { sendMessage, resolveJid, chatExists } from './whatsapp.js';
import { FASE1_INICIAL } from '../data/sequences.js';

export async function runLaunchBatch(limit) {
  console.log(`\n🚀 Enviando mensajes a ${limit} prospectos nuevos...\n`);

  let enviados = 0;
  let saltados = 0;
  let noWhatsapp = 0;

  while (enviados < limit) {
    const batch = getPendingProspects(20);
    if (batch.length === 0) {
      console.log('No hay más prospectos en estado PENDING.');
      break;
    }

    for (const prospect of batch) {
      if (enviados >= limit) break;

      const resolved = await resolveJid(prospect.gatekeeper_phone);

      if (!resolved) {
        await updateProspect(prospect.id, { stage: 'NO_WHATSAPP' });
        console.log(`[NO WA] ${prospect.agency_name} — número no está en WhatsApp`);
        noWhatsapp++;
        continue;
      }

      const { jid, lid } = resolved;

      if (chatExists(jid) || (lid && chatExists(lid))) {
        await updateProspect(prospect.id, { stage: 'SKIPPED', gatekeeper_jid: jid, gatekeeper_lid: lid });
        console.log(`[SKIP]  ${prospect.agency_name} — ya tiene conversación activa`);
        saltados++;
        continue;
      }

      await updateProspect(prospect.id, {
        stage: 'FASE1_SENT',
        gatekeeper_jid: jid,
        gatekeeper_lid: lid,
        last_message_at: new Date().toISOString(),
      });
      await sendMessage(jid, FASE1_INICIAL);
      console.log(`[SENT]  ${prospect.agency_name} → ${jid}`);
      enviados++;
    }
  }

  console.log(`\n✅ Lote completado — ${enviados} enviados, ${saltados} saltados, ${noWhatsapp} sin WhatsApp\n`);
  return { enviados, saltados, noWhatsapp };
}
