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

// Escucha la bandeja de entrada con IMAP IDLE y llama onMessage(parsedMail) por cada email nuevo.
// Si la conexión se cae (timeout de Gmail, red, etc.) reconecta sola.
export async function startEmailListener(onMessage) {
  let client;
  let reconnecting = false;

  async function checkNewMessages() {
    if (!client?.usable) throw new Error('Connection not available');
    const lock = await client.getMailboxLock('INBOX');
    try {
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

  async function reconnect() {
    if (reconnecting) return;
    reconnecting = true;
    console.log('📧 IMAP desconectado — reconectando en 10s...');
    await new Promise((r) => setTimeout(r, 10000));
    try {
      await connect();
    } catch (err) {
      console.error(`[EMAIL RECONNECT ERROR] ${err.message}`);
      reconnecting = false;
      setTimeout(reconnect, 10000);
    }
  }

  async function connect() {
    client = new ImapFlow({
      host: process.env.EMAIL_IMAP_HOST,
      port: parseInt(process.env.EMAIL_IMAP_PORT || '993'),
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      logger: false,
    });

    client.on('close', () => {
      console.log('📧 IMAP cerró la conexión');
      reconnect();
    });
    client.on('error', (err) => {
      console.error(`[IMAP ERROR] ${err.message}`);
    });

    await client.connect();
    console.log('📧 IMAP conectado — escuchando bandeja de entrada');
    reconnecting = false;

    client.on('exists', () => {
      checkNewMessages().catch((err) => console.error(`[EMAIL POLL ERROR] ${err.message}`));
    });

    await checkNewMessages();
  }

  await connect();

  // Fallback: revisar cada 2 minutos por si el IDLE no avisa
  setInterval(() => {
    checkNewMessages().catch((err) => {
      console.error(`[EMAIL POLL ERROR] ${err.message}`);
      if (err.message === 'Connection not available') reconnect();
    });
  }, 2 * 60 * 1000);

  return client;
}
