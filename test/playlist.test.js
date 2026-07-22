const assert = require('node:assert/strict');
const test = require('node:test');

const tokenAgentPath = require.resolve('../token/agent');
require.cache[tokenAgentPath] = {
  exports: {
    getTokenByStationId: async () => ({
      areaId: 'JP13',
      authToken: 'test-token',
    }),
  },
};

const config = require('../config');
const {
  fetchPlaylist,
  getTimeShiftPlaylistApiUrl,
  getTimeShiftSeeks,
  mergePlaylists,
  parseTimecode,
} = require('../playlist');

config.set({
  headerPrefix: 'X-Test-',
  liveEndpoint: 'https://live.example',
  metadataEndpoint: 'https://metadata.example',
});
  assert.deepEqual(getTimeShiftSeeks(
    parseTimecode('20260101000000'), parseTimecode('20260101000459'),
  ), ['20260101000000']);
  assert.deepEqual(getTimeShiftSeeks(
    parseTimecode('20260101000000'), parseTimecode('20260101000500'),
  ), ['20260101000000']);


test('builds deterministic 300 second seeks across a day boundary', () => {
  const from = parseTimecode('20260101235800');
  const to = parseTimecode('20260102000600');
  assert.deepEqual(getTimeShiftSeeks(from, to), [
    '20260101235800',
    '20260102000300',
  ]);
});

test('builds the new in-area time-shift request', () => {
  const result = new URL(getTimeShiftPlaylistApiUrl(
    'https://stream.example/tf/playlist.m3u8',
    'BAYFM78',
    '20260101000000',
    '20260101001000',
    '20260101000500',
    'session-id',
  ));
  assert.deepEqual(Object.fromEntries(result.searchParams), {
    station_id: 'BAYFM78',
    start_at: '20260101000000',
    ft: '20260101000000',
    end_at: '20260101001000',
    to: '20260101001000',
    seek: '20260101000500',
    l: '300',
    type: 'b',
    lsid: 'session-id',
  });
});

test('merges media playlists without repeating playlist headers', () => {
  const merged = mergePlaylists([
    '#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\na.aac\n#EXT-X-ENDLIST\n',
    '#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nb.aac\n#EXT-X-ENDLIST\n',
  ]);
  assert.equal(merged, [
    '#EXTM3U',
    '#EXT-X-TARGETDURATION:5',
    '#EXTINF:5,',
    'a.aac',
    '#EXTINF:5,',
    'b.aac',
    '#EXT-X-ENDLIST',
    '',
  ].join('\n'));
});

test('discovers, fetches, and assembles every time-shift chunk', async (t) => {
  const calls = [];
  t.mock.method(global, 'fetch', async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    if (url.hostname === 'metadata.example') {
      return new Response(`<?xml version="1.0"?><urls>
        <url areafree="1" timefree="1"><playlist_create_url>https://wrong.example/tf.m3u8</playlist_create_url></url>
        <url timefree="1" areafree="0"><playlist_create_url>https://stream.example/tf/playlist.m3u8</playlist_create_url></url>
      </urls>`);
    }
    if (url.hostname === 'stream.example') {
      return new Response(`#EXTM3U\nhttps://media.example/${url.searchParams.get('seek')}/chunk.m3u8\n`);
    }
    if (url.hostname === 'media.example') {
      return new Response(`#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nsegment.aac\n#EXT-X-ENDLIST\n`);
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  const playlist = await fetchPlaylist(
    'BAYFM78', '20260101000000', '20260101001000', 'JP13',
  );

  const chunkCalls = calls.filter(({ url }) => url.hostname === 'stream.example');
  assert.deepEqual(chunkCalls.map(({ url }) => url.searchParams.get('seek')), [
    '20260101000000',
    '20260101000500',
  ]);
  assert.equal(new Set(chunkCalls.map(({ url }) => url.searchParams.get('lsid'))).size, 1);
  assert.equal(chunkCalls[0].options.headers['X-Test-AreaId'], 'JP13');
  assert.match(playlist, /https:\/\/media\.example\/20260101000000\/segment\.aac/);
  assert.match(playlist, /https:\/\/media\.example\/20260101000500\/segment\.aac/);
  assert.equal(playlist.match(/#EXTM3U/g).length, 1);
  assert.equal(playlist.match(/#EXT-X-ENDLIST/g).length, 1);
});

test('rejects stations without an in-area time-shift URL', async (t) => {
  t.mock.method(global, 'fetch', async () => new Response(
    '<?xml version="1.0"?><urls><url areafree="1" timefree="1" /></urls>',
  ));

  await assert.rejects(
    fetchPlaylist('BAYFM78', '20260101000000', '20260101000500', 'JP13'),
    { message: 'TIMESHIFT_URL_NOT_FOUND' },
  );
});

test('keeps the existing two-hop live playlist flow', async (t) => {
  t.mock.method(global, 'fetch', async (input) => {
    const url = new URL(input);
    if (url.pathname === '/live/detail.m3u8') {
      return new Response('#EXTM3U\n#EXTINF:5,\nhttps://media.example/live.aac\n');
    }
    if (url.hostname === 'live.example') {
      return new Response('#EXTM3U\n/live/detail.m3u8\n');
    }
    throw new Error(`Unexpected URL: ${url}`);
  });

  const playlist = await fetchPlaylist('LIVE-TEST');
  assert.match(playlist, /live\.aac/);
});
