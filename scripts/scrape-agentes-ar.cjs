// Scraper de agentes individuales RE/MAX y C21 (Buenos Aires) — celulares reales
// en vez del telefono general de oficina. Estrategias:
//  1) remax.com.ar/<slug> -> lista /agent/<nombre> -> cada uno tiene wa.me con el numero.
//  2) sitios propios de oficina (RE/MAX o C21) -> buscar wa.me directo en el HTML
//     (muchos listan a sus agentes en la home con boton de WhatsApp).
//  3) century21.com.ar/v/oficina/<slug> -> campo whatsapp: '+54...' embebido (JSON inline).

const fs = require('fs');

const OFICINAS = [
  // [nombre_oficina, url, franquicia]
  ["CENTURY 21 Premier Real Estate", "https://www.century21premier.com.ar/", "Century 21"],
  ["Century 21 - MM Real Estate", "https://century21.com.ar/v/oficina/199-mm-real-estate-s-a-villa-devoto-capital-federal-argentina", "Century 21"],
  ["Century 21 Barrero", "http://c21barrero.com.ar/", "Century 21"],
  ["Century 21 Bezek", "https://century21.com.ar/v/oficina/104-bezek-palermo-capital-federal-argentina", "Century 21"],
  ["Century 21 Gisi LM", "http://c21gisilm.com.ar/", "Century 21"],
  ["Century 21 Nagy", "http://www.c21canedo.com.ar/", "Century 21"],
  ["Century 21 Plaza SRL", "http://www.c21plazasrl.com.ar/", "Century 21"],
  ["Century 21 Revolution SA", "http://c21revolutionsa.com.ar/", "Century 21"],
  ["Century 21 Sanchez", "https://c21sanchez.com.ar/", "Century 21"],
  ["Century 21 Skalko", "https://skalko.com.ar/", "Century 21"],
  ["Century 21 Szlit", "https://c21szlit.com.ar/", "Century 21"],
  ["RE/MAX Avenida - Villa Urquiza", "https://www.remax.com.ar/avenida", "RE/MAX"],
  ["RE/MAX CENTENARIO", "http://www.remax.com.ar/centenario", "RE/MAX"],
  ["RE/MAX Capital", "http://www.remax-capital.com.ar/", "RE/MAX"],
  ["RE/MAX ENCORE", "https://www.remaxencore.com.ar/", "RE/MAX"],
  ["RE/MAX EXPRESS", "https://www.remax.com.ar/express", "RE/MAX"],
  ["RE/MAX Exclusivo", "http://remaxexclusivo.com/", "RE/MAX"],
  ["RE/MAX HARMONY", "https://remax.com.ar/harmony", "RE/MAX"],
  ["RE/MAX Parque", "https://remax-parque.com.ar/", "RE/MAX"],
  ["RE/MAX Vanguard", "https://www.remax.com.ar/vanguard", "RE/MAX"],
  ["REMAX Ayres", "https://www.remax-ayres.com/", "RE/MAX"],
  ["REMAX FLY LINIERS CABA", "http://www.remax-fly.com.ar/", "RE/MAX"],
  ["REMAX NET - Villa Ortuzar - CABA", "https://www.remax-net.com.ar/", "RE/MAX"],
  ["REMAX Premium", "https://remax-premium.com.ar/", "RE/MAX"],
  ["REMAX Urbana", "http://www.remax-urbana.com.ar/", "RE/MAX"],
  ["REMAX VIP", "https://www.remax-vip.com.ar/", "RE/MAX"],
  ["Re/Max Home", "http://www.remax.com.ar/home", "RE/MAX"],
  ["Remax Premium IV", "https://remax-premium.com.ar/premium-iv/", "RE/MAX"],
];

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error(`  [ERROR] ${url} — ${e.message}`);
    return null;
  }
}

function extraerWaMe(html) {
  const matches = [...html.matchAll(/wa\.me\/\+?(\d{10,15})/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

function extraerWhatsappJson(html) {
  const m = html.match(/whatsapp:\s*'\+?(\d{10,15})'/);
  return m ? m[1] : null;
}

function extraerNombreAgente(html) {
  const m = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  return m ? m[1].trim() : null;
}

async function scrapeRemaxOficial(url, oficina, franquicia, out) {
  const html = await fetchHtml(url);
  if (!html) return;
  const agentPaths = [...new Set([...html.matchAll(/\/agent\/([a-z0-9-]+)/g)].map((m) => m[1]))];
  if (agentPaths.length === 0) {
    // Fallback: buscar wa.me directo en la pagina de oficina
    for (const num of extraerWaMe(html)) out.push({ agency_name: oficina, phone: num, franquicia });
    return;
  }
  for (const slug of agentPaths) {
    const agentUrl = `https://www.remax.com.ar/agent/${slug}`;
    const agentHtml = await fetchHtml(agentUrl);
    if (!agentHtml) continue;
    const nums = extraerWaMe(agentHtml);
    const nombre = extraerNombreAgente(agentHtml) || slug;
    if (nums.length > 0) out.push({ agency_name: `${nombre} (${oficina})`, phone: nums[0], franquicia });
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function scrapeGenerico(url, oficina, franquicia, out) {
  const html = await fetchHtml(url);
  if (!html) return;
  const waNums = extraerWaMe(html);
  if (waNums.length > 0) {
    for (const num of waNums) out.push({ agency_name: oficina, phone: num, franquicia });
    return;
  }
  const jsonNum = extraerWhatsappJson(html);
  if (jsonNum) out.push({ agency_name: oficina, phone: jsonNum, franquicia });
}

async function main() {
  const out = [];
  for (const [oficina, url, franquicia] of OFICINAS) {
    console.log(`Procesando: ${oficina} (${url})`);
    try {
      if (url.includes('remax.com.ar/') && !url.includes('century21')) {
        await scrapeRemaxOficial(url, oficina, franquicia, out);
      } else {
        await scrapeGenerico(url, oficina, franquicia, out);
      }
    } catch (e) {
      console.error(`  [ERROR] ${oficina} — ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Dedupe por telefono
  const vistos = new Set();
  const final = out.filter((r) => {
    if (vistos.has(r.phone)) return false;
    vistos.add(r.phone);
    return true;
  });

  console.log(`\nTotal contactos encontrados: ${final.length}`);
  fs.writeFileSync('data/agentes_ar_scraped.json', JSON.stringify(final, null, 2));
  const csv = ['agency_name,phone,city,country,franquicia']
    .concat(final.map((r) => `"${r.agency_name.replace(/"/g, "'")}",${r.phone},Buenos Aires,Argentina,${r.franquicia}`))
    .join('\n');
  fs.writeFileSync('data/agentes_ar_scraped.csv', csv);
  console.log('Guardado en data/agentes_ar_scraped.csv y .json');
}

main();
