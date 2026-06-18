// Cola de mensajes salientes con delay aleatorio anti-ban

let lastSentAt = 0;

function randomDelay() {
  // Entre 45 y 120 segundos
  return (45 + Math.floor(Math.random() * 75)) * 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Envía un mensaje respetando el delay desde el último envío
export async function enqueue(sendFn) {
  const now = Date.now();
  const elapsed = now - lastSentAt;
  const required = randomDelay();

  if (lastSentAt > 0 && elapsed < required) {
    const wait = required - elapsed;
    console.log(`   ⏳ Esperando ${Math.round(wait / 1000)}s antes del próximo mensaje...`);
    await sleep(wait);
  }

  const result = await sendFn();
  lastSentAt = Date.now();
  return result;
}
