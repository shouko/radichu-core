const assert = require('node:assert/strict');
const test = require('node:test');

const stationPath = require.resolve('../station');
require.cache[stationPath] = {
  exports: {
    getStationAvailableAreas: async () => ['JP13'],
  },
};

const config = require('../config');
const { getTokenByAreaId } = require('../token/agent');

config.set({
  apiEndpoint: 'https://api.example/v2/api',
  appName: 'test-app',
  fullKey: Buffer.from('abcdefgh').toString('base64'),
  headerPrefix: 'X-Test-',
});

test('completes and caches the coordinate-based auth handshake', async (t) => {
  const calls = [];
  t.mock.method(global, 'fetch', async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/auth1')) {
      return new Response('', {
        headers: {
          'X-Test-AuthToken': 'auth-token',
          'X-Test-KeyOffset': '1',
          'X-Test-KeyLength': '3',
        },
      });
    }
    return new Response('JP13');
  });

  assert.equal(await getTokenByAreaId('JP13'), 'auth-token');
  assert.equal(await getTokenByAreaId('JP13'), 'auth-token');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers['X-Test-Partialkey'], 'YmNk');
  assert.match(calls[1].options.headers['X-Test-Location'], /^35\./);
});
