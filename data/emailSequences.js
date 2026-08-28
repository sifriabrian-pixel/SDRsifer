// Secuencia Cold Email — Sifer v1.0
// 4 toques en días fijos (1, 3, 10, 17) — cualquier respuesta detiene la secuencia (handoff)

function casoPorPais(pais) {
  const p = (pais || '').toLowerCase();
  if (p.includes('paraguay') || p === 'py') return 'C21 Seven';
  if (p.includes('ecuador') || p === 'ec') return 'RE/MAX Impacta';
  if (p.includes('mexico') || p.includes('méxico') || p === 'mx') return 'Allegra';
  if (p.includes('argentina') || p === 'ar') return 'Oficinas de RE/MAX';
  return 'C21 Seven';
}

function saludo(dmName, email, agencyName) {
  // Si hay nombre explícito del DM, usarlo
  if (dmName && dmName.trim()) return `Hola ${dmName.trim()},`;
  // Si el email tiene un nombre personal (alex@remax.com → "Alex")
  if (email) {
    const local = email.split('@')[0].toLowerCase();
    const genericos = ['info', 'contacto', 'contact', 'ventas', 'admin', 'oficina', 'hello', 'hola', 'hello', 'soporte'];
    if (!genericos.some(g => local.startsWith(g))) {
      // Es un nombre personal — capitalizar primera letra
      const nombre = local.charAt(0).toUpperCase() + local.slice(1).split('.')[0];
      return `Hola ${nombre},`;
    }
  }
  // Email genérico — usar nombre de la agencia si está disponible
  if (agencyName && agencyName.trim()) return `Hola equipo de ${agencyName.trim()},`;
  return 'Hola,';
}

const FIRMA = () => {
  const nombre = process.env.SDR_NAME || 'Brian';
  return `${nombre} — Sifer\nsifer.pro`;
};

// EMAIL 1 — Día 1
export const EMAIL_TOQUE_1 = (pais, dmName) => {
  const caso = casoPorPais(pais);
  return {
    subject: `Cómo ${caso} agendó +25 visitas en 60 días sin agregar asesores`,
    text: `${saludo(dmName)}\n\n${caso} tenía el mismo problema que la mayoría de las inmobiliarias en ${pais}: leads que llegaban y se perdían porque el equipo no llegaba a hacer el seguimiento a tiempo.\n\nImplementamos un sistema de captación + respuesta automática con IA y en 60 días agendaron +25 visitas nuevas — sin contratar a nadie más.\n\n¿Tiene 20 minutos esta semana para ver si aplica a su operación?\n\n${FIRMA()}\n\n¿No es usted quien toma este tipo de decisiones? Me indica a quién escribirle y le contacto directamente.`,
  };
};

// EMAIL 2 — Día 3 (mismo hilo, "Re:")
export const EMAIL_TOQUE_2 = (pais, dmName) => {
  return {
    subjectPrefix: 'Re: ',
    text: `${saludo(dmName)}\n\nLe sigo de cerca porque me parece que lo que hacemos tiene sentido para una operación como la suya.\n\nLa pregunta que más nos hacen los directores antes de vernos es: "¿Y esto funciona para equipos chicos?"\n\nSí. De hecho es donde más se nota — porque cuando el equipo es chico, cada lead perdido es una venta que no existió.\n\n¿Le sirve hablar 20 minutos esta semana?\n\n${FIRMA()}`,
  };
};

// EMAIL 3 — Día 10
export const EMAIL_TOQUE_3 = (pais, dmName) => {
  return {
    subject: `El problema no es la cantidad de leads`,
    text: `${saludo(dmName)}\n\nUn patrón que vemos seguido en inmobiliarias de ${pais}:\n\nInvierten en portales, en publicidad, en ferias — y los leads llegan. El problema es que el 60–70% de esos leads nunca recibe seguimiento antes de que se enfríen.\n\nNo porque el equipo no quiera. Sino porque no hay un sistema que lo haga automáticamente.\n\nEso es exactamente lo que resolvemos en Sifer.\n\n¿Tiene 20 minutos esta semana para verlo aplicado a su operación?\n\n${FIRMA()}`,
  };
};

// EMAIL 4 — Día 17 (último)
export const EMAIL_TOQUE_4 = (pais, dmName) => {
  return {
    subject: `Último mensaje de mi parte`,
    text: `${saludo(dmName)}\n\nLe mandé algunos mensajes las últimas semanas y entiendo que quizás no es el momento o no es algo que le genere interés ahora.\n\nSolo quería decirle que si en algún momento quiere revisar cómo mejorar la captación y el seguimiento de leads en su oficina, quedamos disponibles en sifer.pro.\n\nLo que hacemos tiene resultados concretos en inmobiliarias de ${pais} — cuando sea el momento, con gusto hablamos.\n\n${FIRMA()}`,
  };
};

