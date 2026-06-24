// Ventana de envío de cold email: Martes y Jueves, 9:00-10:00 AM hora local de cada país

const COUNTRY_OFFSETS = {
  paraguay: -4, // PYT
  ecuador: -5,  // ECT
  mexico: -6,   // CST
  méxico: -6,
  argentina: -3, // ART
};

function getOffset(pais) {
  const p = (pais || '').toLowerCase();
  for (const [country, offset] of Object.entries(COUNTRY_OFFSETS)) {
    if (p.includes(country)) return offset;
  }
  return -3; // default: Argentina (la mayoría de la base actual)
}

// true si AHORA cae dentro de la ventana Mar/Jue 9-10am hora local del país
export function isWithinSendWindow(pais) {
  const offset = getOffset(pais);
  const localMs = Date.now() + offset * 3600 * 1000;
  const localDate = new Date(localMs);
  const day = localDate.getUTCDay(); // 2 = martes, 4 = jueves
  const hour = localDate.getUTCHours();
  return (day === 2 || day === 4) && hour === 9;
}

export function getSupportedCountries() {
  return ['paraguay', 'ecuador', 'mexico', 'argentina'];
}

export function countryMatches(pais, key) {
  const p = (pais || '').toLowerCase();
  if (key === 'mexico') return p.includes('mexico') || p.includes('méxico');
  return p.includes(key);
}

// Identificador único de la ventana actual para un país (cambia cada hora)
export function windowKey(pais) {
  const offset = getOffset(pais);
  const localMs = Date.now() + offset * 3600 * 1000;
  const d = new Date(localMs);
  return `${d.toISOString().slice(0, 10)}T${String(d.getUTCHours()).padStart(2, '0')}`;
}
