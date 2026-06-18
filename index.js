import 'dotenv/config';
import { initDb, getPendingProspects, updateProspect } from './src/db.js';
import { startWhatsApp, sendMessage, resolveJid, chatExists } from './src/whatsapp.js';
import { importCsv } from './data/prospects.js';
import { FASE1_INICIAL } from './data/sequences.js';
import { startFollowupScheduler } from './src/followup.js';
import path from 'path';

const args = process.argv.slice(2);

async function main() {
  initDb();

  // ── Comando: importar CSV ────────────────────────────────────────────────
  if (args[0] === 'import') {
    const file = args[1];
    if (!file) {
      console.error('Uso: node index.js import <archivo.csv>');
      process.exit(1);
    }
    await importCsv(path.resolve(file));
    process.exit(0);
  }

  // ── Comando: lanzar lote ─────────────────────────────────────────────────
  if (args[0] === 'launch') {
    const limit = parseInt(args[1]) || 50;
    await startWhatsApp();

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
      // Verificar número real en WhatsApp (resuelve formato correcto)
      const resolved = await resolveJid(prospect.gatekeeper_phone);

      if (!resolved) {
        await updateProspect(prospect.id, { stage: 'NO_WHATSAPP' });
        console.log(`[NO WA] ${prospect.agency_name} — número no está en WhatsApp`);
        noWhatsapp++;
        continue;
      }

      const { jid, lid } = resolved;

      // Si ya hay conversación abierta, saltar
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
    } // end while

    console.log(`\n✅ Lote completado — ${enviados} enviados, ${saltados} saltados, ${noWhatsapp} sin WhatsApp`);
    console.log('Agente activo — escuchando respuestas entrantes.\n');
    startFollowupScheduler();
    // No hay return — el proceso queda vivo escuchando respuestas
  }

  // ── Comando: migrar LIDs de prospectos viejos ───────────────────────────
  if (args[0] === 'fix-lids') {
    await startWhatsApp();
    const { getDb } = await import('./src/db.js');
    const rows = getDb().prepare(`SELECT id, gatekeeper_phone FROM prospects WHERE stage = 'FASE1_SENT' AND gatekeeper_lid IS NULL`).all();
    console.log(`\n🔧 Resolviendo LIDs para ${rows.length} prospectos...\n`);
    for (const row of rows) {
      const resolved = await resolveJid(row.gatekeeper_phone);
      if (resolved?.lid) {
        updateProspect(row.id, { gatekeeper_lid: resolved.lid });
        console.log(`[LID] ${row.gatekeeper_phone} → ${resolved.lid}`);
      }
    }
    console.log('\n✅ LIDs actualizados. Reiniciá con: node index.js\n');
    return;
  }

  // ── Modo normal: solo escuchar respuestas ────────────────────────────────
  await startWhatsApp();
  console.log('Agente activo — escuchando respuestas entrantes.');
  startFollowupScheduler();
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
