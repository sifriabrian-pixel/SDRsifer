import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { runLaunchBatch } from './launch.js';

const REQUEST_PATH = process.env.LAUNCH_REQUEST_PATH
  || path.join(path.dirname(process.env.DB_PATH || './sifer.db'), 'launch_request.json');

const CHECK_INTERVAL_MS = 30 * 1000; // revisar cada 30 segundos

async function checkRequest() {
  if (!existsSync(REQUEST_PATH)) return;

  try {
    const raw = readFileSync(REQUEST_PATH, 'utf8');
    unlinkSync(REQUEST_PATH); // borrar el pedido antes de procesarlo, para no repetirlo
    const { count } = JSON.parse(raw);
    const limit = parseInt(count) || 10;
    console.log(`[LAUNCH-REQUEST] Pedido detectado — lanzando ${limit} mensajes...`);
    await runLaunchBatch(limit);
  } catch (err) {
    console.error(`[LAUNCH-REQUEST ERROR] ${err.message}`);
  }
}

export function startLaunchRequestWatcher() {
  setInterval(checkRequest, CHECK_INTERVAL_MS);
  console.log(`📨 Launch-request watcher activo — revisa ${REQUEST_PATH} cada 30s`);
}

// Helper para crear un pedido desde la propia terminal/Shell sin Node
export function writeLaunchRequest(count) {
  writeFileSync(REQUEST_PATH, JSON.stringify({ count }), 'utf8');
}
