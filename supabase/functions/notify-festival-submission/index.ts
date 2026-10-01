// Server-side only. Set RESEND_API_KEY and FESTIVAL_WEBHOOK_SECRET in Supabase.
// Disable gateway JWT verification for this function; the private header below
// authenticates the database webhook instead.

const recipient = 'info@festival-fagot.online';
const sender = 'Festival de Fagot <encuesta@festival-fagot.online>';

const fields = [
  ['name', 'Nombre'],
  ['email', 'Correo electrónico'],
  ['bassoon_system', 'Sistema de fagot'],
  ['instrument_model', 'Modelo del instrumento'],
  ['ownership', 'Propiedad del instrumento'],
  ['accessories', 'Accesorios solicitados'],
  ['accessory_details', 'Detalles de los accesorios'],
  ['issues', 'Problemas del instrumento'],
  ['issue_description', 'Descripción de los problemas'],
  ['playability', '¿Puede tocar con su instrumento?'],
  ['created_at', 'Fecha de envío (UTC)'],
  ['id', 'Referencia de la respuesta'],
] as const;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.map(display).join('\n') : '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function buildEmail(record: Record<string, unknown>) {
  const answers = fields.map(([key, label]) => [label, display(record[key])]);
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const safeReplyTo = email.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email);
  return {
    from: sender,
    to: [recipient],
    ...(safeReplyTo ? { reply_to: email } : {}),
    subject: 'Nueva respuesta al cuestionario · Festival de Fagot',
    text: 'Se ha recibido una nueva respuesta al cuestionario del festival.\n\n' +
      answers.map(([label, value]) => `${label}\n${value}`).join('\n\n'),
    html: '<h2>Nueva respuesta al cuestionario del festival</h2>' +
      answers.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong></p>` +
        `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(value)}</pre>`).join(''),
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  const webhookSecret = Deno.env.get('FESTIVAL_WEBHOOK_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!webhookSecret || webhookSecret.length < 32 || !resendKey) {
    console.error('Festival notification secrets are missing or incomplete.');
    return Response.json({ error: 'Notifications are not configured' }, { status: 503 });
  }
  if (request.headers.get('x-festival-webhook-secret') !== webhookSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    const body = await request.text();
    if (body.length > 65536) return Response.json({ error: 'Payload too large' }, { status: 413 });
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const record = payload?.record;
  if (payload?.type !== 'INSERT' || payload?.schema !== 'public' || payload?.table !== 'festival_intake' ||
      !record || typeof record !== 'object' || Array.isArray(record) ||
      typeof record.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(record.id) ||
      typeof record.name !== 'string' || typeof record.email !== 'string') {
    return Response.json({ error: 'Invalid festival submission event' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `festival-submission/${record.id}`,
      },
      body: JSON.stringify(buildEmail(record)),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error(`Resend rejected a festival notification: HTTP ${response.status}`);
      return Response.json({ error: 'Email provider rejected the notification' }, { status: 502 });
    }
    const result = await response.json();
    if (typeof result.id !== 'string') {
      return Response.json({ error: 'Unexpected email provider response' }, { status: 502 });
    }
    return Response.json({ accepted: true, email_id: result.id });
  } catch {
    console.error('Festival notification request failed. The submission remains saved in Supabase.');
    return Response.json({ error: 'Email provider request failed' }, { status: 502 });
  }
});
