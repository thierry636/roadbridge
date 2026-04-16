const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

export default async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { name, email, company, message, website } = body || {};

  if (website) {
    return json(200, { ok: true });
  }

  if (!name || !email || !message) {
    return json(400, { error: 'Champs manquants.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'Email invalide.' });
  }

  if (
    String(name).length > 200 ||
    String(email).length > 200 ||
    String(company || '').length > 200 ||
    String(message).length > 5000
  ) {
    return json(400, { error: 'Champs trop longs.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.CONTACT_FROM || 'Roadbridge <contact@roadbridge.co>';
  const toAddress = process.env.CONTACT_TO || 'info@roadbridge.co';

  if (!apiKey) {
    return json(500, { error: 'Configuration serveur manquante.' });
  }

  const subject = `Nouveau contact — ${name}${company ? ` (${company})` : ''}`;

  const text = [
    `Nom: ${name}`,
    `Email: ${email}`,
    company ? `Société: ${company}` : null,
    '',
    message
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #222; line-height: 1.6;">
      <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
      <p><strong>Email :</strong> ${escapeHtml(email)}</p>
      ${company ? `<p><strong>Société :</strong> ${escapeHtml(company)}</p>` : ''}
      <p><strong>Message :</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        reply_to: email,
        subject,
        text,
        html
      })
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error('Resend API error:', r.status, errBody);
      return json(502, { error: 'Envoi impossible pour le moment.' });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('Contact function error:', err);
    return json(500, { error: 'Envoi impossible pour le moment.' });
  }
};
