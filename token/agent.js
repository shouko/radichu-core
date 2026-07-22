const {
  getRandomElement,
  addHeaderPrefix,
  prependHeaderPrefix,
} = require('../utils');
const { getRandomClient, getLocation } = require('./identity');
const config = require('../config');
const partialKey = require('./partialKey');
const store = require('./store');
const { getStationAvailableAreas } = require('../station');
const { fetchText } = require('../http');

const getTokenByAreaId = async (areaId) => {
  const cached = store.get(areaId);
  if (cached) return cached;

  const {
    appVersion,
    userId,
    userAgent,
    device,
  } = getRandomClient();

  const appName = config.get('appName');
  const apiEndpoint = config.get('apiEndpoint');

  const commonHeaders = {
    'User-Agent': userAgent,
    ...addHeaderPrefix({
      App: appName,
      'App-Version': appVersion,
      Device: device,
      User: userId,
    }),
  };

  const auth1 = await fetch(`${apiEndpoint}/auth1`, {
    headers: commonHeaders,
  });
  if (!auth1.ok) {
    const error = new Error(`HTTP_${auth1.status}`);
    error.status = auth1.status;
    throw error;
  }

  const [authToken, keyOffset, keyLength] = [
    auth1.headers.get(prependHeaderPrefix('authtoken', true)),
    parseInt(auth1.headers.get(prependHeaderPrefix('keyoffset', true)), 10),
    parseInt(auth1.headers.get(prependHeaderPrefix('keylength', true)), 10),
  ];

  const requestHeaders = addHeaderPrefix({
    AuthToken: authToken,
    Location: getLocation(areaId),
    Connection: 'wifi',
    Partialkey: partialKey(keyOffset, keyLength),
  });

  await fetchText(`${apiEndpoint}/auth2`, {
    headers: {
      ...commonHeaders,
      ...requestHeaders,
    },
  });

  store.set(areaId, authToken);
  return authToken;
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
