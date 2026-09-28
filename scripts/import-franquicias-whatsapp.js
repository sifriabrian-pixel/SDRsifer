// Importa prospectos con teléfono para WhatsApp desde un CSV. Acepta dos formatos
// (detecta por encabezado): el export de franquicias (Oficina,Franquicia,Ciudad,
// País,Teléfono,...) o el de scraping de agentes (agency_name,phone,city,country,
// franquicia). Uso: node scripts/import-franquicias-whatsapp.js <archivo.csv>
//
// Dedup por NÚMERO NORMALIZADO (últimos 10 dígitos), no por texto exacto — el mismo
// número real puede estar guardado como "+54 11 2712-1122", "541127121122" o
// "5491127121122" según de qué importación vino, y una comparación de texto exacto
// los deja pasar como si fueran contactos distintos (bug real: mandó dos veces al
// mismo número, uno de ellos ya marcado NO_WHATSAPP por 131049).

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

function parseCsvLine(line) {
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
  return cols;
}

function normalizarNumero(phone) {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

async function main() {
  initDb();
  const db = getDb();

  // Cargar todos los numeros existentes (gatekeeper_phone y dm_phone), normalizados,
  // una sola vez — evitamos duplicados aunque esten guardados con formato distinto.
  const existentes = new Set();
  for (const r of db.prepare(`SELECT gatekeeper_phone, dm_phone FROM prospects`).all()) {
    const n1 = normalizarNumero(r.gatekeeper_phone);
    const n2 = normalizarNumero(r.dm_phone);
    if (n1) existentes.add(n1);
    if (n2) existentes.add(n2);
  }

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

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const esFormatoScraping = header.includes('agency_name') && header.includes('phone');

  let insertados = 0, duplicados = 0, saltados = 0;

  const importMany = db.transaction(() => {
    const start = esFormatoScraping ? 1 : 0; // formato franquicias no siempre tiene header limpio en la primera linea
    for (let i = start; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 4) continue;

      let oficina, franquicia, ciudad, pais, telefono;
      if (esFormatoScraping) {
        [oficina, telefono, ciudad, pais, franquicia] = cols;
        telefono = (telefono || '').replace(/\D/g, '');
      } else {
        pais = (cols[3] || '').trim();
        if (!PAISES_VALIDOS.has(pais)) continue;
        oficina = (cols[0] || '').trim();
        franquicia = (cols[1] || '').trim();
        ciudad = (cols[2] || '').trim();
        telefono = (cols[4] || '').replace(/\D/g, '');
      }

      oficina = (oficina || '').trim();
      franquicia = (franquicia || '').trim();
      ciudad = (ciudad || '').trim();
      pais = (pais || '').trim();

      if (!oficina || !telefono) { saltados++; continue; }

      const norm = normalizarNumero(telefono);
      if (existentes.has(norm)) { duplicados++; continue; }
      existentes.add(norm); // evita duplicados tambien dentro del mismo archivo

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

  console.log(`\n✅ Insertados: ${insertados} | Duplicados (ya existían, número normalizado): ${duplicados} | Saltados (sin datos): ${saltados}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
