// Vistas HTML del dashboard interno (Sifer CRM) — server-rendered, sin frontend aparte.

const MARCA = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#22d3ee',
  green: '#4ade80',
  red: '#f87171',
  yellow: '#fbbf24',
};

const CATEGORIA_LABEL = {
  enviados: 'Enviados',
  sin_whatsapp: 'Sin WhatsApp',
  saltados: 'Saltados',
  sin_respuesta: 'Sin respuesta',
  entregados: 'Entregados',
  leidos: 'Leídos',
  contestaron: 'Contestaron',
  eran_dm: 'Eran el DM',
  derivaron_dm: 'Derivaron a DM',
  handoff: 'Handoff (listos)',
  descartados: 'Descartados',
};

function layout(titulo, contenido) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} — Sifer CRM</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: ${MARCA.bg}; color: ${MARCA.text}; font-family: -apple-system, Segoe UI, sans-serif; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; color: ${MARCA.muted}; font-weight: 500; margin: 0 0 20px; }
  a { color: ${MARCA.accent}; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; text-align: right; border-bottom: 1px solid ${MARCA.border}; }
  th:first-child, td:first-child { text-align: left; }
  th { color: ${MARCA.muted}; font-weight: 600; font-size: 12px; text-transform: uppercase; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px; }
  .card { background: ${MARCA.card}; border: 1px solid ${MARCA.border}; border-radius: 10px; padding: 14px 16px; }
  .card .num { font-size: 26px; font-weight: 700; }
  .card .label { font-size: 12px; color: ${MARCA.muted}; margin-top: 2px; }
  .green { color: ${MARCA.green}; } .red { color: ${MARCA.red}; } .yellow { color: ${MARCA.yellow}; }
  .table-wrap { background: ${MARCA.card}; border: 1px solid ${MARCA.border}; border-radius: 10px; padding: 4px 16px; overflow-x: auto; }
  .back { display: inline-block; margin-bottom: 16px; font-size: 13px; text-decoration: none; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: ${MARCA.border}; }
</style>
</head>
<body>
${contenido}
</body>
</html>`;
}

function card(num, label, cls = '') {
  return `<div class="card"><div class="num ${cls}">${num ?? '—'}</div><div class="label">${label}</div></div>`;
}

function link(categoria, pais, texto) {
  const qs = pais ? `?tipo=${categoria}&pais=${encodeURIComponent(pais)}` : `?tipo=${categoria}`;
  return `<a href="/stats/detalle${qs}">${texto}</a>`;
}

export function renderStatsPage(stats) {
  const t = stats.total;

  const filas = stats.paises
    .map(
      (p) => `<tr>
        <td>${p.pais}</td>
        <td>${link('enviados', p.pais, p.enviados)}</td>
        <td>${link('entregados', p.pais, p.entregados)}</td>
        <td>${link('leidos', p.pais, p.leidos)}</td>
        <td>${link('contestaron', p.pais, p.contestaron)}</td>
        <td>${link('sin_respuesta', p.pais, p.sinRespuesta)}</td>
        <td>${link('eran_dm', p.pais, p.eranDm)}</td>
        <td>${link('derivaron_dm', p.pais, p.derivaronDm)}</td>
        <td>${link('handoff', p.pais, p.handoff)}</td>
        <td class="red">${link('sin_whatsapp', p.pais, p.sinWhatsapp)}</td>
        <td>${p.pendientes}</td>
      </tr>`
    )
    .join('');

  const contenido = `
    <h1>Sifer — Dashboard SDR</h1>
    <h2>Prospección outbound por WhatsApp · datos en vivo</h2>

    <div class="cards">
      ${card(t.enviados, 'Enviados (total)')}
      ${card(t.entregados, 'Entregados')}
      ${card(t.leidos, 'Leídos', 'green')}
      ${card(t.contestaron, 'Contestaron')}
      ${card(t.sinRespuesta, 'Sin respuesta', 'yellow')}
      ${card(t.tasaRespuesta != null ? t.tasaRespuesta + '%' : '—', 'Tasa de respuesta')}
      ${card(t.handoff, 'Derivados a Brian (handoff)', 'green')}
      ${card(t.tasaHandoff != null ? t.tasaHandoff + '%' : '—', 'Tasa de conversión a handoff')}
      ${card(t.sinWhatsapp, 'Sin WhatsApp', 'red')}
      ${card(t.pendientes, 'Pendientes en cola', 'yellow')}
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>País</th><th>Enviados</th><th>Entregados</th><th>Leídos</th>
            <th>Contestaron</th><th>Sin respuesta</th><th>Eran DM</th><th>Derivaron DM</th>
            <th>Handoff</th><th>Sin WhatsApp</th><th>Pendientes</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
  return layout('Dashboard', contenido);
}

export function renderDetallePage(categoria, pais, rows) {
  const titulo = CATEGORIA_LABEL[categoria] || categoria;
  const filas = rows
    .map(
      (r) => `<tr>
        <td>${r.agency_name}</td>
        <td>${r.country || ''}</td>
        <td>${r.gatekeeper_phone}</td>
        <td><span class="pill">${r.stage}</span></td>
        <td>${(r.last_message_at || r.created_at || '').slice(0, 16).replace('T', ' ')}</td>
      </tr>`
    )
    .join('');

  const contenido = `
    <a class="back" href="/stats">← Volver al dashboard</a>
    <h1>${titulo}${pais ? ' — ' + pais : ''}</h1>
    <h2>${rows.length} prospectos</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Agencia</th><th>País</th><th>Teléfono</th><th>Etapa</th><th>Último mensaje</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">Sin resultados</td></tr>'}</tbody>
      </table>
    </div>
  `;
  return layout(titulo, contenido);
}
