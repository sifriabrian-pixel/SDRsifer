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
  email_enviados: 'Email — Enviados',
  email_contestaron: 'Email — Contestaron',
  email_handoff: 'Email — Handoff',
  email_sin_respuesta: 'Email — Sin respuesta',
  email_rebotados: 'Email — Rebotados',
};

function layout(titulo, contenido) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} — SDR Sifer</title>
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
  .range-selector { display: flex; gap: 8px; margin-bottom: 20px; }
  .range-pill { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 13px; text-decoration: none; background: ${MARCA.card}; border: 1px solid ${MARCA.border}; color: ${MARCA.muted}; }
  .range-pill.active { background: ${MARCA.accent}; border-color: ${MARCA.accent}; color: ${MARCA.bg}; font-weight: 600; }
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

function link(categoria, pais, texto, range) {
  const params = [`tipo=${categoria}`];
  if (pais) params.push(`pais=${encodeURIComponent(pais)}`);
  if (range) params.push(`range=${encodeURIComponent(range)}`);
  return `<a href="/stats/detalle?${params.join('&')}">${texto}</a>`;
}

const RANGO_LABEL = { '7': 'Últimos 7 días', '30': 'Últimos 30 días' };

function rangeSelector(range, basePath) {
  const opciones = [
    { valor: null, texto: 'Todo el historial' },
    { valor: '7', texto: 'Últimos 7 días' },
    { valor: '30', texto: 'Últimos 30 días' },
  ];
  const pills = opciones
    .map((o) => {
      const activo = (o.valor || null) === (range || null);
      const href = o.valor ? `${basePath}?range=${o.valor}` : basePath;
      return `<a href="${href}" class="range-pill${activo ? ' active' : ''}">${o.texto}</a>`;
    })
    .join('');
  return `<div class="range-selector">${pills}</div>`;
}

export function renderStatsPage(stats) {
  const t = stats.total;
  const e = stats.email.total;
  const range = stats.range;

  const filasEmail = stats.email.paises
    .map(
      (p) => `<tr>
        <td>${p.pais}</td>
        <td>${link('email_enviados', p.pais, p.enviados, range)}</td>
        <td>${p.toque1}</td>
        <td>${p.toque2}</td>
        <td>${p.toque3}</td>
        <td>${p.toque4}</td>
        <td>${link('email_contestaron', p.pais, p.contestaron, range)}</td>
        <td>${link('email_handoff', p.pais, p.handoff, range)}</td>
        <td>${link('email_sin_respuesta', p.pais, p.sinRespuesta, range)}</td>
        <td class="red">${link('email_rebotados', p.pais, p.rebotados, range)}</td>
        <td>${p.pendientes}</td>
      </tr>`
    )
    .join('');

  const filas = stats.paises
    .map(
      (p) => `<tr>
        <td>${p.pais}</td>
        <td>${link('enviados', p.pais, p.enviados, range)}</td>
        <td>${link('entregados', p.pais, p.entregados, range)}</td>
        <td>${link('leidos', p.pais, p.leidos, range)}</td>
        <td>${link('contestaron', p.pais, p.contestaron, range)}</td>
        <td>${link('sin_respuesta', p.pais, p.sinRespuesta, range)}</td>
        <td>${link('eran_dm', p.pais, p.eranDm, range)}</td>
        <td>${link('derivaron_dm', p.pais, p.derivaronDm, range)}</td>
        <td>${link('handoff', p.pais, p.handoff, range)}</td>
        <td class="red">${link('sin_whatsapp', p.pais, p.sinWhatsapp, range)}</td>
        <td>${p.pendientes}</td>
      </tr>`
    )
    .join('');

  const contenido = `
    <h1>SDR Sifer</h1>
    <h2>Prospección outbound por WhatsApp · datos en vivo</h2>
    ${rangeSelector(range, '/stats')}

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

    <h1 style="margin-top:36px;">Email</h1>
    <h2>Secuencia de correo (Franquicias / Independientes / Miami) · datos en vivo</h2>

    <div class="cards">
      ${card(e.enviados, 'Enviados (total)')}
      ${card(e.toque1, 'En toque 1')}
      ${card(e.toque2, 'En toque 2')}
      ${card(e.toque3, 'En toque 3')}
      ${card(e.toque4, 'En toque 4')}
      ${card(e.contestaron, 'Contestaron')}
      ${card(e.tasaRespuesta != null ? e.tasaRespuesta + '%' : '—', 'Tasa de respuesta')}
      ${card(e.handoff, 'Derivados a Brian (handoff)', 'green')}
      ${card(e.sinRespuesta, 'Sin respuesta (secuencia completa)', 'yellow')}
      ${card(e.rebotados, 'Rebotados', 'red')}
      ${card(e.pendientes, 'Pendientes en cola', 'yellow')}
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>País</th><th>Enviados</th><th>Toque 1</th><th>Toque 2</th><th>Toque 3</th><th>Toque 4</th>
            <th>Contestaron</th><th>Handoff</th><th>Sin respuesta</th><th>Rebotados</th><th>Pendientes</th>
          </tr>
        </thead>
        <tbody>${filasEmail}</tbody>
      </table>
    </div>
  `;
  return layout('Dashboard', contenido);
}

export function renderDetallePage(categoria, pais, rows, range) {
  const titulo = CATEGORIA_LABEL[categoria] || categoria;
  const esEmail = categoria.startsWith('email_');
  const filas = rows
    .map(
      (r) => `<tr>
        <td>${r.agency_name}</td>
        <td>${r.country || ''}</td>
        <td>${esEmail ? (r.gatekeeper_email || '') : r.gatekeeper_phone}</td>
        <td><span class="pill">${esEmail ? r.email_stage : r.stage}</span></td>
        <td>${((esEmail ? (r.email_last_message_at || r.email_first_sent_at) : (r.last_message_at || r.created_at)) || '').slice(0, 16).replace('T', ' ')}</td>
      </tr>`
    )
    .join('');

  const volverQs = range ? `?range=${encodeURIComponent(range)}` : '';
  const contenido = `
    <a class="back" href="/stats${volverQs}">← Volver al dashboard</a>
    <h1>${titulo}${pais ? ' — ' + pais : ''}</h1>
    <h2>${rows.length} prospectos ${range ? `(${RANGO_LABEL[range] || range})` : '(todo el historial)'}</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Agencia</th><th>País</th><th>${esEmail ? 'Email' : 'Teléfono'}</th><th>Etapa</th><th>Último mensaje</th></tr></thead>
        <tbody>${filas || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">Sin resultados</td></tr>'}</tbody>
      </table>
    </div>
  `;
  return layout(titulo, contenido);
}
