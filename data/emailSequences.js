// Secuencias de correo — Sifer Q4 2026
// 3 secuencias según el TIPO de prospecto (no el país): Franquicias, Independientes, Miami.
// Franquicias: días 1, 3, 8, 15 · Independientes y Miami: días 1, 3, 10, 17.
// Cualquier respuesta detiene la secuencia (handoff).

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
  if (agencyName && agencyName.trim()) return `Hola, equipo de ${agencyName.trim()},`;
  return 'Hola,';
}

const FIRMA = () => {
  const nombre = process.env.SDR_NAME || 'Brian';
  return `${nombre} — Sifer\nsifer.pro`;
};

// Recorrido de 60s del panel — se carga vía env var; si todavía no está grabado,
// las líneas que lo mencionan se omiten en vez de mandar un link vacío.
function lineaVideo(intro) {
  const link = (process.env.EMAIL_LINK_VIDEO || '').trim();
  if (!link) return '';
  return `\n\n${intro}: ${link}`;
}

function nombreFranquicia(franquicia) {
  const f = (franquicia || '').toLowerCase();
  if (f.includes('remax') || f.includes('re/max') || f.includes('re max')) return 'RE/MAX';
  if (f.includes('century') || f.includes('c21')) return 'Century 21';
  if (f.includes('keller') || f.includes('kw')) return 'Keller Williams';
  return franquicia || 'su franquicia';
}

// Caso local por país — sin nombrar la oficina, solo describirla. Colombia
// (y Miami, que tiene su propia secuencia) van sin caso, con mención regional genérica.
function casoFranquicia(country) {
  const c = (country || '').toLowerCase();
  if (c.includes('colombia')) return null;
  return { caso: 'una oficina RE/MAX top 3 de Ecuador', resultado: 'suma 3 asesores nuevos por mes' };
}

// ─── SECUENCIA 1 — FRANQUICIAS LATAM (RE/MAX, Century 21, Keller Williams) ──
// Ángulo: retención y captación de asesores · Días 1, 3, 8, 15

export const EMAIL_FRANQUICIA_TOQUE_1 = (franquicia, country, dmName, email, agencyName) => {
  const marca = nombreFranquicia(franquicia);
  const oficina = (agencyName || '').trim() || `su oficina ${marca}`;
  return {
    subject: `${oficina}: una pregunta sobre tu equipo`,
    text: `${saludo(dmName, email, agencyName)}

Una pregunta directa: ¿cuántos asesores nuevos sumaste este año en ${oficina} y cuántos siguen activos hoy?

Hablamos con muchas oficinas ${marca} de la región y el patrón se repite: se incorporan asesores, pero muchos no llegan a su primer cierre y terminan yéndose. Casi nunca es falta de ganas; es que no les llegan oportunidades con las que puedan trabajar.

En Sifer armamos el sistema que resuelve eso: campañas que generan clientes y candidatos a asesor, un agente de IA que responde y califica por WhatsApp las 24 horas, y un panel donde ves qué pasa con cada lead.

¿Te sirve que te cuente en 20 minutos cómo lo implementamos?

${FIRMA()}`,
  };
};

export const EMAIL_FRANQUICIA_TOQUE_2 = (franquicia, country, dmName, email, agencyName) => {
  return {
    subjectPrefix: 'Re: ',
    text: `${saludo(dmName, email, agencyName)}, sumo algo a mi correo anterior.

Los asesores buenos no se van a la oficina que paga mejor comisión: se van a la que tiene mejor sistema. Leads que llegan calificados, respuesta inmediata y un proceso claro para no perder a nadie.

Eso es lo que hoy separa a las oficinas que retienen talento de las que viven reclutando. ¿Lo conversamos esta semana?

${FIRMA()}`,
  };
};

