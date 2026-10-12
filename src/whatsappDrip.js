// Envío gradual de WhatsApp (cold outbound): un mensaje por país cada tick, solo en
// horario laboral local y hasta un tope diario por país. Corre dentro del servidor
// principal — no depende de sesiones ssh largas. Se enciende con WA_DRIP=on.
//
// Variables (todas opcionales salvo WA_DRIP):
//   WA_DRIP=on
//   WA_DRIP_COUNTRIES=Ecuador,Paraguay,México      países en rotación
//   WA_DRIP_DAILY_PER_COUNTRY=20                   tope de mensajes por país y día local
//   WA_DRIP_TICK_MIN=10                            minutos entre rondas
//   WA_DRIP_HOURS=9-18                             horario local (hora inicio - hora fin, fin exclusivo)

import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { runLaunchBatch } from './launch.js';

const STATE_PATH = process.env.WA_DRIP_STATE_PATH
  || path.join(path.dirname(process.env.DB_PATH || './sifer.db'), 'wa_drip_state.json');

const OFFSETS = { ecuador: -5, paraguay: -4, mexico: -6, méxico: -6, argentina: -3, colombia: -5, peru: -5, perú: -5 };
const PAUSA_TRAS_ERRORES_MS = 30 * 60 * 1000;
const ENTRE_PAISES_MS = 30 * 1000;

// México está cargado como "México" y como "Mexico" en la base
const PAIS_QUERY = { méxico: 'México,Mexico', mexico: 'México,Mexico' };

function offsetDe(pais) {
  return OFFSETS[(pais || '').toLowerCase()] ?? -3;
}

function horaLocal(pais) {
  const d = new Date(Date.now() + offsetDe(pais) * 3600 * 1000);
  return { dia: d.toISOString().slice(0, 10), hora: d.getUTCHours(), diaSemana: d.getUTCDay() };
}

function leerEstado() {
  if (!existsSync(STATE_PATH)) return { paises: {}, pausadoHasta: 0 };
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { paises: {}, pausadoHasta: 0 };
  }
}

function guardarEstado(estado) {
  writeFileSync(STATE_PATH, JSON.stringify(estado), 'utf8');
}

function config() {
  const [desde, hasta] = (process.env.WA_DRIP_HOURS || '9-18').split('-').map((n) => parseInt(n, 10));
  return {
    paises: (process.env.WA_DRIP_COUNTRIES || 'Ecuador,Paraguay,México').split(',').map((p) => p.trim()).filter(Boolean),
    tope: parseInt(process.env.WA_DRIP_DAILY_PER_COUNTRY || '20', 10),
    desde: Number.isFinite(desde) ? desde : 9,
    hasta: Number.isFinite(hasta) ? hasta : 18,
  };
}

let corriendo = false;

async function ronda() {
  if (corriendo) return;
  corriendo = true;
  try {
    const cfg = config();
    const estado = leerEstado();
    if (Date.now() < (estado.pausadoHasta || 0)) return;

    for (const pais of cfg.paises) {
      const { dia, hora, diaSemana } = horaLocal(pais);
      const habil = diaSemana >= 1 && diaSemana <= 5 && hora >= cfg.desde && hora < cfg.hasta;
      if (!habil) continue;

      const clave = pais.toLowerCase();
      if (!estado.paises[clave] || estado.paises[clave].dia !== dia) estado.paises[clave] = { dia, enviados: 0 };
      if (estado.paises[clave].enviados >= cfg.tope) continue;

      const res = await runLaunchBatch(1, PAIS_QUERY[clave] || pais);
      estado.paises[clave].enviados += res.enviados;
      if (res.enviados > 0) console.log(`[WA-DRIP] ${pais}: ${estado.paises[clave].enviados}/${cfg.tope} hoy`);

      if (res.abortado) {
        estado.pausadoHasta = Date.now() + PAUSA_TRAS_ERRORES_MS;
        console.error(`[WA-DRIP] errores seguidos en ${pais} — pausa de 30 min`);
        guardarEstado(estado);
        return;
      }
      guardarEstado(estado);
      await new Promise((r) => setTimeout(r, ENTRE_PAISES_MS));
    }
    guardarEstado(estado);
  } catch (err) {
    console.error(`[WA-DRIP ERROR] ${err.message}`);
  } finally {
    corriendo = false;
  }
}

export function startWhatsappDrip() {
  if (process.env.WA_DRIP !== 'on') return;
  const cfg = config();
  const tickMin = parseInt(process.env.WA_DRIP_TICK_MIN || '10', 10);
  setInterval(ronda, tickMin * 60 * 1000);
  console.log(`💧 WhatsApp drip activo — ${cfg.paises.join(', ')} · hasta ${cfg.tope}/día por país · lun-vie ${cfg.desde}-${cfg.hasta}h local · cada ${tickMin} min`);
}
