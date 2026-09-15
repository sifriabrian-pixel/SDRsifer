// Dashboard interno (Sifer CRM) — métricas en vivo desde la tabla prospects,
// sin log de eventos aparte: todo el historial ya vive en las columnas de la DB.

import { getDb } from './db.js';

function normalizarPais(pais) {
  const p = (pais || '').toLowerCase();
  if (p.includes('argentin')) return 'Argentina';
  if (p.includes('paraguay')) return 'Paraguay';
  if (p.includes('ecuador')) return 'Ecuador';
  if (p.includes('mexic') || p.includes('méxic')) return 'México';
  if (p.includes('peru') || p.includes('perú')) return 'Perú';
  return pais || 'Sin país';
}

// EMAIL_ONLY es un pipeline aparte (leads que solo se trabajan por mail, nunca
// se les mandó WhatsApp) — se excluye por completo del dashboard de WhatsApp.
const NUNCA_ENVIADO = ['PENDING', 'EMAIL_ONLY'];

// Etapas que solo existen porque YA hubo una respuesta real del gatekeeper o
// del DM (handleMessage solo corre cuando llega un mensaje entrante — nunca
// se entra a estas etapas "en frío"). FASE1_SENT, FASE2_FOLLOWUP_SENT y
// NO_REPLY quedan afuera a propósito: significan "se mandó, no contestaron".
const CONTESTARON = [
  'FASE2_PORTERO',
  'FASE2_YA_TIENEN',
  'FASE2_CALIFICANDO',
  'FASE2_OBJECION',
  'FASE3_APERTURA',
  'FASE3_BIFURCACION',
  'FASE3_BIFURCACION_B',
  'FASE3_OBJECION',
  'DISCARDED',
  'HANDED_OFF',
];

// Métricas base de un conjunto de filas ya filtradas por país (o todas)
function calcularMetricas(rows) {
  const total = rows.length;
  const pendientes = rows.filter((r) => r.stage === 'PENDING').length;
  const emailOnly = rows.filter((r) => r.stage === 'EMAIL_ONLY').length;
  const enviados = rows.filter((r) => !NUNCA_ENVIADO.includes(r.stage) && r.stage !== 'SKIPPED').length;
  const sinWhatsapp = rows.filter((r) => r.stage === 'NO_WHATSAPP').length;
  const saltados = rows.filter((r) => r.stage === 'SKIPPED').length;
  const sinRespuesta = rows.filter((r) => ['FASE1_SENT', 'FASE2_FOLLOWUP_SENT', 'NO_REPLY'].includes(r.stage)).length;
  const entregados = rows.filter((r) => r.delivered_at || r.read_at).length;
  const leidos = rows.filter((r) => r.read_at).length;
  const contestaron = rows.filter((r) => CONTESTARON.includes(r.stage)).length;
  const eranDm = rows.filter((r) => r.dm_jid && r.dm_jid === r.gatekeeper_jid).length;
  const derivaronDm = rows.filter((r) => r.dm_jid && r.dm_jid !== r.gatekeeper_jid).length;
  const handoff = rows.filter((r) => r.stage === 'HANDED_OFF').length;
  const descartados = rows.filter((r) => r.stage === 'DISCARDED').length;

  const base = enviados - sinWhatsapp; // a los que realmente les llegó el intento (excluye saltados y sin whatsapp)
  const tasaRespuesta = base > 0 ? Math.round((contestaron / base) * 100) : null;
  const tasaHandoff = enviados > 0 ? Math.round((handoff / enviados) * 100) : null;
  const tasaLectura = entregados > 0 ? Math.round((leidos / entregados) * 100) : null;

  return {
    total,
    enviados,
    pendientes,
    emailOnly,
    sinWhatsapp,
    saltados,
    sinRespuesta,
    entregados,
    leidos,
    contestaron,
    eranDm,
    derivaronDm,
    handoff,
    descartados,
    tasaRespuesta,
    tasaHandoff,
    tasaLectura,
  };
}

export function getStats() {
  const rows = getDb().prepare(`SELECT * FROM prospects`).all();

  const porPais = {};
  for (const r of rows) {
    const pais = normalizarPais(r.country);
    if (!porPais[pais]) porPais[pais] = [];
    porPais[pais].push(r);
  }

  const paises = Object.keys(porPais)
    .sort((a, b) => porPais[b].length - porPais[a].length)
    .map((pais) => ({ pais, ...calcularMetricas(porPais[pais]) }));

  return {
    total: calcularMetricas(rows),
    paises,
  };
}

// Listado detalle para una categoría, con filtro opcional de país — para el
// drill-down del dashboard (ver quiénes componen cada número).
const FILTROS = {
  enviados: (r) => !NUNCA_ENVIADO.includes(r.stage) && r.stage !== 'SKIPPED',
  sin_whatsapp: (r) => r.stage === 'NO_WHATSAPP',
  saltados: (r) => r.stage === 'SKIPPED',
  sin_respuesta: (r) => ['FASE1_SENT', 'FASE2_FOLLOWUP_SENT', 'NO_REPLY'].includes(r.stage),
  entregados: (r) => r.delivered_at || r.read_at,
  leidos: (r) => r.read_at,
  contestaron: (r) => CONTESTARON.includes(r.stage),
  eran_dm: (r) => r.dm_jid && r.dm_jid === r.gatekeeper_jid,
  derivaron_dm: (r) => r.dm_jid && r.dm_jid !== r.gatekeeper_jid,
  handoff: (r) => r.stage === 'HANDED_OFF',
  descartados: (r) => r.stage === 'DISCARDED',
};

export function listarPorCategoria(categoria, pais) {
  const filtro = FILTROS[categoria];
  if (!filtro) return [];
  let rows = getDb().prepare(`SELECT * FROM prospects`).all();
  if (pais) rows = rows.filter((r) => normalizarPais(r.country) === pais);
  return rows.filter(filtro).sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
}

export { normalizarPais };
