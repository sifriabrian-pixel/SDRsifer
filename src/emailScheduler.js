// Cola de envío de emails con delay para evitar filtros de spam

let lastSentAt = 0;

function randomDelay() {
  // Entre 30 y 90 segundos
  return (30 + Math.floor(Math.random() * 60)) * 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enqueueEmail(sendFn) {
  const now = Date.now();
  const elapsed = now - lastSentAt;
  const required = randomDelay();

  if (lastSentAt > 0 && elapsed < required) {
    const wait = required - elapsed;
    console.log(`   ⏳ Esperando ${Math.round(wait / 1000)}s antes del próximo email...`);
    await sleep(wait);
  }

  const result = await sendFn();
  lastSentAt = Date.now();
  return result;
}
