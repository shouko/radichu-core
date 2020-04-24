const rp = require('request-promise');
const { addHeaderPrefix } = require('./utils');
const { getTokenByStationId } = require('./token/agent');
const config = require('./config');

const fetchRealPlaylist = async (playlistApiUrl, authToken, areaId) => {
  const playlistHeaders = addHeaderPrefix({
    AreaId: areaId,
    AuthToken: authToken,
  });

  const metaPlaylist = await rp({
    uri: playlistApiUrl,
    headers: playlistHeaders,
  });

  const playlistUrl = metaPlaylist.split('\n').find((line) => line[0] !== '#' && !!line.trim());
  return rp({
    uri: playlistUrl,
    headers: playlistHeaders,
  });
};

const getPlaylistApiUrl = (stationId, ft, to) => `${config.get('apiEndpoint')}/ts/playlist.m3u8?station_id=${stationId}&ft=${ft}&to=${to}`;

const fetchPlaylist = async (stationId, ft, to, defaultAreaId) => {
  const {
    areaId,
    authToken,
  } = await getTokenByStationId(stationId, defaultAreaId);

  return fetchRealPlaylist(getPlaylistApiUrl(stationId, ft, to), authToken, areaId);
};

module.exports = {
  fetchPlaylist,
};
