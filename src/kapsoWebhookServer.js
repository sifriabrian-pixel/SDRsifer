// Servidor HTTP que recibe los webhooks de Kapso/Meta con los mensajes entrantes.
// IMPORTANTE: el formato exacto del payload lo vamos a confirmar con el primer mensaje
// real que llegue (se loguea crudo abajo con [KAPSO-RAW]) — normalizeWebhook() asume
// el formato estándar de Meta reenviado por Kapso; si Kapso usa su propio formato de
// evento, hay que ajustar el parseo acá una vez que veamos un ejemplo real.

import express from 'express';
import { normalizeWebhook, verifySignature } from '@kapso/whatsapp-cloud-api/server';
import { handleIncomingKapso } from './kapsoRouter.js';

export function startKapsoServer() {
  const app = express();
  // Railway asigna el puerto en process.env.PORT — WEBHOOK_PORT es solo para correrlo local
  const port = process.env.PORT || process.env.WEBHOOK_PORT || 3000;

  // Handshake de verificación (solo aplica si se suscribe directo a Meta)
  app.get('/webhook', (req, res) => {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (verifyToken && req.query['hub.verify_token'] === verifyToken) {
      res.send(req.query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
  });

  app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const appSecret = process.env.KAPSO_WEBHOOK_APP_SECRET;
    if (appSecret) {
      const ok = verifySignature({
        appSecret,
        rawBody: req.body,
        signatureHeader: req.headers['x-hub-signature-256'],
      });
      if (!ok) return res.status(401).end();
    }

    res.sendStatus(200); // responder rápido, procesar después

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      console.error('[KAPSO] payload no es JSON válido');
      return;
    }

    console.log('[KAPSO-RAW]', JSON.stringify(payload).slice(0, 800));

    try {
      const events = normalizeWebhook(payload);
      for (const message of events.messages || []) {
        if (message.type === 'text' && message.kapso?.direction === 'inbound') {
          await handleIncomingKapso(message.from, message.text?.body || '');
        }
      }
    } catch (err) {
      console.error('[KAPSO] Error normalizando webhook (revisar formato del payload arriba):', err.message);
    }
  });

  app.listen(port, () => console.log(`[KAPSO] Webhook escuchando en puerto ${port} — ruta /webhook`));
}
