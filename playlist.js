const rp = require('request-promise');
const { addHeaderPrefix } = require('./utils');
const { getTokenByStationId } = require('./token/agent');
const config = require('./config');
const httpsAgent = require('./httpsAgent');
const { getRandomClient } = require('./token/identity');

const liveLength = 15;
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

const fetchRealPlaylist = async (playlistApiUrl, authToken, areaId, sessionCacheKey) => {
  const playlistHeaders = addHeaderPrefix({
    AreaId: areaId,
    AuthToken: authToken,
  });

  let realPlaylistUrl = getLiveSession(sessionCacheKey);

  if (!realPlaylistUrl) {
    const metaPlaylist = await rp({
      uri: playlistApiUrl,
      headers: playlistHeaders,
      pool: httpsAgent,
    });
    realPlaylistUrl = metaPlaylist.split('\n').find((line) => line[0] !== '#' && !!line.trim());
    setLiveSession(sessionCacheKey, realPlaylistUrl);
  }

  return rp({
    uri: realPlaylistUrl,
    headers: playlistHeaders,
    pool: httpsAgent,
  });
};

const getPlaylistApiUrl = (stationId, ft, to) => `${config.get('apiEndpoint')}/ts/playlist.m3u8?station_id=${stationId}&ft=${ft}&to=${to}`;

const getLivePlaylistApiUrl = (stationId) => `${config.get('liveEndpoint')}/so/playlist.m3u8?station_id=${stationId}&l=${liveLength}&lsid=${getRandomClient().userId}&type=b`;

const formatTimecode = (t) => {
  const trgx = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/;
  const res = trgx.exec(t);
  if (!res) return false;
  const [, Y, M, D, H, m, s] = res.map((e) => e || '00');
  const d = new Date(`${Y}/${M}/${D} ${H}:${m}:${s}+09:00`);
  if (Number.isNaN(d.getTime()) || d > Date.now()) return false;
  return `${Y}${M}${D}${H}${m}${s}`;
};

const fetchPlaylist = async (stationId, ft, to, defaultAreaId) => {
  const isLive = !ft && !to;
  if (!isLive) {
    const tcFrom = formatTimecode(ft);
    const tcTo = formatTimecode(to);
    if (
      !tcFrom || !tcTo || tcFrom >= tcTo
    ) {
      throw new Error('INVALID_TIMECODE');
    }
  }

  const {
    areaId,
    authToken,
  } = await getTokenByStationId(stationId, defaultAreaId);

  const playlistApiUrl = isLive
    ? getLivePlaylistApiUrl(stationId) : getPlaylistApiUrl(stationId, ft, to);
  return fetchRealPlaylist(playlistApiUrl, authToken, areaId, isLive ? stationId : null);
};

module.exports = {
  fetchPlaylist,
};
