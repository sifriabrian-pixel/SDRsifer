import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { isWithinSendWindow, windowKey, getSupportedCountries, countryMatches } from './sendWindow.js';
import { getPendingEmailProspects, updateProspect } from './db.js';
import { sendEmail } from './email.js';
import { enqueueEmail } from './emailScheduler.js';
import { EMAIL_TOQUE_1 } from '../data/emailSequences.js';

const STATE_PATH = process.env.EMAIL_WINDOW_STATE_PATH
  || path.join(path.dirname(process.env.DB_PATH || './sifer.db'), 'email_window_state.json');

const CAP_PER_WINDOW = parseInt(process.env.EMAIL_DAILY_CAP_PER_COUNTRY || '15');
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos

function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state), 'utf8');
}

async function checkAndSend() {
  const state = loadState();
  const allPending = getPendingEmailProspects(500); // pool grande, se filtra por país en JS

  for (const country of getSupportedCountries()) {
    if (!isWithinSendWindow(country)) continue;

    const key = windowKey(country);
    if (!state[country] || state[country].windowKey !== key) {
      state[country] = { windowKey: key, sent: 0 };
    }

    const remaining = CAP_PER_WINDOW - state[country].sent;
    if (remaining <= 0) continue;

    const candidates = allPending.filter((p) => countryMatches(p.country, country)).slice(0, remaining);

    for (const prospect of candidates) {
      try {
        const { subject, text } = EMAIL_TOQUE_1(prospect.country, prospect.dm_name);
        const info = await enqueueEmail(() => sendEmail({ to: prospect.gatekeeper_email, subject, text }));
        const now = new Date().toISOString();
        updateProspect(prospect.id, {
          email_stage: 'TOQUE_1_SENT',
          email_first_sent_at: now,
          email_last_message_at: now,
          email_subject: subject,
          email_message_id: info.messageId || null,
        });
        state[country].sent++;
        console.log(`[EMAIL-AUTO] ${prospect.agency_name} (${country}) → ${prospect.gatekeeper_email}`);
      } catch (err) {
        console.error(`[EMAIL-AUTO ERROR] ${prospect.agency_name} — ${err.message}`);
      }
    }
    saveState(state);
  }
}

export function startEmailAutoSender() {
  checkAndSend().catch((err) => console.error('[EMAIL-AUTO] Error inicial:', err.message));
  setInterval(() => {
    checkAndSend().catch((err) => console.error('[EMAIL-AUTO] Error:', err.message));
  }, CHECK_INTERVAL_MS);
  console.log(`📧🕘 Auto-sender de email activo — ventana Mar/Jue 9-10am hora local por país, máx ${CAP_PER_WINDOW}/ventana`);
}
