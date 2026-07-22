const { DOMParser } = require('@xmldom/xmldom');
const { addHeaderPrefix } = require('./utils');
const { getTokenByStationId } = require('./token/agent');
const config = require('./config');
const { getRandomClient } = require('./token/identity');
const { fetchText } = require('./http');

const liveLength = 15;
const timeShiftLength = 300;
const liveSessions = new Map();

const setLiveSession = (key, url) => {
  if (!key) return false;
  return liveSessions.set(key, {
    url,
    expires: Date.now() + liveLength * 2 * 1000,
  });
};

const getLiveSession = (key) => {
  if (!key) return false;
  const session = liveSessions.get(key);
  if (!session || session.expires < Date.now()) {
    return false;
  }
  return session.url;
};

const getPlaylistUrl = (body, baseUrl) => {
  const url = body.split('\n').find((line) => line[0] !== '#' && !!line.trim());
  if (!url) throw new Error('INVALID_PLAYLIST');
  return new URL(url.trim(), baseUrl).toString();
};

const getPlaylistHeaders = (authToken, areaId) => addHeaderPrefix({
  AreaId: areaId,
  AuthToken: authToken,
});

const fetchRealPlaylist = async (playlistApiUrl, authToken, areaId, sessionCacheKey) => {
  const headers = getPlaylistHeaders(authToken, areaId);
  let realPlaylistUrl = getLiveSession(sessionCacheKey);

  if (!realPlaylistUrl) {
    const metaPlaylist = await fetchText(playlistApiUrl, { headers });
    realPlaylistUrl = getPlaylistUrl(metaPlaylist, playlistApiUrl);
    setLiveSession(sessionCacheKey, realPlaylistUrl);
  }

  return fetchText(realPlaylistUrl, { headers });
};

const getLivePlaylistApiUrl = (stationId) => {
  const url = new URL(`${config.get('liveEndpoint')}/so/playlist.m3u8`);
  url.searchParams.set('station_id', stationId);
  url.searchParams.set('l', liveLength);
  url.searchParams.set('lsid', getRandomClient().userId);
  url.searchParams.set('type', 'b');
  return url.toString();
};

const parseTimecode = (timecode) => {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/.exec(timecode);
  if (!match) return false;
  const [, year, month, day, hour, minute, second = '00'] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`);
  if (Number.isNaN(date.getTime()) || date > Date.now()) return false;
  return {
    date,
    value: `${year}${month}${day}${hour}${minute}${second}`,
  };
};

const formatTimecode = (date) => {
  const japanDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return [
    japanDate.getUTCFullYear(),
    japanDate.getUTCMonth() + 1,
    japanDate.getUTCDate(),
    japanDate.getUTCHours(),
    japanDate.getUTCMinutes(),
    japanDate.getUTCSeconds(),
  ].map((part, index) => (index ? String(part).padStart(2, '0') : part)).join('');
};

const getTimeShiftSeeks = (from, to) => {
  const seeks = [];
  for (
    let date = new Date(from.date);
    date < to.date;
    date = new Date(date.getTime() + timeShiftLength * 1000)) {
    seeks.push(formatTimecode(date));
  }
  return seeks;
};

const getTimeShiftPlaylistUrl = async (stationId) => {
  const endpoint = `${config.get('metadataEndpoint')}/station/stream/pc_html5/${stationId}.xml`;
  const xml = await fetchText(endpoint);
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const url = [
    ...document.getElementsByTagName('playlist_create_url'),
  ].find(({ parentNode }) => (
    parentNode.getAttribute('areafree') === '0'
    && parentNode.getAttribute('timefree') === '1'
  ));
  if (!url || !url.textContent.trim()) throw new Error('TIMESHIFT_URL_NOT_FOUND');
  return url.textContent.trim();
};

const getTimeShiftPlaylistApiUrl = (baseUrl, stationId, from, to, seek, sessionId) => {
  const url = new URL(baseUrl);
  const params = {
    station_id: stationId,
    start_at: from,
    ft: from,
    end_at: to,
    to,
    seek,
    l: timeShiftLength,
    type: 'b',
    lsid: sessionId,
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

const playlistHeader = (line) => [
  '#EXTM3U',
  '#EXT-X-VERSION:',
  '#EXT-X-TARGETDURATION:',
  '#EXT-X-MEDIA-SEQUENCE:',
  '#EXT-X-DISCONTINUITY-SEQUENCE:',
  '#EXT-X-PLAYLIST-TYPE:',
  '#EXT-X-INDEPENDENT-SEGMENTS',
  '#EXT-X-START:',
].some((prefix) => line.startsWith(prefix));

const resolvePlaylistUrls = (playlist, baseUrl) => playlist
  .split('\n')
  .map((line) => (line && line[0] !== '#' ? new URL(line, baseUrl).toString() : line))
  .join('\n');

const mergePlaylists = (playlists) => {
  if (!playlists.length) throw new Error('INVALID_PLAYLIST');
  const lines = playlists.flatMap((playlist, index) => playlist
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== '#EXT-X-ENDLIST')
    .filter((line) => index === 0 || !playlistHeader(line)));
  if (lines[0] !== '#EXTM3U') throw new Error('INVALID_PLAYLIST');
  return `${lines.join('\n')}\n#EXT-X-ENDLIST\n`;
};

const fetchTimeShiftPlaylist = async (stationId, from, to, authToken, areaId) => {
  const baseUrl = await getTimeShiftPlaylistUrl(stationId);
  const headers = getPlaylistHeaders(authToken, areaId);
  const sessionId = getRandomClient().userId;
  const playlists = [];

  // Keep chunk creation sequential to avoid bursting the upstream service.
  for (const seek of getTimeShiftSeeks(from, to)) {
    const apiUrl = getTimeShiftPlaylistApiUrl(
      baseUrl, stationId, from.value, to.value, seek, sessionId,
    );
    const metaPlaylist = await fetchText(apiUrl, { headers });
    const playlistUrl = getPlaylistUrl(metaPlaylist, apiUrl);
    const playlist = await fetchText(playlistUrl);
    playlists.push(resolvePlaylistUrls(playlist, playlistUrl));
  }

  return mergePlaylists(playlists);
};

const fetchPlaylist = async (stationId, ft, to, defaultAreaId) => {
  const isLive = !ft && !to;
  const from = isLive ? null : parseTimecode(ft);
  const until = isLive ? null : parseTimecode(to);
  if (!isLive && (!from || !until || from.value >= until.value)) {
    throw new Error('INVALID_TIMECODE');
  }

  const {
    areaId,
    authToken,
  } = await getTokenByStationId(stationId, defaultAreaId);

  if (isLive) {
    return fetchRealPlaylist(
      getLivePlaylistApiUrl(stationId), authToken, areaId, stationId,
    );
  }
  return fetchTimeShiftPlaylist(stationId, from, until, authToken, areaId);
};

module.exports = {
  fetchPlaylist,
  getTimeShiftPlaylistApiUrl,
  getTimeShiftSeeks,
  mergePlaylists,
  parseTimecode,
};
