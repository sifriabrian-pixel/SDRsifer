// Textos exactos de la secuencia Sifer SDR v1.0 — no modificar sin aprobación de Brian

function casoPorPais(pais) {
  const p = (pais || '').toLowerCase();
  if (p.includes('paraguay') || p === 'py') return 'C21 Seven (PY)';
  if (p.includes('ecuador') || p === 'ec') return 'Remax Impacta (EC)';
  if (p.includes('mexico') || p.includes('méxico') || p === 'mx') return 'Allegra Inmobiliaria (MX)';
  return 'otras inmobiliarias de la región';
}

// ETAPA 1 — Mensaje 1: apertura corta para activar humano y romper bot
export const FASE1_INICIAL = `Buen día ¿Cómo están? Queria hacer una consulta`;

// ETAPA 1 — Mensaje 2: identificación + pedido al DM
export const FASE2_PORTERO_PRINCIPAL = (pais) => {
  return `Un gusto saludarte, Mi nombre es Brian, soy del equipo de Sifer. Nos especializamos en ayudar a inmobiliarias de la región a mejorar la captación, atención y el seguimiento de sus potenciales clientes de manera totalmente automática.\n\nQuería comunicarme con el director o responsable comercial de la oficina para contarle brevemente sobre los resultados que estamos viendo con otras inmobiliarias en ${pais}.\n\n¿Me podrían ayudar a contactarlo?`;
};

// ETAPA 1 — Bifurcaciones del portero
export const FASE2_OBJECIONES = {
  // 3A: preguntan "¿de qué se trata?" o "¿qué resultados?"
  que_se_trata: (pais) =>
    `Claro, te comento! Somos un sistema comercial completo especificamente para el mercado inmobiliario — combinamos pauta publicitaria segmentada con el objetivo de llevarle a tu equipo leads calificados todos los dias con un agente de IA que atiende ,da seguimiento 24/7 y se lo deriva a tu equipo comercial cuando estan calificados. Para ver si aplica a su operación necesito hablar con quien maneja el área comercial o la oficina en general para conocer mas a fondo como trabajan. ¿Me podés pasar su contacto?`,

  // 3B: portero dice "yo puedo ayudarte" → preguntar si es decisor
  calificar_portero: () =>
    `Perfecto! Antes de contarte, ¿vos liderás el área comercial o tomás decisiones sobre las herramientas que usa el equipo de ventas?`,

  // 3B-no: portero no es decisor
  no_es_decisor: () =>
    `Gracias por la disposición! El tema requiere una conversación un poco más estratégica, así que necesito hablarlo con quien toma ese tipo de decisiones. ¿Podrías pasarme el contacto del director o encargado comercial?`,

  // 3C: dicen "mándame la info y yo la paso"
  mandame_info: (pais) =>
    `¡Claro, con gusto! 😊\n\nSomos Sifer, trabajamos con inmobiliarias en ${pais} para que su equipo de asesores siempre tenga prospectos activos para contactar. Lo hacemos combinando captación con Meta Ads, calificación automática con IA y un sistema de seguimiento comercial.\n\nLo están usando +50 inmobiliarias, y lo que más valoran es que dejaron de perder leads por falta de seguimiento.\n\nSi le podés comentar esto al director o encargado comercial, estaría buenísimo. Y si me podés pasar su contacto directo, mejor todavía así le escribo yo y no le generamos trabajo extra a vos. ¿Cómo lo ves? 🙏`,

  // 3C-bis: confirman que ya le pasaron el mensaje al director (no repetir la info)
  ya_lo_pase: () =>
    `Muchas gracias! 🙏 Quedo atento a lo que me pueda contar.`,

  // 3D: no tienen el contacto o no pueden darlo
  no_contacto: () =>
    `Entiendo perfectamente, no hay problema. ¿Sabrías al menos el nombre del director o responsable? Con eso ya me ayudás mucho.`,

  // 3E: piden web, información o redes sociales
  piden_web: () =>
    `Claro! Pueden ver más en sifer.pro 👇 Ahí tienen casos de uso y cómo trabajamos con inmobiliarias de la región. Si le llega a interesar al director, con gusto le cuento en detalle. ¿Hay forma de contactarlo directamente?`,

  // Fallback cuando no dan absolutamente nada (3D/3E sin datos)
  no_dan_nada: (pais) => {
    return `Entiendo, gracias igual. Si pudiera hacerle llegar esto de mi parte le agradezco:\n\n"Hola, le escribe Brian de Sifer. Trabajamos con inmobiliarias en ${pais} para que el equipo de asesores siempre tenga prospectos activos. Otros directores de la región nos pidieron 20 minutos y los resultados los sorprendieron. Si le interesa, con gusto lo contacto. Gracias!"`;
  },

  // 3F: dicen "ya tenemos ese servicio" / "no nos interesa" / "no lo necesitamos"
  ya_tienen: () =>
    `Perfecto, con gusto lo tomo en cuenta. Igual me gustaría comentárselo al director o encargado, porque lo que hacemos tiene bastantes diferencias con lo que hay en el mercado y estoy seguro que notará el valor. ¿Me podrias pasar su contacto? 🙏`,

  // 3F variante si insisten (segunda vez)
  ya_tienen_insiste: () =>
    `Entendido, no hay problema. Si en algún momento el director quiere revisarlo, pueden escribirnos a sifer.pro. Que tengan buen día 👋`,

  // Fallback genérico
  quienes_son: (pais) =>
    `¡Claro! Somos Sifer, trabajamos con inmobiliarias en ${pais} para que su equipo de asesores siempre tenga prospectos activos para contactar, reduciendo la pérdida de leads por falta de seguimiento.\n\nPor eso prefiero explicárselo directamente al director o encargado. ¿Hay forma de contactarlo?`,
};

