import { API_BASE_URL } from './config.js';

// A dummy credential deliberately forces browser CORS preflight, without using
// or reading an actual login session. This does not test valid authentication.
export async function checkWorkerCors(fetchImpl = globalThis.fetch) {
  if (!API_BASE_URL) return { ok: false, reason: 'not_configured' };
  try {
    const response = await fetchImpl(`${API_BASE_URL}/v1/me`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { Authorization: 'Bearer invalid-test-token' },
    });
    let body;
    try { body = await response.json(); } catch (_) { body = null; }
    if (response.status === 401 && body?.error === 'unauthorized') {
      return { ok: true, status: response.status };
    }
    return { ok: false, reason: 'unexpected_response', status: response.status };
  } catch (_) {
    return { ok: false, reason: 'network_or_cors' };
  }
}
