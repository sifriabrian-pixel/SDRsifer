import 'dotenv/config';
import { initDb, updateProspect } from './src/db.js';
import { importCsv } from './data/prospects.js';
import { startFollowupScheduler } from './src/followup.js';
import { runLaunchBatch } from './src/launch.js';
import { startLaunchRequestWatcher } from './src/launchRequest.js';
import { startEmailListener } from './src/email.js';
import { handleIncomingEmail } from './src/emailRouter.js';
import { startEmailFollowupScheduler } from './src/emailFollowup.js';
import { startEmailAutoSender } from './src/emailAutoSender.js';
import path from 'path';

const TRANSPORT = process.env.TRANSPORT === 'kapso' ? 'kapso' : 'baileys';

async function startTransport() {
  if (TRANSPORT === 'kapso') {
    const { startKapsoServer } = await import('./src/kapsoWebhookServer.js');
    startKapsoServer();
    return;
  }
  const { startWhatsApp } = await import('./src/whatsapp.js');
  await startWhatsApp();
}

function startEmailChannel() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('📧 Canal de email desactivado (faltan EMAIL_USER / EMAIL_PASSWORD)');
    return;
  }
  startEmailListener(handleIncomingEmail).catch((err) => {
    console.error('[EMAIL] Error al conectar IMAP:', err.message);
  });
  startEmailFollowupScheduler();
  startEmailAutoSender();
}

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

  // ── Comando: lanzar lote (uso local, sin Railway corriendo en paralelo) ──
  if (args[0] === 'launch') {
    const limit = parseInt(args[1]) || 50;
    await startTransport();
    await runLaunchBatch(limit);
    console.log('Agente activo — escuchando respuestas entrantes.\n');
    startFollowupScheduler();
    startLaunchRequestWatcher();
    startEmailChannel();
    // No hay return — el proceso queda vivo escuchando respuestas
  }

  // ── Comando: migrar LIDs de prospectos viejos (solo Baileys) ────────────
  if (args[0] === 'fix-lids') {
    const { startWhatsApp, resolveJid } = await import('./src/whatsapp.js');
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

  // ── Modo normal: escuchar respuestas + esperar pedidos de lanzamiento ────
  if (TRANSPORT === 'kapso' || process.env.AGENT_PHONE) {
    try {
      await startTransport();
      console.log(`Agente activo (${TRANSPORT}) — escuchando respuestas entrantes.`);
      startFollowupScheduler();
      startLaunchRequestWatcher();
    } catch (err) {
      console.error('[TRANSPORT] No se pudo conectar:', err.message);
      console.log('⚠️  Continuando sin WhatsApp — solo canal de email activo.');
    }
  } else {
    console.log('📵 WhatsApp desactivado (AGENT_PHONE no configurado)');
  }
  startEmailChannel();
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
