const rp = require('request-promise');
const {
  getRandomElement,
  addHeaderPrefix,
  prependHeaderPrefix,
} = require('./utils');
const { getRandomClient, getLocation } = require('./identity');
const partialKey = require('./partialKey');
const tokenStore = require('./tokenStore');

const {
  apiEndpoint,
  appName,
} = require('./config.json');

const getStationAvailableAreas = (stationId) => {
  // TODO: station <--> areas
  const availableAreas = {};
  return availableAreas[stationId];
};

const getTokenByAreaId = async (areaId) => {
  const cached = tokenStore.get(areaId);
  if (cached) return cached;

  const {
    appVersion,
    userId,
    userAgent,
    device,
  } = getRandomClient();

  const commonHeaders = {
    'User-Agent': userAgent,
    ...addHeaderPrefix({
      App: appName,
      'App-Version': appVersion,
      Device: device,
      User: userId,
    }),
  };

  const transform = (body, response) => ({
    headers: response.headers,
    body,
  });

  const { headers } = await rp({
    uri: `${apiEndpoint}/auth1`,
    headers: commonHeaders,
    transform,
  });

  const [authToken, keyOffset, keyLength] = [
    headers[prependHeaderPrefix('authtoken', true)],
    parseInt(headers[prependHeaderPrefix('keyoffset', true)], 10),
    parseInt(headers[prependHeaderPrefix('keylength', true)], 10),
  ];

  const requestHeaders = addHeaderPrefix({
    AuthToken: authToken,
    Location: getLocation(areaId),
    Connection: 'wifi',
    Partialkey: partialKey(keyOffset, keyLength),
  });

  await rp({
    uri: `${apiEndpoint}/auth2`,
    headers: {
      ...commonHeaders,
      ...requestHeaders,
    },
  });

  tokenStore.set(areaId, authToken);
  return { areaId, authToken };
};

const getTokenByStationId = async (stationId, defaultAreaId) => {
  const availableAreas = getStationAvailableAreas(stationId);
  const cachedAreas = availableAreas.filter((a) => {
    const cached = tokenStore.get(a);
    if (!cached) return false;
    return true;
  });

  if (cachedAreas.length > 0) {
    const areaId = cachedAreas.includes(defaultAreaId) ? defaultAreaId : cachedAreas[0];
    return {
      areaId,
      authToken: tokenStore.get(areaId),
    };
  }

  const areaId = getRandomElement(availableAreas);
  return {
    areaId,
    authToken: await getTokenByAreaId(areaId),
  };
};

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

const getPlaylistApiUrl = (stationId, ft, to) => `${apiEndpoint}/ts/playlist.m3u8?station_id=${stationId}&ft=${ft}&to=${to}`;

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
