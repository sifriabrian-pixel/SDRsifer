import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

let transporter;
let processedUids = new Set(); // evita reprocesar el mismo correo dos veces en una sesión

export function initEmailTransporter() {
  const port = parseInt(process.env.EMAIL_SMTP_PORT || '465');
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS implícito, 587 = STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  return transporter;
}

// Envía un email. Si messageId/subject vienen, responde en el mismo hilo (In-Reply-To/References)
export async function sendEmail({ to, subject, text, inReplyTo = null }) {
  if (!transporter) initEmailTransporter();

  const fromName = process.env.SDR_NAME || 'Marcos';
  const mailOptions = {
    from: `"${fromName} - Sifer" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  };

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = inReplyTo;
  }

  const info = await transporter.sendMail(mailOptions);
  return info; // info.messageId
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
