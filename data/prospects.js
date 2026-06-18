import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { insertProspects } from '../src/db.js';

export async function importCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        })
      )
      .on('data', (row) => {
        // Normalizar nombres de columna (acepta variaciones en mayúsculas)
        const normalized = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v])
        );
        const rawPhone = normalized.phone || normalized.telefono || normalized.whatsapp || '';
        rows.push({
          agency_name: normalized.agency_name || normalized.empresa || normalized.agencia || normalized.nombre || '',
          gatekeeper_phone: rawPhone.replace(/\D/g, ''), // quita +, espacios, guiones
          city: normalized.city || normalized.ciudad || '',
          country: normalized.country || normalized.pais || normalized.país || '',
        });
      })
      .on('end', () => {
        const valid = rows.filter((r) => r.agency_name && r.gatekeeper_phone);
        insertProspects(valid);
        console.log(`✅ ${valid.length} prospectos importados (${rows.length - valid.length} omitidos por datos incompletos)`);
        resolve(valid.length);
      })
      .on('error', reject);
  });
}
