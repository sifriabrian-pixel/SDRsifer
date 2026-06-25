import { Resend } from 'resend';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Railway bloquea SMTP saliente (465/587) — se manda por la API HTTP de Resend.
// La recepción sigue por IMAP en Google Workspace (puerto 993, no bloqueado).
let resendClient;

function getResendClient() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

let processedUids = new Set(); // evita reprocesar el mismo correo dos veces en una sesión

// Envía un email vía Resend. Si inReplyTo viene, responde en el mismo hilo (In-Reply-To/References)
export async function sendEmail({ to, subject, text, inReplyTo = null }) {
  const fromName = process.env.SDR_NAME || 'Marcos';
  const headers = {};
  if (inReplyTo) {
    headers['In-Reply-To'] = inReplyTo;
    headers['References'] = inReplyTo;
  }

  const { data, error } = await getResendClient().emails.send({
    from: `${fromName} - Sifer <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    headers,
  });

  if (error) throw new Error(error.message || JSON.stringify(error));
  return { messageId: data?.id };
}

// Escucha la bandeja de entrada con IMAP IDLE y llama onMessage(parsedMail) por cada email nuevo
export async function startEmailListener(onMessage) {
  const client = new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST,
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993'),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    logger: false,
  });

  await client.connect();
  console.log('📧 IMAP conectado — escuchando bandeja de entrada');

  async function checkNewMessages() {
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Buscar no leídos
      const uids = await client.search({ seen: false });
      for (const uid of uids) {
        if (processedUids.has(uid)) continue;
        processedUids.add(uid);

        const message = await client.fetchOne(uid, { source: true });
        const parsed = await simpleParser(message.source);
        await client.messageFlagsAdd(uid, ['\\Seen']);

        try {
          await onMessage(parsed);
        } catch (err) {
          console.error(`[EMAIL ERROR] ${err.message}`);
        }
      }
    } finally {
      lock.release();
    }
  }

  // Revisión inicial
  await checkNewMessages();

  // IMAP IDLE: espera notificaciones del servidor en tiempo real
  client.on('exists', () => {
    checkNewMessages().catch((err) => console.error(`[EMAIL POLL ERROR] ${err.message}`));
  });

  // Fallback: revisar cada 2 minutos por si el IDLE se cae
  setInterval(() => {
    checkNewMessages().catch((err) => console.error(`[EMAIL POLL ERROR] ${err.message}`));
  }, 2 * 60 * 1000);

  return client;
}
