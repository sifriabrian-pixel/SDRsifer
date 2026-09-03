// Envía handoff a Brian (BRIAN_PHONE) cuando se detecta interés real del DM

export async function sendHandoff(prospect) {
  const { sendMessage, sendHandoffNotification } = await import('./transport.js'); // import diferido: evita ciclos con whatsapp.js
  const brianJid = `${process.env.BRIAN_PHONE}@s.whatsapp.net`;

  const dmContacto = prospect.channel === 'email'
    ? prospect.dm_email
    : (prospect.dm_phone || prospect.dm_jid?.split('@')[0] || 'sin número');

  const msg = `Che, revisá esta conversación con ${prospect.agency_name} (${dmContacto}) — puede haber interés 👀`;

  try {
    await sendMessage(brianJid, msg);
  } catch (err) {
    // Si hace más de 24hs que Brian no le escribe al número de Sifer, el texto libre
    // rebota igual que cualquier mensaje frío — hay que mandarle un template en su lugar.
    console.error(`[HANDOFF] Texto libre falló (${err.message}) — probando con template`);
    await sendHandoffNotification(brianJid);
  }
}
