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

// Rangos de fecha admitidos por el dashboard — null/undefined = todo el historial.
const RANGOS_VALIDOS = ['7', '30'];

function cutoffDesdeRango(range) {
  if (!RANGOS_VALIDOS.includes(String(range))) return null;
  const dias = parseInt(range, 10);
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

function fechaActividadWhatsapp(r) {
  return r.last_message_at || r.created_at || null;
}

function fechaActividadEmail(r) {
  return r.email_last_message_at || r.email_first_sent_at || null;
}

function dentroDelRango(fecha, cutoffISO) {
  if (!cutoffISO) return true;
  if (!fecha) return false;
  return fecha >= cutoffISO;
}

// Métricas base de un conjunto de filas ya filtradas por país (o todas).
// "pendientes" siempre refleja la cola actual completa, sin filtrar por fecha
// (es "cuánto falta mandar hoy"); el resto se recorta al rango pedido.
function calcularMetricas(rowsPais, cutoffISO) {
  const pendientes = rowsPais.filter((r) => r.stage === 'PENDING').length;
  const rows = rowsPais.filter((r) => dentroDelRango(fechaActividadWhatsapp(r), cutoffISO));

  const total = rows.length;
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

// Etapas de email que implican que el prospecto respondió (aunque sea para
// decir "no soy yo") — igual que CONTESTARON pero para el pipeline de correo.
const EMAIL_CONTESTARON = ['AGUARDANDO_REDIRECT', 'HANDED_OFF'];

// Métricas del pipeline de email de un conjunto de filas ya filtradas por país
// (mismo criterio: pendientes es la cola actual sin filtrar; el resto se recorta al rango).
function calcularMetricasEmail(rowsPais, cutoffISO) {
  const conEmailTodos = rowsPais.filter((r) => r.gatekeeper_email && r.gatekeeper_email.trim());
  const pendientes = conEmailTodos.filter((r) => r.email_stage === 'PENDING').length;
  const conEmail = conEmailTodos.filter((r) => dentroDelRango(fechaActividadEmail(r), cutoffISO));

  const total = conEmail.length;
  const enviados = conEmail.filter((r) => r.email_stage !== 'PENDING').length;
  const toque1 = conEmail.filter((r) => r.email_stage === 'TOQUE_1_SENT').length;
  const toque2 = conEmail.filter((r) => r.email_stage === 'TOQUE_2_SENT').length;
  const toque3 = conEmail.filter((r) => r.email_stage === 'TOQUE_3_SENT').length;
  const toque4 = conEmail.filter((r) => r.email_stage === 'TOQUE_4_SENT').length;
  const sinRespuesta = conEmail.filter((r) => r.email_stage === 'NO_REPLY').length;
  const contestaron = conEmail.filter((r) => EMAIL_CONTESTARON.includes(r.email_stage)).length;
  const handoff = conEmail.filter((r) => r.email_stage === 'HANDED_OFF').length;
  const rebotados = conEmail.filter((r) => r.email_stage === 'BOUNCED').length;

  const tasaRespuesta = enviados > 0 ? Math.round((contestaron / enviados) * 100) : null;
  const tasaRebote = enviados > 0 ? Math.round((rebotados / enviados) * 100) : null;

  return {
    total,
    pendientes,
    enviados,
    toque1,
    toque2,
    toque3,
    toque4,
    sinRespuesta,
    contestaron,
    handoff,
    rebotados,
    tasaRespuesta,
    tasaRebote,
  };
}

// range: undefined/null = todo el historial, "7" o "30" = últimos N días.
export function getStats(range) {
  const cutoffISO = cutoffDesdeRango(range);
  const rows = getDb().prepare(`SELECT * FROM prospects`).all();

  const porPais = {};
  for (const r of rows) {
    const pais = normalizarPais(r.country);
    if (!porPais[pais]) porPais[pais] = [];
    porPais[pais].push(r);
  }

  const paises = Object.keys(porPais)
    .sort((a, b) => porPais[b].length - porPais[a].length)
    .map((pais) => ({ pais, ...calcularMetricas(porPais[pais], cutoffISO) }));

  const paisesEmail = Object.keys(porPais)
    .filter((pais) => porPais[pais].some((r) => r.gatekeeper_email && r.gatekeeper_email.trim()))
    .sort((a, b) => porPais[b].length - porPais[a].length)
    .map((pais) => ({ pais, ...calcularMetricasEmail(porPais[pais], cutoffISO) }));

  return {
    range: RANGOS_VALIDOS.includes(String(range)) ? String(range) : null,
    total: calcularMetricas(rows, cutoffISO),
    paises,
    email: {
      total: calcularMetricasEmail(rows, cutoffISO),
      paises: paisesEmail,
    },
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
  email_enviados: (r) => r.gatekeeper_email && r.email_stage !== 'PENDING',
  email_contestaron: (r) => EMAIL_CONTESTARON.includes(r.email_stage),
  email_handoff: (r) => r.email_stage === 'HANDED_OFF',
  email_sin_respuesta: (r) => r.email_stage === 'NO_REPLY',
  email_rebotados: (r) => r.email_stage === 'BOUNCED',
};

export function listarPorCategoria(categoria, pais, range) {
  const filtro = FILTROS[categoria];
  if (!filtro) return [];
  const cutoffISO = cutoffDesdeRango(range);
  const esEmail = categoria.startsWith('email_');
  const fechaActividad = esEmail ? fechaActividadEmail : fechaActividadWhatsapp;

  let rows = getDb().prepare(`SELECT * FROM prospects`).all();
  if (pais) rows = rows.filter((r) => normalizarPais(r.country) === pais);
  return rows
    .filter(filtro)
    .filter((r) => dentroDelRango(fechaActividad(r), cutoffISO))
    .sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
}

export { normalizarPais };
