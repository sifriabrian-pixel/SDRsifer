import { updateProspect } from './db.js';
import { sendMessage } from './whatsapp.js';
import { sendHandoff } from './notifier.js';
import {
  classifyGatekeeperReply,
  classifyPorteroEsDM,
  classifyDmFirstResponse,
  classifyDmReply,
} from './claude.js';
import {
  FASE2_PORTERO_PRINCIPAL,
  FASE2_OBJECIONES,
  FASE2_CIERRE_PORTERO,
  FASE3_APERTURA,
  FASE3_APERTURA_B,
  FASE3_PITCH,
  FASE3_OBJECIONES,
} from '../data/sequences.js';

function appendNote(existing, note) {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${existing || ''}\n[${ts}] ${note}`.trim();
}

function typingDelay() {
  const ms = 3000 + Math.floor(Math.random() * 5000); // 3–8 segundos
  return new Promise(r => setTimeout(r, ms));
}

export async function handleMessage(prospect, incomingText, fromJid) {
  await typingDelay();
  const { stage, country, dm_name, notes } = prospect;
  const pais = country || '[país]';

  // ─── FASE 1: respuesta al saludo inicial — siempre enviar Mensaje 2 ─────────
  if (stage === 'FASE1_SENT') {
    await updateProspect(prospect.id, {
      stage: 'FASE2_PORTERO',
      gatekeeper_jid: fromJid,
      last_reply_at: new Date().toISOString(),
    });
    await sendMessage(fromJid, FASE2_PORTERO_PRINCIPAL(pais));
    await updateProspect(prospect.id, { last_message_at: new Date().toISOString() });
    return;
  }

  // ─── FASE 2: respuesta al mensaje de identificación ──────────────────────
  if (stage === 'FASE2_PORTERO' || stage === 'FASE2_OBJECION') {
    const result = await classifyGatekeeperReply(incomingText);

    if (result.action === 'GAVE_CONTACT') {
      const dmPhone = result.dm_phone;
      const dmName = result.dm_name || null;

      if (dmPhone) {
        const dmJid = `${dmPhone.replace(/\D/g, '')}@s.whatsapp.net`;
        await updateProspect(prospect.id, {
          stage: 'FASE3_APERTURA',
          dm_phone: dmPhone,
          dm_name: dmName,
          dm_jid: dmJid,
          last_reply_at: new Date().toISOString(),
          notes: appendNote(notes, `Portero dio contacto: ${dmPhone} (${dmName || 'sin nombre'})`),
        });
        await sendMessage(fromJid, FASE2_CIERRE_PORTERO);
        await sendMessage(dmJid, FASE3_APERTURA(dmName, pais));
        await updateProspect(prospect.id, {
          stage: 'FASE3_BIFURCACION',
          last_message_at: new Date().toISOString(),
        });
      } else {
        // Derivación interna — el DM va a responder en este mismo chat
        await updateProspect(prospect.id, {
          stage: 'FASE3_APERTURA',
          dm_name: dmName,
          last_reply_at: new Date().toISOString(),
          notes: appendNote(notes, `Portero deriva internamente al DM`),
        });
        await sendMessage(fromJid, FASE3_APERTURA(dmName, pais));
        await updateProspect(prospect.id, {
          stage: 'FASE3_BIFURCACION',
          dm_jid: fromJid,
          last_message_at: new Date().toISOString(),
        });
      }
      return;
    }

    if (result.action === 'YO_AYUDO') {
      // Portero dice "yo puedo ayudarte" → calificar si es decisor
      await sendMessage(fromJid, FASE2_OBJECIONES.calificar_portero());
      await updateProspect(prospect.id, {
        stage: 'FASE2_CALIFICANDO',
        last_message_at: new Date().toISOString(),
        last_reply_at: new Date().toISOString(),
        notes: appendNote(notes, `Portero se ofreció a escuchar — calificando si es decisor`),
      });
      return;
    }

    if (result.action === 'QUIERE_INFO') {
      await sendMessage(fromJid, FASE2_OBJECIONES.que_se_trata(pais));
      await updateProspect(prospect.id, {
        stage: 'FASE2_PORTERO',
        last_message_at: new Date().toISOString(),
        last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'MANDAME_INFO') {
      await sendMessage(fromJid, FASE2_OBJECIONES.mandame_info(pais));
      await updateProspect(prospect.id, {
        stage: 'FASE2_PORTERO',
        last_message_at: new Date().toISOString(),
        last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'NO_CONTACTO') {
      await sendMessage(fromJid, FASE2_OBJECIONES.no_contacto());
      await updateProspect(prospect.id, {
        stage: 'FASE2_PORTERO',
        last_message_at: new Date().toISOString(),
        last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'PIDE_WEB') {
      await sendMessage(fromJid, FASE2_OBJECIONES.piden_web());
      await updateProspect(prospect.id, {
        stage: 'FASE2_PORTERO',
        last_message_at: new Date().toISOString(),
        last_reply_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'YA_TIENEN') {
      await sendMessage(fromJid, FASE2_OBJECIONES.ya_tienen());
      await updateProspect(prospect.id, {
        stage: 'FASE2_YA_TIENEN',
        last_message_at: new Date().toISOString(),
        last_reply_at: new Date().toISOString(),
        notes: appendNote(notes, `Portero dijo "ya tienen" — enviada respuesta 3F`),
      });
      return;
    }

    if (result.action === 'REJECTED') {
      const rejections = (prospect.rejection_count || 0) + 1;
      if (rejections >= 2) {
        await updateProspect(prospect.id, {
          stage: 'DISCARDED',
          rejection_count: rejections,
          notes: appendNote(notes, `Descartado: portero rechazó ${rejections} veces`),
        });
        console.log(`[DISCARDED] ${prospect.agency_name} — portero rechazó`);
      } else {
        await updateProspect(prospect.id, { rejection_count: rejections });
      }
      return;
    }

    // UNKNOWN → fallback genérico
    await sendMessage(fromJid, FASE2_OBJECIONES.quienes_son(pais));
    await updateProspect(prospect.id, {
      stage: 'FASE2_PORTERO',
      last_message_at: new Date().toISOString(),
    });
    return;
  }

  // ─── FASE 2 YA TIENEN: portero dijo "ya tenemos", le pedimos igual el DM ────
  if (stage === 'FASE2_YA_TIENEN') {
    const result = await classifyGatekeeperReply(incomingText);

    if (result.action === 'GAVE_CONTACT') {
      const dmPhone = result.dm_phone;
      const dmName = result.dm_name || null;
      if (dmPhone) {
        const dmJid = `${dmPhone.replace(/\D/g, '')}@s.whatsapp.net`;
        await updateProspect(prospect.id, {
          stage: 'FASE3_APERTURA',
          dm_phone: dmPhone,
          dm_name: dmName,
          dm_jid: dmJid,
          last_reply_at: new Date().toISOString(),
          notes: appendNote(notes, `Portero dio contacto tras 3F: ${dmPhone}`),
        });
        await sendMessage(fromJid, FASE2_CIERRE_PORTERO);
        await sendMessage(dmJid, FASE3_APERTURA(dmName, pais));
        await updateProspect(prospect.id, { stage: 'FASE3_BIFURCACION', last_message_at: new Date().toISOString() });
      } else {
        await updateProspect(prospect.id, {
          stage: 'FASE3_APERTURA',
          dm_name: dmName,
          dm_jid: fromJid,
          last_reply_at: new Date().toISOString(),
          notes: appendNote(notes, `Portero deriva internamente tras 3F`),
        });
        await sendMessage(fromJid, FASE3_APERTURA(dmName, pais));
        await updateProspect(prospect.id, { stage: 'FASE3_BIFURCACION', last_message_at: new Date().toISOString() });
      }
      return;
    }

    // Si insisten con rechazo → cierre limpio
    await sendMessage(fromJid, FASE2_OBJECIONES.ya_tienen_insiste());
    await updateProspect(prospect.id, {
      stage: 'DISCARDED',
      notes: appendNote(notes, `Descartado: portero insistió en "ya tenemos"`),
    });
    console.log(`[DISCARDED] ${prospect.agency_name} — portero insistió`);
    return;
  }

  // ─── FASE 2 CALIFICANDO: portero dijo "yo ayudo", preguntamos si es decisor ─
  if (stage === 'FASE2_CALIFICANDO') {
    const { is_dm } = await classifyPorteroEsDM(incomingText);

    if (is_dm) {
      // Es el DM → enviar 1B (pitch directo en tuteo) y esperar su respuesta
      await updateProspect(prospect.id, {
        stage: 'FASE3_APERTURA',
        dm_jid: fromJid,
        last_reply_at: new Date().toISOString(),
        notes: appendNote(notes, `Portero confirmó ser decisor — enviando pitch 1B`),
      });
      await sendMessage(fromJid, FASE3_APERTURA_B());
      await updateProspect(prospect.id, {
        stage: 'FASE3_BIFURCACION_B',
        last_message_at: new Date().toISOString(),
      });
    } else {
      // No es decisor → pedir contacto del director
      await sendMessage(fromJid, FASE2_OBJECIONES.no_es_decisor());
      await updateProspect(prospect.id, {
        stage: 'FASE2_PORTERO',
        last_message_at: new Date().toISOString(),
        last_reply_at: new Date().toISOString(),
        notes: appendNote(notes, `Portero no es decisor — pidiendo contacto del director`),
      });
    }
    return;
  }

  // ─── FASE 3 BIFURCACIÓN 1A: DM respondió al mensaje de apertura (1A) ───────
  if (stage === 'FASE3_BIFURCACION') {
    const result = await classifyDmFirstResponse(incomingText);
    await updateProspect(prospect.id, {
      last_reply_at: new Date().toISOString(),
      notes: appendNote(notes, `DM respondió 1A: ${result.action}`),
    });

    if (result.action === 'HANDOFF') {
      // Cualquier respuesta positiva/neutra → enviar pitch 2A y handoff
      await sendMessage(fromJid, FASE3_PITCH(pais));
      await updateProspect(prospect.id, {
        stage: 'HANDED_OFF',
        last_message_at: new Date().toISOString(),
        notes: appendNote(notes, `HANDOFF — pitch 2A enviado — Brian toma la conversación`),
      });
      await sendHandoff({ ...prospect, stage: 'HANDED_OFF' });
      console.log(`[HANDOFF] ${prospect.agency_name} — DM respondió al 1A`);
      return;
    }

    if (result.action === 'ASK_NUMBER') {
      await sendMessage(fromJid, FASE3_OBJECIONES.como_conseguiste_numero());
      await updateProspect(prospect.id, {
        stage: 'FASE3_OBJECION',
        last_message_at: new Date().toISOString(),
      });
      return;
    }

    if (result.action === 'REJECTED') {
      await sendMessage(fromJid, FASE3_OBJECIONES.no_interesa());
      await updateProspect(prospect.id, {
        stage: 'DISCARDED',
        notes: appendNote(notes, `DM rechazó — mensaje de cierre enviado`),
      });
      console.log(`[DISCARDED] ${prospect.agency_name} — DM rechazó`);
      return;
    }

    if (result.action === 'MANDAME_INFO') {
      await sendMessage(fromJid, FASE3_OBJECIONES.mandame_info());
      await updateProspect(prospect.id, {
        stage: 'FASE3_OBJECION',
        last_message_at: new Date().toISOString(),
      });
      return;
    }
    return;
  }

  // ─── FASE 3 BIFURCACIÓN 1B: DM respondió al pitch directo (portero era DM) ─
  if (stage === 'FASE3_BIFURCACION_B') {
    const result = await classifyDmFirstResponse(incomingText);
    await updateProspect(prospect.id, {
      last_reply_at: new Date().toISOString(),
      notes: appendNote(notes, `DM respondió 1B: ${result.action}`),
    });

    if (result.action === 'REJECTED') {
      await sendMessage(fromJid, FASE3_OBJECIONES.no_interesa());
      await updateProspect(prospect.id, {
        stage: 'DISCARDED',
        notes: appendNote(notes, `DM rechazó pitch 1B`),
      });
      console.log(`[DISCARDED] ${prospect.agency_name} — DM rechazó 1B`);
      return;
    }

    // Todo lo demás (HANDOFF, ASK_NUMBER, MANDAME_INFO) → handoff a Brian
    // El pitch ya fue enviado en 1B, Brian continúa desde aquí
    await updateProspect(prospect.id, {
      stage: 'HANDED_OFF',
      notes: appendNote(notes, `HANDOFF — DM respondió al pitch 1B — Brian toma la conversación`),
    });
    await sendHandoff({ ...prospect, stage: 'HANDED_OFF' });
    console.log(`[HANDOFF] ${prospect.agency_name} — DM respondió al pitch 1B`);
    return;
  }

  // ─── FASE 3 OBJECIÓN: seguimiento con el DM (después de 2B o 2D) ─────────
  if (stage === 'FASE3_OBJECION') {
    const context = prospect.notes || '';
    const result = await classifyDmReply(incomingText, context);
    await updateProspect(prospect.id, {
      last_reply_at: new Date().toISOString(),
      notes: appendNote(notes, `DM seguimiento: "${incomingText.slice(0, 80)}"`),
    });

    if (result.action === 'REJECTED') {
      await sendMessage(fromJid, FASE3_OBJECIONES.no_interesa());
      await updateProspect(prospect.id, {
        stage: 'DISCARDED',
        notes: appendNote(notes, `DM rechazó en seguimiento`),
      });
      console.log(`[DISCARDED] ${prospect.agency_name}`);
      return;
    }

    if (result.action === 'MANDAME_INFO') {
      await sendMessage(fromJid, FASE3_OBJECIONES.mandame_info());
      await updateProspect(prospect.id, { last_message_at: new Date().toISOString() });
      return;
    }

    // HANDOFF o cualquier otra respuesta → Brian toma la conversación
    await updateProspect(prospect.id, {
      stage: 'HANDED_OFF',
      notes: appendNote(notes, `HANDOFF — DM respondió en seguimiento — Brian toma la conversación`),
    });
    await sendHandoff({ ...prospect, stage: 'HANDED_OFF' });
    console.log(`[HANDOFF] ${prospect.agency_name} — handoff en seguimiento`);
    return;
  }
}
