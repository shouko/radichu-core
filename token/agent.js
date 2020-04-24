const rp = require('request-promise');
const {
  getRandomElement,
  addHeaderPrefix,
  prependHeaderPrefix,
} = require('../utils');
const { getRandomClient, getLocation } = require('./identity');
const partialKey = require('./partialKey');
const store = require('./store');
const { getStationAvailableAreas } = require('../station');

const {
  apiEndpoint,
  appName,
} = require('../config.json');

const getTokenByAreaId = async (areaId) => {
  const cached = store.get(areaId);
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

  store.set(areaId, authToken);
  return { areaId, authToken };
};

const getTokenByStationId = async (stationId, defaultAreaId) => {
  const availableAreas = await getStationAvailableAreas(stationId);
  const cachedAreas = availableAreas.filter((a) => {
    const cached = store.get(a);
    if (!cached) return false;
    return true;
  });

  if (cachedAreas.length > 0) {
    const areaId = cachedAreas.includes(defaultAreaId) ? defaultAreaId : cachedAreas[0];
    return {
      areaId,
      authToken: store.get(areaId),
    };
  }

  const areaId = availableAreas.includes(defaultAreaId)
    ? defaultAreaId : getRandomElement(availableAreas);
  return {
    areaId,
    authToken: await getTokenByAreaId(areaId),
  };
};

module.exports = {
  getTokenByAreaId,
  getTokenByStationId,
};
