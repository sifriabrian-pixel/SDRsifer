import 'dotenv/config';
import { initDb, updateProspect } from './src/db.js';
import { startWhatsApp, resolveJid } from './src/whatsapp.js';
import { importCsv } from './data/prospects.js';
import { startFollowupScheduler } from './src/followup.js';
import { runLaunchBatch } from './src/launch.js';
import { startLaunchRequestWatcher } from './src/launchRequest.js';
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

  // ── Comando: lanzar lote (uso local, sin Railway corriendo en paralelo) ──
  if (args[0] === 'launch') {
    const limit = parseInt(args[1]) || 50;
    await startWhatsApp();
    await runLaunchBatch(limit);
    console.log('Agente activo — escuchando respuestas entrantes.\n');
    startFollowupScheduler();
    startLaunchRequestWatcher();
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

  // ── Modo normal: escuchar respuestas + esperar pedidos de lanzamiento ────
  await startWhatsApp();
  console.log('Agente activo — escuchando respuestas entrantes.');
  startFollowupScheduler();
  startLaunchRequestWatcher();
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
