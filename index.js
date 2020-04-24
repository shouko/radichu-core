const rp = require('request-promise');
const { getRandomElement } = require('./utils');
const { getRandomClient, getLocation } = require('./identity');
const partialKey = require('./partialKey');

const {
  apiEndpoint,
  headerPrefix,
  appName,
} = require('./config.json');

const getStationAvailableAreas = (stationId) => {
  // TODO: station <--> areas
  const availableAreas = {};
  return availableAreas[stationId];
};

const prependHeaderPrefix = (key, isLower) => {
  const prefix = isLower ? headerPrefix.toLowerCase() : headerPrefix;
  return `${prefix}${key}`;
};

const addHeaderPrefix = (headers) => {
  const entries = Object.entries(headers);
  const prefixed = entries.map(([key, val]) => [prependHeaderPrefix(key), val]);
  return Object.fromEntries(prefixed);
};

const tokenCache = {};

const getCachedToken = (areaId) => {
  if (!tokenCache[areaId]) return false;
  if (tokenCache[areaId].expires < Date.now()) {
    delete tokenCache[areaId];
    return false;
  }
  return tokenCache[areaId].authToken;
};

const setCachedToken = (areaId, authToken) => {
  tokenCache[areaId] = {
    authToken,
    expires: Date.now() + 42e5,
  };
};

const getTokenByAreaId = async (areaId) => {
  const cached = getCachedToken(areaId);
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

  setCachedToken(areaId, authToken);
  return { areaId, authToken };
};

const getTokenByStationId = async (stationId, defaultAreaId) => {
  const availableAreas = getStationAvailableAreas(stationId);
  const cachedAreas = availableAreas.filter((a) => {
    const cached = getCachedToken(a);
    if (!cached) return false;
    return true;
  });

  if (cachedAreas.length > 0) {
    const areaId = cachedAreas.includes(defaultAreaId) ? defaultAreaId : cachedAreas[0];
    return {
      areaId,
      authToken: getCachedToken(areaId),
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

  return rp({
    uri: playlistApiUrl,
    headers: playlistHeaders,
  }).then((body) => {
    const metaPlaylist = body.split('\n').find((line) => line[0] !== '#' && !!line.trim());
    return rp({
      uri: metaPlaylist,
      headers: playlistHeaders,
    });
  }).then((playlistBody) => playlistBody);
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
