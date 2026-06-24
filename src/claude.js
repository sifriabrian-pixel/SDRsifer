import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5';

async function classify(systemPrompt, userMessage, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const text = response.content[0].text.trim();
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        console.log(`[CLAUDE] Respuesta no-JSON: ${text}`);
        return { raw: text };
      }
    } catch (err) {
      console.error(`[CLAUDE] Error intento ${attempt}/${retries}: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// Detecta si el primer mensaje entrante es de un bot
export async function detectRole(message) {
  const system = `Eres un clasificador para un agente SDR. Analizás mensajes de WhatsApp entrantes de agencias inmobiliarias.

Devolvé SOLO un JSON con este formato exacto:
{"role": "DM" | "GATEKEEPER" | "BOT" | "UNKNOWN"}

DM: habla en primera persona como dueño/director ("yo manejo", "soy el dueño", "soy el director", tono de decisor)
GATEKEEPER: pregunta quién sos, te deriva, habla en plural, pide mail
BOT: respuesta automática con menú de opciones numerado
UNKNOWN: no se puede determinar con certeza`;

  return classify(system, message);
}

// Clasifica la respuesta del portero al mensaje de identificación (Mensaje 2)
export async function classifyGatekeeperReply(message) {
  const system = `Eres un clasificador para un agente SDR inmobiliario. Analizás respuestas de porteros/recepcionistas al mensaje donde el agente se identificó como parte de Sifer y pidió el contacto del director o responsable comercial.

Devolvé SOLO un JSON con este formato exacto:
{
  "action": "GAVE_CONTACT" | "YO_AYUDO" | "QUIERE_INFO" | "MANDAME_INFO" | "NO_CONTACTO" | "PIDE_WEB" | "YA_TIENEN" | "REJECTED" | "UNKNOWN",
  "dm_phone": "<número si lo dieron, o null>",
  "dm_name": "<nombre si lo mencionaron, o null>"
}

GAVE_CONTACT: dieron un número del director/responsable, o dicen que lo van a transferir/derivar internamente
YO_AYUDO: dicen "yo puedo ayudarte", "cuéntame", "comentame", "podés hablar conmigo", "hablá conmigo", "contame más", "en qué te puedo ayudar" — cualquier variante donde el portero se ofrece como interlocutor
QUIERE_INFO: preguntan "¿de qué se trata?", "¿qué resultados?", "¿qué ofrecen?" — quieren más info antes de dar el contacto
MANDAME_INFO: dicen "mándame la información y yo la paso", "mandame un mail", "enviame los detalles", "dejo tu mensaje", "le paso tu mensaje", "se lo hago llegar", "te lo comunico", "le aviso", "pero dejo el mensaje", "lo comunico", "le digo", "se lo digo" — cualquier variante donde ofrecen transmitir el mensaje al director
NO_CONTACTO: dicen que no tienen el dato, no pueden darlo, no saben, o no es su responsabilidad
PIDE_WEB: preguntan por la página web, redes sociales, Instagram, LinkedIn u otras formas de ver más información
YA_TIENEN: dicen "ya tenemos eso", "ya usamos algo similar", "no lo necesitamos", "no nos interesa" — pero sin ser un rechazo rotundo
REJECTED: rechazo explícito y definitivo — "no gracias", "no contactar", "quítenos de su lista", "no molesten"
UNKNOWN: respuesta ambigua que no encaja en ninguna categoría`;

  return classify(system, message);
}

// Califica si el portero que dijo "yo puedo ayudar" es realmente un decisor comercial
export async function classifyPorteroEsDM(message) {
  const system = `Eres un clasificador para un agente SDR. Analizás la respuesta de alguien en una inmobiliaria cuando se le preguntó si lidera el área comercial o toma decisiones sobre las herramientas del equipo de ventas.

Devolvé SOLO un JSON con este formato exacto:
{"is_dm": true | false}

true: confirma que sí lidera el área comercial, es director, dueño, encargado, o toma decisiones sobre herramientas comerciales
false: es asesor, recepcionista, atención al cliente, o claramente no tiene poder de decisión`;

  return classify(system, message);
}

// Clasifica la primera respuesta del DM al mensaje de apertura
export async function classifyDmFirstResponse(message) {
  const system = `Eres un clasificador para un agente SDR inmobiliario. El DM (dueño/director) recibió un mensaje de apertura y respondió.

REGLA PRINCIPAL: casi cualquier respuesta es HANDOFF. Solo hay tres excepciones específicas.

Devolvé SOLO un JSON con este formato exacto:
{"action": "HANDOFF" | "ASK_NUMBER" | "REJECTED" | "MANDAME_INFO"}

HANDOFF: TODO lo que no sea las tres excepciones de abajo — incluyendo "sí", "dale", "cuénteme", cualquier pregunta ("¿cuánto cuesta?", "¿cómo funciona?", "¿qué incluye?"), cualquier interés, confirmación de agenda, o respuesta ambigua/neutral
ASK_NUMBER: pregunta específicamente cómo consiguió su número o quién le dio el contacto
REJECTED: rechazo explícito y definitivo — "no me interesa", "no gracias", "no lo necesitamos", "ya tenemos algo"
MANDAME_INFO: pide explícitamente que le manden información por WhatsApp/mail antes de hablar`;

  return classify(system, message);
}

// Clasifica respuestas de seguimiento del DM (después de 2B o 2D)
export async function classifyDmReply(message, context) {
  const system = `Eres un clasificador para un agente SDR inmobiliario. El DM respondió después de una aclaración del agente.

REGLA PRINCIPAL: casi cualquier respuesta es HANDOFF. Solo dos excepciones.

Contexto: ${context}

Devolvé SOLO un JSON con este formato exacto:
{"action": "HANDOFF" | "REJECTED" | "MANDAME_INFO"}

HANDOFF: cualquier respuesta que no sea rechazo explícito ni pedido de info — incluye preguntas, interés, "ok", "entiendo", respuestas neutrales, confirmaciones
REJECTED: rechazo explícito y definitivo — "no me interesa", "no gracias", "no lo necesitamos"
MANDAME_INFO: pide explícitamente información por WhatsApp/mail antes de hablar`;

  return classify(system, message);
}

// Alias para compatibilidad
export const classifyDmBifurcation = classifyDmFirstResponse;

// Clasifica una respuesta a la secuencia de cold email (Sifer Cold Email v1.0)
export async function classifyColdEmailReply(message) {
  const system = `Eres un clasificador para una secuencia de cold email inmobiliario. Alguien respondió a uno de los correos de la secuencia.

REGLA: la única categoría especial es cuando la persona aclara que ELLA NO es quien toma decisiones comerciales. Cualquier otra respuesta (interés, pregunta, rechazo, lo que sea) es HANDOFF.

Devolvé SOLO un JSON con este formato exacto:
{
  "action": "NOT_DECISION_MAKER" | "HANDOFF",
  "redirect_email": "<email si lo dieron en el mismo mensaje, o null>",
  "redirect_name": "<nombre de la persona indicada, o null>"
}

NOT_DECISION_MAKER: dice explícitamente que no es el director/encargado, que no maneja esas decisiones, o redirige a otra persona ("eso lo maneja fulano", "no soy yo, hablale a...")
HANDOFF: cualquier otra respuesta — interés, pregunta, rechazo, pedido de info, lo que sea`;

  return classify(system, message);
}
