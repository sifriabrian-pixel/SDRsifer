import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { runEmailLaunchBatch } from './emailLaunch.js';

const REQUEST_PATH = process.env.EMAIL_LAUNCH_REQUEST_PATH
  || path.join(path.dirname(process.env.DB_PATH || './sifer.db'), 'email_launch_request.json');

const CHECK_INTERVAL_MS = 30 * 1000;

async function checkRequest() {
  if (!existsSync(REQUEST_PATH)) return;

  try {
    const raw = readFileSync(REQUEST_PATH, 'utf8');
    unlinkSync(REQUEST_PATH);
    const { count } = JSON.parse(raw);
    const limit = parseInt(count) || 10;
    console.log(`[EMAIL-LAUNCH-REQUEST] Pedido detectado — lanzando ${limit} emails...`);
    await runEmailLaunchBatch(limit);
  } catch (err) {
    console.error(`[EMAIL-LAUNCH-REQUEST ERROR] ${err.message}`);
  }
}

export function startEmailLaunchRequestWatcher() {
  setInterval(checkRequest, CHECK_INTERVAL_MS);
  console.log(`📨 Email launch-request watcher activo — revisa ${REQUEST_PATH} cada 30s`);
}
