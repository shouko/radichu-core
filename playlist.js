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
  const tcFrom = formatTimecode(ft);
  const tcTo = formatTimecode(to);
  if (
    !tcFrom || !tcTo || tcFrom >= tcTo
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