export const EMAIL_FRANQUICIA_TOQUE_3 = (franquicia, country, dmName, email, agencyName) => {
  const oficina = (agencyName || '').trim() || 'tu oficina';
  const c = casoFranquicia(country);
  const resultadoLinea = c
    ? `Resultado en ${c.caso}: ${c.resultado}.`
    : `Trabajamos con inmobiliarias en toda la región con resultados similares.`;
  return {
    subject: `Cómo trabaja${c ? ` ${c.caso}` : 'n otras oficinas'} con sus leads y sus asesores`,
    text: `${saludo(dmName, email, agencyName)}

Te cuento en concreto cómo funciona el sistema:

Campañas en Meta generan clientes y también candidatos a asesor.
El agente de IA responde por WhatsApp en segundos, a cualquier hora. Califica y deriva al asesor correcto con toda la conversación.
En el panel ves el embudo completo: leads nuevos, calificados y derivados, cuántos llegaron fuera de horario, cuántos se reactivaron y de qué campaña vino cada uno.

${resultadoLinea}${lineaVideo('Grabé un recorrido de 60 segundos por el panel')}

Si le ves sentido para ${oficina}, ¿nos tomamos 20 minutos?

${FIRMA()}`,
  };
};

export const EMAIL_FRANQUICIA_TOQUE_4 = (franquicia, country, dmName, email, agencyName) => {
  const oficina = (agencyName || '').trim() || 'tu oficina';
  const linkedin = (process.env.SDR_LINKEDIN || '').trim();
  const linkedinLinea = linkedin ? ` (${linkedin})` : '';
  return {
    subject: `Cierro por acá${dmName ? `, ${dmName.trim()}` : ''}`,
    text: `${saludo(dmName, email, agencyName)} no quiero llenarte la bandeja, así que este es mi último correo.

Si en algún momento quieres revisar cómo rinden tus leads o tu captación de asesores, me encuentras en LinkedIn${linkedinLinea} o respondiendo este mismo correo.

Éxitos con ${oficina} en este cierre de año.

${FIRMA()}`,
  };
};

// ─── SECUENCIA 2 — INDEPENDIENTES LATAM (hoy: Paraguay) ────────────────────
// Ángulo: leads que se pierden sin seguimiento · Días 1, 3, 10, 17
// Caso: una oficina de Century 21 en Paraguay con más de 40 asesores — 2 ventas en los primeros 45 días.

export const EMAIL_TOQUE_1 = (pais, dmName, email, agencyName) => {
  return {
    subject: `Cómo una oficina C21 de Paraguay (40+ asesores) logró 2 ventas en 45 días`,
    text: `${saludo(dmName, email, agencyName)}

Una oficina de Century 21 en Paraguay, con más de 40 asesores, tenía el mismo problema que la mayoría de las inmobiliarias: los leads llegaban, pero muchos se enfriaban antes de que alguien los atendiera.

Implementamos un agente de IA que responde por WhatsApp en segundos, califica al cliente y agenda la visita con el asesor. Resultado: 2 ventas en los primeros 45 días.

¿Tienes 20 minutos esta semana para ver si aplica a tu oficina?

${FIRMA()}`,
  };
};

export const EMAIL_TOQUE_2 = (pais, dmName, email, agencyName) => {
  return {
    subjectPrefix: 'Re: ',
    text: `${saludo(dmName, email, agencyName)} una duda que me plantean seguido: "¿esto funciona para un equipo chico?"

Es justamente donde más impacto tiene. Si son dos o tres personas, nadie puede responder a las 10 de la noche ni seguir 40 conversaciones a la vez. El agente cubre ese hueco y le pasa a tu equipo solo los contactos calificados, con todo el historial.

¿Lo vemos en una llamada corta?

${FIRMA()}`,
  };
};

export const EMAIL_TOQUE_3 = (pais, dmName, email, agencyName) => {
  return {
    subject: `El problema no es la cantidad de leads`,
    text: `${saludo(dmName, email, agencyName)}

La mayoría de las inmobiliarias con las que hablamos cree que necesita más leads. Cuando miramos los números, el problema es otro: la mayoría de los contactos que ya llegan nunca recibe un segundo mensaje.

Por eso, además del agente, sumamos un panel donde ves todo: cuántos leads entraron, cuántos se calificaron, cuántos llegaron fuera de horario y de qué campaña vino cada uno. Dejas de medir clics y empiezas a medir visitas.${lineaVideo('Te dejo un recorrido de 60 segundos')}

¿Te interesa ver cómo se vería con tus leads?

${FIRMA()}`,
  };
};