// Mensaje de cierre al portero cuando da el contacto del DM
export const FASE2_CIERRE_PORTERO = `Muchísimas gracias, muy amable! 🙏 Le escribo directamente entonces.`;

// Mensaje 2B — follow up si no responden en 24hs (se envía una sola vez)
export const FASE2_FOLLOWUP = `Hola, quería saber si pudieron ver mi mensaje de ayer 😊 ¿Hay posibilidad de contactar al director o encargado comercial?`;

// ETAPA 2 — Mensaje 1A: contacto directo al DM (portero dio número)
export const FASE3_APERTURA = (dmName, pais) => {
  const usarNombre = dmName && dmName !== 'hola' && dmName !== 'te';
  const saludo = usarNombre ? `Buen día ${dmName}! 👋` : `Buen día! 👋`;
  return `${saludo} Le escribo de parte de Sifer, Brian es mi nombre.Te escribo porque trabajamos con inmobiliarias de la región con un sistema Comercial que les genera y atiende, todos los meses, potenciales clientes calificados para tu equipo de vendedores
¿Te parece si te cuento brevemente como lo hacemos y si te interesa coordinamos una reunión?`;
};

// ETAPA 2 — Mensaje 1B: el portero confirmó ser DM (3B) — pitch directo en tuteo
export const FASE3_APERTURA_B = () =>
  `Genial , Te cuento rápido : no somos una agencia de marketing ni una herramienta suelta
Somos un sistema comercial completo especificamente para el mercado inmobiliario — combinamos pauta publicitaria segmentada con el objetivo de llevarle a tu equipo leads calificados todos los dias con un agente de IA que atiende ,da seguimiento 24/7 y se lo deriva a tu equipo comercial cuando estan calificados, todo integrado en un mismo proceso, sin que nada se pierda entre la generación y el cierre\n\n¿Tenés 20 minutos esta semana para verlo aplicado a tu operación?`;

// ETAPA 2 — 2A: pitch completo (enviado cuando el DM responde al 1A con interés/pregunta)
export const FASE3_PITCH = (pais) =>
  `Básicamente combinamos tres cosas:\n\n📌 Captación de leads por Meta Ads\n📌 Calificación automática con IA para que ningún lead quede sin respuesta\n📌 Sistema de seguimiento estructurado para el equipo comercial\n\nLo está usando ${casoPorPais(pais)}, y el principal cambio que reportan es que los asesores dejaron de perder leads por falta de seguimiento.\n\n¿Tiene 20 minutos esta semana para verlo en detalle?`;

// ETAPA 2 — Respuestas a objeciones del DM
export const FASE3_OBJECIONES = {
  // 2B: ¿cómo consiguió mi número?
  como_conseguiste_numero: () =>
    `Me lo facilitaron desde su oficina cuando los contacté al número principal. Trabajo con inmobiliarias de la región y prefiero siempre llegar directamente a quien puede hacerle sentido revisar este tipo de soluciones comerciales.`,

  // 2C: no me interesa / ya tenemos herramientas
  no_interesa: () =>
    `Totalmente válido. No es para todas las operaciones.\n\nSolo le comento que el problema que más resuelven con nosotros no es la falta de herramientas, sino los leads que ya llegan y se pierden porque el equipo no llega a hacer el seguimiento a tiempo.\n\nSi en algún momento quiere revisarlo, quedo a disposición. 👋`,

  // 2D: mándame información por este medio
  mandame_info: () =>
    `Con gusto! Aunque para ser honesto, funciona mucho mejor verlo en una llamada corta porque depende de cómo está organizado su equipo hoy.\n\n¿Tiene 20 minutos esta semana? Si no encaja ahora, me avisa cuando sea mejor momento y coordinamos sin problema.`,
};
