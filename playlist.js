const rp = require('request-promise');
const { addHeaderPrefix } = require('./utils');
const { getTokenByStationId } = require('./token/agent');
const config = require('./config');
const httpsAgent = require('./httpsAgent');

const fetchRealPlaylist = async (playlistApiUrl, authToken, areaId) => {
  const playlistHeaders = addHeaderPrefix({
    AreaId: areaId,
    AuthToken: authToken,
  });

  const metaPlaylist = await rp({
    uri: playlistApiUrl,
    headers: playlistHeaders,
    pool: httpsAgent,
  });

  const playlistUrl = metaPlaylist.split('\n').find((line) => line[0] !== '#' && !!line.trim());
  return rp({
    uri: playlistUrl,
    headers: playlistHeaders,
    pool: httpsAgent,
  });
};

const getPlaylistApiUrl = (stationId, ft, to) => `${config.get('apiEndpoint')}/ts/playlist.m3u8?station_id=${stationId}&ft=${ft}&to=${to}`;

const validTimecode = (t) => {
  const trgx = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;
  const res = trgx.exec(t);
  if (!res) return false;
  const [, Y, M, D, h, m, s] = res;
  if (new Date(`${Y}/${M}/${D} ${h}:${m}:${s}+09:00`) > Date.now()) return false;
  return true;
};

const fetchPlaylist = async (stationId, ft, to, defaultAreaId) => {
  if (
    ft >= to
    || !validTimecode(ft)
    || !validTimecode(to)
  ) {
    throw new Error('INVALID_TIMECODE');
  }

  const {
    areaId,
    authToken,
  } = await getTokenByStationId(stationId, defaultAreaId);

  return fetchRealPlaylist(getPlaylistApiUrl(stationId, ft, to), authToken, areaId);
};

module.exports = {
  fetchPlaylist,
};
