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

function saludo(dmName) {
  return dmName && dmName.trim() ? `Hola ${dmName.trim()},` : 'Hola,';
}

const FIRMA = () => {
  const nombre = process.env.SDR_NAME || 'Marcos';
  return `${nombre} — Sifer\nsifer.pro`;
};

// EMAIL 1 — Día 1
export const EMAIL_TOQUE_1 = (pais, dmName) => {
  const caso = casoPorPais(pais);
  return {
    subject: `Cómo ${caso} agendó 25 visitas en 60 días sin agregar asesores`,
    text: `${saludo(dmName)}\n\n${caso} tenía el mismo problema que la mayoría de las inmobiliarias en ${pais}: leads que llegaban y se perdían porque el equipo no llegaba a hacer el seguimiento a tiempo.\n\nImplementamos un sistema de captación + respuesta automática con IA y en 60 días agendaron 25 visitas nuevas — sin contratar a nadie más.\n\n¿Tiene 20 minutos esta semana para ver si aplica a su operación?\n\n${FIRMA()}\n\n¿No es usted quien toma este tipo de decisiones? Me indica a quién escribirle y le contacto directamente.`,
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