export const EMAIL_TOQUE_4 = (pais, dmName, email, agencyName) => {
  return {
    subject: `¿Lo dejamos para más adelante?`,
    text: `${saludo(dmName, email, agencyName)} este es mi último mensaje. Entiendo que quizás no sea el momento.

Si más adelante quieres revisar cuántos leads se están quedando sin respuesta en tu oficina, responde este correo y lo vemos.

¡Éxitos!

${FIRMA()}`,
  };
};

// Respuesta cuando dicen que no son el decisor
export const EMAIL_NO_ES_DECISOR = () =>
  `Entendido, gracias! ¿Me podría pasar el contacto (email) de la persona que toma esas decisiones para escribirle directamente?`;

// ─── SECUENCIA 3 — MIAMI ─────────────────────────────────────────────────
// Ángulo: comprador internacional que escribe fuera de horario · Días 1, 3, 10, 17
// Sin caso con nombre ni cifra (por decisión de Brian) · pie legal obligatorio,
// sin dirección física (por decisión de Brian) — solo línea de baja.

const LEGAL_MIAMI = `\n\nSifer · Si no quieres recibir más correos, responde "baja" y te quitamos de la lista.`;

export const EMAIL_MIAMI_TOQUE_1 = (dmName, email, agencyName) => {
  return {
    subject: `Tus compradores de LATAM escriben a las 11 pm`,
    text: `${saludo(dmName, email, agencyName)}

Si tu cliente está en Bogotá, Caracas o Buenos Aires, lo más probable es que te escriba por WhatsApp cuando en Miami ya cerró la oficina. Y un inversor que no recibe respuesta esa noche, a la mañana ya le escribió a otro broker.

En Sifer trabajamos con inmobiliarias de toda Latinoamérica con un agente de IA que responde en segundos y en español. Califica presupuesto, plazo y tipo de propiedad, y agenda una videollamada con tu equipo.

¿Te muestro en 20 minutos cómo se vería con tus leads?

${FIRMA()}${LEGAL_MIAMI}`,
  };
};

export const EMAIL_MIAMI_TOQUE_2 = (dmName, email, agencyName) => {
  return {
    subjectPrefix: 'Re: ',
    text: `${saludo(dmName, email, agencyName)} respondo algo que me dicen seguido: "ya tengo CRM".

El agente no reemplaza tu CRM: trabaja antes. Atiende el primer contacto, filtra a los curiosos y le entrega a tu equipo solo compradores calificados, con toda la conversación. Y aunque tus clientes lleguen por referidos, igual escriben por WhatsApp a cualquier hora; la primera respuesta sigue definiendo quién se queda con el cliente.

¿Le ves sentido a esto?

${FIRMA()}${LEGAL_MIAMI}`,
  };
};

export const EMAIL_MIAMI_TOQUE_3 = (dmName, email, agencyName) => {
  return {
    subject: `Compradores que tardan meses en decidir`,
    text: `${saludo(dmName, email, agencyName)}

El comprador internacional no cierra en una semana: compara, viaja, espera la preventa correcta. El riesgo no es que no llegue, es que en esos meses nadie le haga seguimiento y termine comprando con otro.

Nuestro sistema mantiene la conversación activa y reactiva a los contactos que se enfriaron. En un panel ves cuántos llegaron fuera de horario, cuántos se reactivaron y desde qué campaña llegó cada uno.${lineaVideo('Recorrido de 60 segundos')}

¿Lo vemos en una llamada?

${FIRMA()}${LEGAL_MIAMI}`,
  };
};

export const EMAIL_MIAMI_TOQUE_4 = (dmName, email, agencyName) => {
  return {
    subject: `Cierro por acá${dmName ? `, ${dmName.trim()}` : ''}`,
    text: `${saludo(dmName, email, agencyName)} este es mi último correo.

Si en algún momento quieres dejar de perder compradores de Latinoamérica fuera de horario, responde este mensaje y coordinamos.

Mucho éxito.

${FIRMA()}${LEGAL_MIAMI}`,
  };
};
