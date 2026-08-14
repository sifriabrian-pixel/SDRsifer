// Importa prospectos de franquicias (RE/MAX y C21) desde el CSV exportado
// Uso: node scripts/import-franquicias.js
// El CSV debe estar en C:\Users\sifri\Downloads\Franquicias_Emails_SDR.xlsx - Emails Franquicias.csv

import 'dotenv/config';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { initDb, getDb } from '../src/db.js';

const CSV_PATH = process.argv[2] || (process.env.DB_PATH?.startsWith('/data')
  ? '/app/data/franquicias_emails.csv'
  : String.raw`C:\Users\sifri\Downloads\Franquicias_Emails_SDR.xlsx - Emails Franquicias.csv`);

const PAISES_VALIDOS = new Set(['Argentina', 'México', 'Mexico', 'Ecuador', 'Paraguay']);
const EMAILS_INVALIDOS = ['nombre@ejemplo.com', 'example@example.com', 'test@test.com'];

// Detecta si una línea es encabezado de sección (país o ciudad) y no datos reales
function esFilaHeader(cols) {
  const pais = (cols[6] || '').trim();
  return !PAISES_VALIDOS.has(pais);
}

function limpiarEmail(email) {
  return (email || '').trim().toLowerCase();
}

async function main() {
  initDb();
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO prospects (agency_name, gatekeeper_phone, gatekeeper_email, city, country, franquicia, stage)
    VALUES (@agency_name, @gatekeeper_phone, @gatekeeper_email, @city, @country, @franquicia, 'EMAIL_ONLY')
    ON CONFLICT DO NOTHING
  `);

  const updateEmail = db.prepare(`
    UPDATE prospects
    SET gatekeeper_email = @email, franquicia = @franquicia
    WHERE agency_name = @agency_name AND city = @city
      AND (gatekeeper_email IS NULL OR gatekeeper_email = '')
  `);

  const existeEmail = db.prepare(`
    SELECT id FROM prospects WHERE gatekeeper_email = ? LIMIT 1
  `);

  let insertados = 0;
  let duplicados = 0;
  let saltados = 0;

  const lines = [];

  await new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(CSV_PATH, { encoding: 'utf8' }) });
    rl.on('line', (line) => lines.push(line));
    rl.on('close', resolve);
  });

  // Parsear CSV manualmente (puede tener comas en campos)
  const importMany = db.transaction(() => {
    for (const line of lines) {
      // Parsear campos respetando comillas
      const cols = [];
      let current = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { cols.push(current); current = ''; continue; }
        current += ch;
      }
      cols.push(current);

      if (cols.length < 7) continue;
      if (esFilaHeader(cols)) continue;

      const oficina   = (cols[0] || '').trim();
      const franquicia= (cols[1] || '').trim();
      const email     = limpiarEmail(cols[2]);
      const telefono  = (cols[3] || '').trim();
      const ciudad    = (cols[5] || '').trim();
      const pais      = (cols[6] || '').trim();

      // Filtros de calidad
      if (!oficina || !email) { saltados++; continue; }
      if (!email.includes('@')) { saltados++; continue; }
      if (EMAILS_INVALIDOS.includes(email)) { saltados++; continue; }
      if (!franquicia || !['RE/MAX', 'Century 21'].includes(franquicia)) { saltados++; continue; }

      // Verificar si ya existe ese email
      const existe = existeEmail.get(email);
      if (existe) { duplicados++; continue; }

      upsert.run({
        agency_name: oficina,
        gatekeeper_phone: telefono || 'sin-telefono',
        gatekeeper_email: email,
        city: ciudad,
        country: pais,
        franquicia: franquicia,
      });
      insertados++;
      console.log(`[+] ${franquicia} | ${oficina} (${ciudad}) → ${email}`);
    }
  });

  importMany();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 RESUMEN DE IMPORTACIÓN`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   Insertados: ${insertados}`);
  console.log(`   Duplicados (ya existían): ${duplicados}`);
  console.log(`   Saltados (sin email/inválidos): ${saltados}`);
  console.log(`\n✅ Listo — corrés el agente y arranca la secuencia automáticamente`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
