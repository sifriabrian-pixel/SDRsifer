// Secuencia de email — misma lógica que WhatsApp, adaptada al formato de correo (con asunto)

function casoPorPais(pais) {
  const p = (pais || '').toLowerCase();
  if (p.includes('paraguay') || p === 'py') return 'C21 Seven (PY)';
  if (p.includes('ecuador') || p === 'ec') return 'Remax Impacta (EC)';
  if (p.includes('mexico') || p.includes('méxico') || p === 'mx') return 'Allegra Inmobiliaria (MX)';
  return 'otras inmobiliarias de la región';
}

// Mensaje 1 — primer contacto por email (no necesita "romper bot", va directo)
export const EMAIL_FASE1 = (pais) => {
  const nombre = process.env.SDR_NAME || 'Marcos';
  return {
    subject: `Captación de clientes para inmobiliarias en ${pais}`,
    text: `Hola, ¿cómo están?\n\nMi nombre es ${nombre}, soy del equipo de Sifer. Nos especializamos en ayudar a inmobiliarias de la región a mejorar la captación, atención y el seguimiento de sus potenciales clientes de manera totalmente automática.\n\nQuería comunicarme con el director o responsable comercial de la oficina para contarle brevemente sobre los resultados que estamos viendo con otras inmobiliarias en ${pais}.\n\n¿Me podrían ayudar a contactarlo?\n\nSaludos,\n${nombre}\nSifer`,
  };
};

// Respuestas tipo portero (mismo árbol que WhatsApp, en formato email)
export const EMAIL_OBJECIONES = {
  que_se_trata: (pais) =>
    `Claro, te comento. Trabajamos con inmobiliarias en ${pais} y lo que más logran es que los asesores siempre tengan prospectos activos para contactar, sin perder leads por falta de seguimiento.\n\nPara ver si aplica a su operación necesito hablar con quien maneja el área comercial o la oficina en general. ¿Me podés pasar su contacto o su email directo?`,

  mandame_info: (pais) =>
    `Claro, con gusto.\n\nSomos Sifer, trabajamos con inmobiliarias en ${pais} para que su equipo de asesores siempre tenga prospectos activos para contactar. Lo hacemos combinando captación con Meta Ads, calificación automática con IA y un sistema de seguimiento comercial.\n\nLo están usando +50 inmobiliarias, y lo que más valoran es que dejaron de perder leads por falta de seguimiento.\n\nSi le podés comentar esto al director o encargado comercial, estaría buenísimo. Y si me podés pasar su contacto directo, mejor todavía. ¿Cómo lo ves?`,

  no_contacto: () =>
    `Entiendo perfectamente, no hay problema. ¿Sabrías al menos el nombre del director o responsable? Con eso ya me ayudás mucho.`,

  piden_web: () =>
    `Claro, pueden ver más en sifer.pro. Ahí tienen casos de uso y cómo trabajamos con inmobiliarias de la región. Si le llega a interesar al director, con gusto le cuento en detalle. ¿Hay forma de contactarlo directamente?`,

  ya_tienen: () =>
    `Perfecto, con gusto lo tomo en cuenta. Igual me gustaría comentárselo al director o encargado, porque lo que hacemos tiene bastantes diferencias con lo que hay en el mercado. ¿Me podrías pasar su contacto?`,

  ya_tienen_insiste: () =>
    `Entendido, no hay problema. Si en algún momento el director quiere revisarlo, pueden escribirnos a sifer.pro. Que tengan buen día.`,

  quienes_son: (pais) =>
    `Somos Sifer, trabajamos con inmobiliarias en ${pais} para que su equipo de asesores siempre tenga prospectos activos para contactar, reduciendo la pérdida de leads por falta de seguimiento.\n\nPrefiero explicárselo directamente al director o encargado. ¿Hay forma de contactarlo?`,
};

// Follow-up si no responden en 48hs (el doble que WhatsApp — email es más lento)
export const EMAIL_FOLLOWUP = () => ({
  subject: `Re: seguimiento — Sifer`,
  text: `Hola, quería saber si pudieron ver mi correo anterior. ¿Hay posibilidad de contactar al director o encargado comercial?\n\nSaludos.`,
});

// Mensaje al DM (directo, una vez que tenemos su email)
export const EMAIL_DM_APERTURA = (dmName, pais) => {
  const nombre = process.env.SDR_NAME || 'Marcos';
  const saludo = dmName && dmName !== 'hola' ? `Hola ${dmName}` : 'Hola';
  return {
    subject: `Captación de clientes para tu inmobiliaria — Sifer`,
    text: `${saludo}, le escribo de parte de Sifer, ${nombre} es mi nombre.\n\nMe contacté con su oficina porque trabajamos con inmobiliarias en ${pais} ayudando a que los asesores siempre tengan prospectos activos para contactar, sin depender solo de los portales.\n\n¿Le cuento brevemente cómo lo hacemos?\n\nSaludos,\n${nombre}\nSifer`,
  };
};

export const EMAIL_DM_PITCH = (pais) =>
  `Básicamente combinamos tres cosas:\n\n- Captación de leads por Meta Ads\n- Calificación automática con IA para que ningún lead quede sin respuesta\n- Sistema de seguimiento estructurado para el equipo comercial\n\nLo está usando ${casoPorPais(pais)}, y el principal cambio que reportan es que los asesores dejaron de perder leads por falta de seguimiento.\n\n¿Tiene 20 minutos esta semana para verlo en detalle?`;

export const EMAIL_DM_OBJECIONES = {
  como_conseguiste_numero: () =>
    `Me lo facilitaron desde su oficina cuando los contacté por correo. Trabajo con inmobiliarias de la región y prefiero siempre llegar directamente a quien puede hacerle sentido revisar este tipo de soluciones comerciales.`,

  no_interesa: () =>
    `Totalmente válido. No es para todas las operaciones.\n\nSolo le comento que el problema que más resuelven con nosotros no es la falta de herramientas, sino los leads que ya llegan y se pierden porque el equipo no llega a hacer el seguimiento a tiempo.\n\nSi en algún momento quiere revisarlo, quedo a disposición.`,

  mandame_info: () =>
    `Con gusto. Aunque para ser honesto, funciona mucho mejor verlo en una llamada corta porque depende de cómo está organizado su equipo hoy.\n\n¿Tiene 20 minutos esta semana? Si no encaja ahora, me avisa cuando sea mejor momento.`,
};
