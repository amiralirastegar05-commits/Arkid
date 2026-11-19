import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env = { ALLOWED_ORIGINS: 'https://site.example,http://localhost:3000', SUPABASE_URL: 'https://db.example', SUPABASE_PUBLISHABLE_KEY: 'public' };
const req = (path, origin, options = {}) => new Request('https://worker.example' + path, { ...options, headers: { ...(origin ? { Origin: origin } : {}), ...options.headers } });

test('public health works for any origin and returns the advertised shape', async () => {
  const r = await worker.fetch(req('/health', 'https://other.example'), env);
  assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await r.json(), { ok: true, service: 'arkid-api', version: 1 });
});
test('identity preflight permits only configured origins', async () => {
  const good = await worker.fetch(req('/v1/me', 'https://site.example', { method: 'OPTIONS' }), env);
  assert.equal(good.status, 204); assert.equal(good.headers.get('access-control-allow-origin'), 'https://site.example');
  const bad = await worker.fetch(req('/v1/me', 'https://evil.example', { method: 'OPTIONS' }), env);
  assert.equal(bad.status, 403); assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
test('identity verifies token, and distinguishes auth outages from bad credentials', async () => {
  const old = globalThis.fetch;
  try {
    assert.equal((await worker.fetch(req('/v1/me', 'https://site.example'), env)).status, 401);
    globalThis.fetch = async () => Response.json({ id: 'user-1', email: 'a@example.test' });
    const response = await worker.fetch(req('/v1/me', 'https://site.example', { headers: { Authorization: 'Bearer token' } }), env);
    assert.equal(response.status, 200); assert.equal((await response.json()).id, 'user-1');
    globalThis.fetch = async () => { throw Error('offline'); };
    assert.equal((await worker.fetch(req('/v1/me', null, { headers: { Authorization: 'Bearer token' } }), env)).status, 503);
    globalThis.fetch = async () => new Response('', { status: 401 });
    assert.equal((await worker.fetch(req('/v1/me', null, { headers: { Authorization: 'Bearer token' } }), env)).status, 401);
  } finally { globalThis.fetch = old; }
});
