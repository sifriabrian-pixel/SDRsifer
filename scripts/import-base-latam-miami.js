// Importa el CSV "Base_Inmobiliarias_LATAM_Miami" — columnas:
// Marca,País,Ciudad objetivo,Nombre,Zona/Localidad,Dirección,Email,
// WhatsApp/Móvil,Teléfono,Web/Fuente,Notas
//
// - Usa WhatsApp/Móvil si está, si no cae a Teléfono.
// - Salta filas marcadas "excluir" en Notas (clientes actuales, en negociación, etc).
// - Marca franquicia (RE/MAX, Century 21, Keller Williams) para el mensaje 2 adaptado;
//   "Independiente" no lleva franquicia.
// - Dedup por número normalizado (últimos 10 dígitos) contra TODA la tabla
//   (gatekeeper_phone y dm_phone), no texto exacto.
//
// Uso: node scripts/import-base-latam-miami.js <archivo.csv>

import 'dotenv/config';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { initDb, getDb } from '../src/db.js';

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error('Uso: node scripts/import-base-latam-miami.js <archivo.csv>');
  process.exit(1);
}

const FRANQUICIAS = new Set(['RE/MAX', 'Century 21', 'Keller Williams']);

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

  const existentes = new Set();
  for (const r of db.prepare(`SELECT gatekeeper_phone, dm_phone FROM prospects`).all()) {
    const n1 = normalizarNumero(r.gatekeeper_phone);
    const n2 = normalizarNumero(r.dm_phone);
    if (n1) existentes.add(n1);
    if (n2) existentes.add(n2);
  }

  const insert = db.prepare(`
    INSERT INTO prospects (agency_name, gatekeeper_phone, gatekeeper_email, city, country, franquicia, stage)
    VALUES (@agency_name, @gatekeeper_phone, @gatekeeper_email, @city, @country, @franquicia, 'PENDING')
  `);

  const lines = [];
  await new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(CSV_PATH, { encoding: 'utf8' }) });
    rl.on('line', (line) => lines.push(line));
    rl.on('close', resolve);
  });

  let insertados = 0, duplicados = 0, excluidos = 0, sinTelefono = 0;
  const porPais = {};

  const importMany = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 9) continue;

      const [marca, pais, ciudadObjetivo, nombre, zona, , email, whatsapp, telefono, , notas] = cols;
      if (!nombre || !nombre.trim()) continue;

      if ((notas || '').toLowerCase().includes('excluir')) {
        excluidos++;
        console.log(`[EXCLUIDO] ${nombre.trim()} — ${notas.trim()}`);
        continue;
      }

      const telefonoFinal = (whatsapp || '').trim() || (telefono || '').trim();
      const digits = telefonoFinal.replace(/\D/g, '');
      if (!digits) { sinTelefono++; continue; }

      const norm = normalizarNumero(digits);
      if (existentes.has(norm)) { duplicados++; continue; }
      existentes.add(norm);

      const franquicia = FRANQUICIAS.has((marca || '').trim()) ? marca.trim() : null;
      const city = (zona || '').trim() || (ciudadObjetivo || '').trim();
      const country = (pais || '').trim();
      const cleanEmail = (email || '').trim() || null;

      insert.run({
        agency_name: nombre.trim(),
        gatekeeper_phone: digits,
        gatekeeper_email: cleanEmail,
        city,
        country,
        franquicia,
      });
      insertados++;
      porPais[country] = (porPais[country] || 0) + 1;
      console.log(`[+] ${marca || 'Independiente'} | ${nombre.trim()} (${city}, ${country}) → ${digits}${cleanEmail ? ' | ' + cleanEmail : ''}`);
    }
  });

  importMany();

  console.log(`\n✅ Insertados: ${insertados} | Duplicados (ya existían): ${duplicados} | Excluidos (marcados en Notas): ${excluidos} | Sin teléfono: ${sinTelefono}`);
  console.log('Por país:', JSON.stringify(porPais, null, 1));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
