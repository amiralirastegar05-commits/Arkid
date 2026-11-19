import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWorkerCors } from '../cloud/worker-diagnostic.js';

test('mobile diagnostic uses only a dummy token and omits credentials', async () => {
  const result = await checkWorkerCors(async (url, options) => {
    assert.equal(url, 'https://arkid-api-now.nova-197b21.workers.dev/v1/me');
    assert.equal(options.method, 'GET');
    assert.equal(options.mode, 'cors');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Authorization, 'Bearer invalid-test-token');
    return Response.json({error:'unauthorized'}, {status:401});
  });
  assert.deepEqual(result, {ok:true, status:401});
});

test('mobile diagnostic distinguishes unexpected response and network/CORS errors', async () => {
  assert.deepEqual(await checkWorkerCors(async () => Response.json({ok:true})), {ok:false, reason:'unexpected_response', status:200});
  assert.deepEqual(await checkWorkerCors(async () => { throw new TypeError('Failed to fetch'); }), {ok:false, reason:'network_or_cors'});
});
