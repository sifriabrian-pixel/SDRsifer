// Importa prospectos de franquicias (RE/MAX y C21) con teléfono para WhatsApp,
// desde el CSV "Franquicias Remax y C21.csv" (Oficina,Franquicia,Ciudad,País,Teléfono,...).
// Uso: node scripts/import-franquicias-whatsapp.js <archivo.csv>

import 'dotenv/config';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { initDb, getDb } from '../src/db.js';

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error('Uso: node scripts/import-franquicias-whatsapp.js <archivo.csv>');
  process.exit(1);
}

const PAISES_VALIDOS = new Set(['Argentina', 'México', 'Mexico', 'Ecuador', 'Paraguay']);

function esFilaValida(cols) {
  const pais = (cols[3] || '').trim();
  return PAISES_VALIDOS.has(pais);
}

async function main() {
  initDb();
  const db = getDb();

  const existeTelefono = db.prepare(`SELECT id FROM prospects WHERE gatekeeper_phone = ? LIMIT 1`);
  const insert = db.prepare(`
    INSERT INTO prospects (agency_name, gatekeeper_phone, city, country, franquicia, stage)
    VALUES (@agency_name, @gatekeeper_phone, @city, @country, @franquicia, 'PENDING')
  `);

  const lines = [];
  await new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(CSV_PATH, { encoding: 'utf8' }) });
    rl.on('line', (line) => lines.push(line));
    rl.on('close', resolve);
  });

  let insertados = 0, duplicados = 0, saltados = 0;

  const importMany = db.transaction(() => {
    for (const line of lines) {
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

      if (cols.length < 5) continue;
      if (!esFilaValida(cols)) continue;

      const oficina = (cols[0] || '').trim();
      const franquicia = (cols[1] || '').trim();
      const ciudad = (cols[2] || '').trim();
      const pais = (cols[3] || '').trim();
      const telefono = (cols[4] || '').replace(/\D/g, '');

      if (!oficina || !telefono) { saltados++; continue; }

      if (existeTelefono.get(telefono)) { duplicados++; continue; }

      insert.run({
        agency_name: oficina,
        gatekeeper_phone: telefono,
        city: ciudad,
        country: pais,
        franquicia: franquicia || null,
      });
      insertados++;
      console.log(`[+] ${franquicia} | ${oficina} (${ciudad}, ${pais}) → ${telefono}`);
    }
  });

  importMany();

  console.log(`\n✅ Insertados: ${insertados} | Duplicados (ya existían): ${duplicados} | Saltados (sin datos): ${saltados}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
