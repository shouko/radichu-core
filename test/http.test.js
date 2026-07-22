const assert = require('node:assert/strict');
const test = require('node:test');
const { fetchText } = require('../http');

test('rejects non-success HTTP responses', async (t) => {
  t.mock.method(global, 'fetch', async () => new Response('gone', { status: 404 }));
  await assert.rejects(fetchText('https://example.test'), {
    message: 'HTTP_404',
    status: 404,
  });
});
