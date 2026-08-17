// Envío manual del Toque 1 — saltea la ventana horaria
// Uso: node scripts/force-send-toque1.js [limite]
// Ejemplo: node scripts/force-send-toque1.js 50

import 'dotenv/config';
import { initDb, getPendingEmailProspects, updateProspect } from '../src/db.js';
import { sendEmail } from '../src/email.js';
import { enqueueEmail } from '../src/emailScheduler.js';
import { EMAIL_TOQUE_1, EMAIL_FRANQUICIA_TOQUE_1 } from '../data/emailSequences.js';

const LIMITE = parseInt(process.argv[2]) || 50;

async function main() {
  initDb();

  const pending = getPendingEmailProspects(LIMITE);
  console.log(`\n📧 Enviando Toque 1 a ${pending.length} prospectos (límite: ${LIMITE})\n`);

  let enviados = 0;
  let errores = 0;

  for (const prospect of pending) {
    try {
      const esFranquicia = prospect.franquicia && prospect.franquicia.trim();
      const { subject, text } = esFranquicia
        ? EMAIL_FRANQUICIA_TOQUE_1(prospect.franquicia, prospect.dm_name, prospect.gatekeeper_email, prospect.agency_name)
        : EMAIL_TOQUE_1(prospect.country, prospect.dm_name);

      const info = await enqueueEmail(() => sendEmail({ to: prospect.gatekeeper_email, subject, text }));
      const now = new Date().toISOString();
      updateProspect(prospect.id, {
        email_stage: 'TOQUE_1_SENT',
        email_first_sent_at: now,
        email_last_message_at: now,
        email_subject: subject,
        email_message_id: info.messageId || null,
      });
      enviados++;
      console.log(`[${enviados}] ✓ ${prospect.agency_name} (${prospect.country}) → ${prospect.gatekeeper_email}`);
    } catch (err) {
      errores++;
      console.error(`[ERR] ${prospect.agency_name} → ${prospect.gatekeeper_email}: ${err.message}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 RESUMEN`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   Enviados: ${enviados}`);
  console.log(`   Errores:  ${errores}`);
  console.log(`\n✅ Listo. Los toques 2/3/4 salen automáticamente en los días correspondientes.`);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
