import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/v2/google/callback/route';

test('file consent callback rejects a different origin before session or token storage', async () => {
  const before = process.env.GATHERLY_V2_APP_ORIGIN;
  process.env.GATHERLY_V2_APP_ORIGIN = 'https://gatherly-three-umber.vercel.app';
  try {
    const response = await GET(new Request('https://other.invalid/api/v2/google/callback?code=fixture&state=fixture'));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'FORBIDDEN' });
    assert.equal(response.headers.has('location'), false);
    assert.match(response.headers.get('cache-control')!, /no-store/);
  } finally {
    if (before === undefined) delete process.env.GATHERLY_V2_APP_ORIGIN;
    else process.env.GATHERLY_V2_APP_ORIGIN = before;
  }
});
