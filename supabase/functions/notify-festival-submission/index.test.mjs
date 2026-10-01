import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const source = stripTypeScriptTypes(await readFile(new URL('./index.ts', import.meta.url), 'utf8'));
const token = 'test-only-webhook-token-0123456789abcdef';
const sample = {
  type: 'INSERT', schema: 'public', table: 'festival_intake', old_record: null,
  record: {
    id: '00000000-0000-4000-8000-000000000001', created_at: '2026-10-01T07:00:00Z',
    name: '<img src=x onerror=alert(1)>', email: 'participant@example.com',
    bassoon_system: 'Alemán (Heckel)', instrument_model: 'Test model', ownership: 'Es mío',
    accessories: [{ item: 'Cañas', request: 'Comprar', quantity: 2 }],
    accessory_details: 'A & B', issues: ['Hay notas que no responden'],
    issue_description: 'Problema de prueba\nSegunda línea', playability: 'Con dificultad',
    to: 'unwanted-recipient@example.com',
  },
};

function setup({ secret = token, providerStatus = 200, confirmationStatus = providerStatus } = {}) {
  const calls = [];
  let handler;
  vm.runInNewContext(source, {
    Deno: {
      env: { get: (key) => ({ FESTIVAL_WEBHOOK_SECRET: secret, RESEND_API_KEY: 'test-only-resend-key' })[key] },
      serve: (callback) => { handler = callback; },
    },
    Response, AbortSignal,
    console: { error() {} },
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      const confirmation = options.headers['Idempotency-Key'].startsWith('festival-confirmation/');
      return Response.json({ id: confirmation ? 'test-confirmation-id' : 'test-organizer-id' }, {
        status: confirmation ? confirmationStatus : providerStatus,
      });
    },
  });
  const request = (payload = sample, suppliedToken = token) => new Request('https://example.test', {
    method: 'POST', headers: { 'x-festival-webhook-secret': suppliedToken }, body: JSON.stringify(payload),
  });
  return { handler, calls, request };
}

test('rejects missing or incorrect webhook tokens without contacting the email provider', async () => {
  const { handler, calls, request } = setup();
  assert.equal((await handler(request(sample, 'incorrect'))).status, 401);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify(sample) }))).status, 401);
  assert.equal(calls.length, 0);
  const unconfigured = setup({ secret: '' });
  assert.equal((await unconfigured.handler(unconfigured.request())).status, 503);
  assert.equal(unconfigured.calls.length, 0);
});

test('includes every answer, escapes HTML, and always sends to the organizer', async () => {
  const { handler, calls, request } = setup();
  assert.equal((await handler(request())).status, 200);
  assert.equal(calls.length, 2);
  const email = calls[0].body;
  assert.deepEqual(email.to, ['info@festival-fagot.online']);
  assert.equal(email.reply_to, 'participant@example.com');
  assert.equal(email.from, 'Festival de Fagot <encuesta@festival-fagot.online>');
  for (const [key, value] of Object.entries(sample.record)) {
    if (key === 'to') continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'object') for (const part of Object.values(entry)) assert.ok(email.text.includes(String(part)));
        else assert.ok(email.text.includes(entry));
      }
    } else assert.ok(email.text.includes(String(value)));
  }
  assert.ok(email.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!email.html.includes('<img'));
  assert.ok(email.html.includes('A &amp; B'));
  assert.ok(!email.text.includes('unwanted-recipient@example.com'));
  assert.equal(calls[0].headers['Idempotency-Key'], `festival-submission/${sample.record.id}`);
  await handler(request());
  assert.equal(calls[2].headers['Idempotency-Key'], calls[0].headers['Idempotency-Key']);
  assert.equal(calls[3].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
});

test('rejects wrong table events and returns an error when sending fails', async () => {
  const { handler, calls, request } = setup();
  assert.equal((await handler(request({ ...sample, type: 'UPDATE' }))).status, 400);
  assert.equal((await handler(request({ ...sample, table: 'other_table' }))).status, 400);
  assert.equal((await handler(request({ ...sample, record: null }))).status, 400);
  assert.equal(calls.length, 0);
  const rejected = setup({ providerStatus: 429 });
  assert.equal((await rejected.handler(rejected.request())).status, 502);
});

test('does not turn malformed participant email into an email header', async () => {
  const { handler, calls, request } = setup();
  await handler(request({ ...sample, record: { ...sample.record, email: 'user@example.com\r\nBcc: other@example.com' } }));
  assert.equal(Object.hasOwn(calls[0].body, 'reply_to'), false);
  assert.deepEqual(calls[0].body.to, ['info@festival-fagot.online']);
});

test('sends a short Spanish confirmation only to the submitted address, with organizer Reply-To', async () => {
  const { handler, calls, request } = setup();
  const response = await handler(request({
    ...sample, record: { ...sample.record, email: '  participant@example.com  ' },
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.accepted, true);
  assert.equal(result.email_id, 'test-organizer-id');
  assert.equal(result.confirmation.email_id, 'test-confirmation-id');
  const confirmation = calls[1].body;
  assert.deepEqual(confirmation.to, ['participant@example.com']);
  assert.equal(confirmation.reply_to, 'info@festival-fagot.online');
  assert.equal(confirmation.from, 'Festival de Fagot <encuesta@festival-fagot.online>');
  assert.equal(confirmation.subject, 'Hemos recibido su respuesta · Festival de Fagot');
  assert.ok(confirmation.text.includes('Hemos recibido su respuesta correctamente.'));
  assert.ok(confirmation.html.includes('<p>Hemos recibido su respuesta correctamente.</p>'));
  assert.ok(!confirmation.html.includes('<img'));
  assert.ok(!confirmation.text.includes(sample.record.issue_description));
  assert.ok(!confirmation.text.includes('unwanted-recipient@example.com'));
  assert.equal(calls[1].headers['Idempotency-Key'], `festival-confirmation/${sample.record.id}`);
  assert.equal(calls[0].signal, calls[1].signal);
});

test('skips malformed or multiple participant addresses while still notifying the organizer', async () => {
  for (const email of [
    '',
    'not-an-email',
    'user@example.com,second@example.com',
    'user@example.com;second@example.com',
    'user@example.com\r\nBcc: second@example.com',
    'Display Name <user@example.com>',
  ]) {
    const { handler, calls, request } = setup();
    const response = await handler(request({ ...sample, record: { ...sample.record, email } }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.organizer.accepted, true);
    assert.equal(result.confirmation.skipped, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.to, ['info@festival-fagot.online']);
    assert.equal(Object.hasOwn(calls[0].body, 'reply_to'), false);
  }
});

test('reports partial failure and retains separate stable keys for a confirmation retry', async () => {
  const { handler, calls, request } = setup({ confirmationStatus: 429 });
  const response = await handler(request());
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.equal(result.accepted, false);
  assert.equal(result.organizer.accepted, true);
  assert.equal(result.confirmation.accepted, false);
  await handler(request());
  assert.equal(calls[0].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key']);
  assert.equal(calls[1].headers['Idempotency-Key'], calls[3].headers['Idempotency-Key']);
  const organizerRejected = setup({ providerStatus: 429, confirmationStatus: 200 });
  const otherResponse = await organizerRejected.handler(organizerRejected.request());
  assert.equal(otherResponse.status, 502);
  const otherResult = await otherResponse.json();
  assert.equal(otherResult.organizer.accepted, false);
  assert.equal(otherResult.confirmation.accepted, true);
});
