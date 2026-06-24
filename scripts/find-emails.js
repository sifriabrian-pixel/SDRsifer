// Scraper de emails: lee el CSV de prospectos, visita cada sitio web y busca un email de contacto.
// Uso: node scripts/find-emails.js <input.csv> <output.csv>

import { createReadStream, writeFileSync } from 'fs';
import { parse } from 'csv-parse';

const INPUT = process.argv[2] || '../SDRpulsetrack/prospectos.csv.csv';
const OUTPUT = process.argv[3] || 'prospectos_con_email.csv';
const CONCURRENCY = 5;
const TIMEOUT_MS = 10000;

const CONTACT_PATHS = ['', '/contacto', '/contact', '/nosotros', '/about', '/about-us', '/contactenos', '/contactanos'];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_DOMAINS = /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i;
const BAD_PROVIDERS = /(sentry\.io|wixpress\.com|example\.com|domain\.com|googleapis\.com)/i;

function cleanGoogleUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('google.com') && u.searchParams.has('q')) {
      return decodeURIComponent(u.searchParams.get('q'));
    }
    return url;
  } catch {
    return url;
  }
}

function extractEmails(html) {
  const matches = html.match(EMAIL_REGEX) || [];
  return [...new Set(matches)]
    .filter((e) => !BAD_DOMAINS.test(e) && !BAD_PROVIDERS.test(e))
    .filter((e) => e.length < 60);
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiferBot/1.0)' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findEmailForSite(rawUrl) {
  const baseUrl = cleanGoogleUrl(rawUrl);
  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }

  for (const path of CONTACT_PATHS) {
    const html = await fetchWithTimeout(origin + path, TIMEOUT_MS);
    if (!html) continue;
    const emails = extractEmails(html);
    if (emails.length > 0) return emails[0];
  }
  return null;
}

async function processRow(row) {
  if (!row.web || !row.web.trim()) return { ...row, email: '' };
  const email = await findEmailForSite(row.web.trim());
  return { ...row, email: email || '' };
}

async function runWithConcurrency(rows, limit) {
  const results = [];
  let index = 0;
  let found = 0;

  async function worker() {
    while (index < rows.length) {
      const i = index++;
      const row = rows[i];
      const result = await processRow(row);
      results[i] = result;
      if (result.email) found++;
      console.log(`[${i + 1}/${rows.length}] ${row.empresa} → ${result.email || 'sin email'}`);
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  console.log(`\n✅ Listo — ${found}/${rows.length} emails encontrados`);
  return results;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

async function main() {
  const rows = [];
  await new Promise((resolve, reject) => {
    createReadStream(INPUT)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, bom: true }))
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`Procesando ${rows.length} prospectos con concurrencia ${CONCURRENCY}...\n`);
  const results = await runWithConcurrency(rows, CONCURRENCY);
  writeFileSync(OUTPUT, toCsv(results), 'utf8');
  console.log(`Archivo guardado: ${OUTPUT}`);
}

main().catch(console.error);
