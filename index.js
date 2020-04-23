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

const getTokenByStationId = async (stationId, defaultAreaId) => {
  const availableAreas = getStationAvailableAreas(stationId);
  const cachedAreas = availableAreas.filter((a) => {
    const cached = tokenCache[a];
    if (!cached) return false;
    if (Date.now() > cached.expires) {
      delete tokenCache[a];
      return false;
    }
    return true;
  });

  if (cachedAreas.length > 0) {
    const selectedArea = cachedAreas.includes(defaultAreaId) ? defaultAreaId : cachedAreas[0];
    return {
      authToken: tokenCache[selectedArea].authToken,
      selectedArea,
    };
  }

  const selectedArea = getRandomElement(availableAreas);
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

  return rp({
    uri: `${apiEndpoint}/auth1`,
    headers: commonHeaders,
    transform,
  }).then(({ headers }) => ({
    authToken: headers[prependHeaderPrefix('authtoken', true)],
    keyOffset: parseInt(prependHeaderPrefix('keyoffset', true), 10),
    keyLength: parseInt(prependHeaderPrefix('keylength', true), 10),
  })).then(({ authToken, keyOffset, keyLength }) => rp({
    uri: `${apiEndpoint}/auth2`,
    headers: {
      ...commonHeaders,
      ...addHeaderPrefix({
        AuthToken: authToken,
        Location: getLocation(selectedArea),
        Connection: 'wifi',
        Partialkey: partialKey(keyOffset, keyLength),
      }),
    },
  }).then(() => {
    tokenCache[selectedArea] = {
      token: authToken,
      expires: Date.now() + 42e5,
    };
    return { authToken, selectedArea };
  }));
};

const fetchRealPlaylist = async (playlistApiUrl, authToken, areaId) => {
  const playlistHeaders = addHeaderPrefix({
    AreaId: areaId,
    AuthToken: authToken,
  });

  await rp({
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
    authToken,
    selectedArea,
  } = await getTokenByStationId(stationId, defaultAreaId);

  return fetchRealPlaylist(getPlaylistApiUrl(stationId, ft, to), authToken, selectedArea);
};

module.exports = {
  fetchPlaylist,
};