// Respuesta cuando dicen que no son el decisor
export const EMAIL_NO_ES_DECISOR = () =>
  `Entendido, gracias! ¿Me podría pasar el contacto (email) de la persona que toma esas decisiones para escribirle directamente?`;

// ─── SECUENCIA FRANQUICIAS (RE/MAX y Century 21) ───────────────────────────
// Ángulo: retención y atracción de asesores · Días 1, 3, 8, 15

function casoFranquicia(franquicia) {
  const f = (franquicia || '').toLowerCase();
  if (f.includes('remax') || f.includes('re/max') || f.includes('re max')) return 'RE/MAX Impacta';
  if (f.includes('century') || f.includes('c21')) return 'C21 Seven';
  return 'RE/MAX Impacta';
}

function nombreFranquicia(franquicia) {
  const f = (franquicia || '').toLowerCase();
  if (f.includes('remax') || f.includes('re/max') || f.includes('re max')) return 'RE/MAX';
  if (f.includes('century') || f.includes('c21')) return 'C21';
  return 'RE/MAX';
}

function pruebaFranquicia(franquicia) {
  const f = (franquicia || '').toLowerCase();
  if (f.includes('remax') || f.includes('re/max') || f.includes('re max'))
    return 'RE/MAX Impacta: agendaron +25 visitas en 60 días sin sumar un solo asesor nuevo al equipo.';
  return 'C21 Seven: 44 asesores integrados al sistema en Paraguay, sin fricciones.';
}

// FRANQUICIA TOQUE 1 — Día 1
export const EMAIL_FRANQUICIA_TOQUE_1 = (franquicia, dmName, email, agencyName) => {
  const marca = nombreFranquicia(franquicia);
  return {
    subject: `¿Cuántos de sus asesores nuevos siguen activos hoy?`,
    text: `${saludo(dmName, email, agencyName)}

Le escribo desde Sifer, trabajamos con oficinas ${marca} en la región.

Quería hacerle una pregunta directa: ¿cuántos asesores nuevos sumó su oficina en los últimos 3 meses? Y de esos, ¿cuántos siguen activos hoy?

Si la respuesta no es tan buena como le gustaría, no es un problema aislado — es el patrón que vemos en la mayoría de las oficinas de la red.

¿Le interesa que le cuente en 20 minutos qué está haciendo distinto la oficina que sí lo resolvió?

Si usted no es quien toma esta decisión, le agradezco si me indica a quién puedo escribirle.

${FIRMA()}`,
  };
};

// FRANQUICIA TOQUE 2 — Día 3 (mismo hilo)
export const EMAIL_FRANQUICIA_TOQUE_2 = (franquicia, dmName, email, agencyName) => {
  return {
    subjectPrefix: 'Re: ',
    text: `${saludo(dmName, email, agencyName)}

Sumo un dato al mensaje anterior: en la mayoría de los casos que vemos, no es un tema de reclutar más — es que los asesores buenos se terminan yendo a la oficina que les da mejores leads y sistema, no a la que mejor comisión paga.

Y esto no es solo para equipos grandes: lo estamos viendo tanto en oficinas de 6-8 asesores como en equipos de 40+.

¿Le pasó con algún asesor fuerte del equipo en el último tiempo?

${FIRMA()}`,
  };
};

// FRANQUICIA TOQUE 3 — Día 8 (nuevo hilo)
export const EMAIL_FRANQUICIA_TOQUE_3 = (franquicia, dmName, email, agencyName) => {
  const caso = casoFranquicia(franquicia);
  const prueba = pruebaFranquicia(franquicia);
  return {
    subject: `Lo que está usando ${caso} para no perder asesores`,
    text: `${saludo(dmName, email, agencyName)}

Le cuento brevemente en qué consiste lo que mencioné: un sistema que atiende y califica leads con IA las 24 horas y se los entrega listos a su equipo comercial — sin que nada se pierda entre la generación y el cierre.

Eso termina siendo el diferencial real para atraer y retener a los asesores que ya tiene.

Ya lo está usando ${prueba}

¿Le sirve que se lo muestre en una llamada de 20 minutos, sin compromiso? ¿Mañana o el miércoles?

${FIRMA()}`,
  };
};

// FRANQUICIA TOQUE 4 — Día 15
export const EMAIL_FRANQUICIA_TOQUE_4 = (franquicia, dmName, email, agencyName) => {
  return {
    subject: `Último mensaje de mi parte`,
    text: `${saludo(dmName, email, agencyName)}

Le dejo este como último email de mi parte — no quiero ser invasivo.

Si en algún momento retener o atraer asesores fuertes vuelve a ser prioridad para la oficina, quedo disponible.

Lo sigo por LinkedIn de todas formas, por si le sirve ver ahí lo que compartimos sobre este tema.

${FIRMA()}`,
  };
};
