// Detecta emails de rebote (bounce) y extrae la dirección que falló

const BOUNCE_SENDERS = /mailer-daemon|postmaster|mail-?delivery|bounce/i;
const BOUNCE_SUBJECT = /undeliver|delivery status notification|delivery failure|returned to sender|no pudo ser entregado|no se pudo entregar|mail delivery failed|message blocked/i;

export function isBounceEmail(parsed) {
  const from = parsed.from?.value?.[0]?.address || '';
  const subject = parsed.subject || '';
  return BOUNCE_SENDERS.test(from) || BOUNCE_SUBJECT.test(subject);
}

export function extractBouncedAddress(parsed) {
  const text = `${parsed.text || ''}\n${parsed.html || ''}`;

  const patterns = [
    /Final-Recipient:\s*rfc822;\s*([^\s<>]+@[^\s<>]+)/i,
    /Original-Recipient:\s*rfc822;\s*([^\s<>]+@[^\s<>]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toLowerCase().replace(/[.,;>]+$/, '');
  }

  // Fallback: cualquier email mencionado que no sea el nuestro ni del sistema de bounce
  const ownDomain = (process.env.EMAIL_USER || '').split('@')[1];
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const candidate = emails.find(
    (e) => !/mailer-daemon|postmaster/i.test(e) && !(ownDomain && e.toLowerCase().endsWith(`@${ownDomain.toLowerCase()}`))
  );
  return candidate ? candidate.toLowerCase() : null;
}
