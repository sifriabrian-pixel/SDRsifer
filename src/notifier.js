// Envía handoff a Brian cuando se detecta interés real

let sock; // referencia al socket de Baileys

export function setSocket(s) {
  sock = s;
}

export async function sendHandoff(prospect) {
  const brianJid = `${process.env.BRIAN_PHONE}@s.whatsapp.net`;
  const canal = prospect.channel === 'email' ? '📧 Email' : '💬 WhatsApp';
  const dmContacto = prospect.channel === 'email'
    ? prospect.dm_email
    : (prospect.dm_phone || prospect.dm_jid);

  const msg = [
    `🔔 *LEAD INTERESADO — HANDOFF (${canal})*`,
    ``,
    `*Agencia:* ${prospect.agency_name}`,
    `*Ciudad/País:* ${prospect.city}, ${prospect.country}`,
    ``,
    `*Portero:* ${prospect.gatekeeper_phone || prospect.gatekeeper_email}`,
    `*DM:* ${prospect.dm_name || 'No registrado'} — ${dmContacto}`,
    ``,
    `*Resumen:*`,
    prospect.notes || 'Sin notas',
    ``,
    `👆 Tomá la conversación para agendar la demo.`,
  ].join('\n');

  await sock.sendMessage(brianJid, { text: msg });
}
