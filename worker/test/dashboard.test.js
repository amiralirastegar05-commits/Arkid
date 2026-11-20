import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import dashboardWorker from '../dashboard-worker.js';

test('dashboard bundle matches the source and public configuration', () => {
  execFileSync(process.execPath, ['worker/scripts/build-dashboard.mjs', '--check']);
});
test('dashboard bundle preserves health, allowed preflight and anonymous denial', async () => {
  const request = (path, init = {}) => new Request('https://new-worker.example' + path, init);
  const health = await dashboardWorker.fetch(request('/health'));
  assert.deepEqual(await health.json(), { ok: true, service: 'arkid-api', version: 1 });
  const preflight = await dashboardWorker.fetch(request('/v1/me', { method: 'OPTIONS', headers: { Origin: 'https://amiralirastegar05-commits.github.io' } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://amiralirastegar05-commits.github.io');
  const denied = await dashboardWorker.fetch(request('/v1/me', { headers: { Origin: 'https://untrusted.example' } }));
  assert.equal(denied.status, 403);
  const unauthenticated = await dashboardWorker.fetch(request('/v1/me', { headers: { Origin: 'https://amiralirastegar05-commits.github.io' } }));
  assert.equal(unauthenticated.status, 401);
});

test('dashboard bundle verifies identity against the intended project', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://xorsueznslmcmkfqizqn.supabase.co/auth/v1/user');
      assert.match(options.headers.apikey, /^sb_publishable_/);
      assert.equal(options.headers.Authorization, 'Bearer test-session');
      return Response.json({id:'user-one',email:'player@example.test'});
    };
    const response = await dashboardWorker.fetch(new Request('https://new-worker.example/v1/me', {
      headers: {Origin:'https://amiralirastegar05-commits.github.io', Authorization:'Bearer test-session'}
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, 'user-one');
  } finally { globalThis.fetch = oldFetch; }
});

test('dashboard ranked routes remain off without explicit private runtime configuration', async()=>{
  const response=await dashboardWorker.fetch(new Request('https://new-worker.example/v1/ranked/start',{method:'POST',headers:{Origin:'https://amiralirastegar05-commits.github.io','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'ranked_unavailable'});
});
