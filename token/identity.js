const { OS_VERSION_MAP, MODEL_LIST, APP_VERSION_LIST } = require('../constants/devices');
const areas = require('../constants/areas');
const { getRandomElement } = require('../utils');

const getRandomClient = () => {
  const osVersion = getRandomElement(Object.keys(OS_VERSION_MAP));
  const { sdk, builds } = OS_VERSION_MAP[osVersion];
  const build = getRandomElement(builds);
  const model = getRandomElement(MODEL_LIST);
  const device = `${sdk}.${model}`;
  const userAgent = `Dalvik/2.1.0 (Linux; U; Android ${osVersion}; ${model}/${build})`;
  const appVersion = getRandomElement(APP_VERSION_LIST);

  const userId = Buffer.from(
    Array(16)
      .fill()
      .map(() => Math.floor(Math.random() * 256)),
  ).toString('hex');

  return {
    appVersion,
    userId,
    userAgent,
    device,
  };
};

const getLocation = (areaId) => {
  const area = areas.find((x) => x.id === areaId);
  if (!area) return false;
  let [lat, long] = area.coor;
  // +/- 0 ~ 0.025 --> 0 ~ 1.5' ->  +/-  0 ~ 2.77/2.13km
  lat += (Math.random() / 40.0) * (Math.random() > 0.5 ? 1 : -1);
  long += (Math.random() / 40.0) * (Math.random() > 0.5 ? 1 : -1);
  return `${lat.toFixed(6)},${long.toFixed(6)},gps`;
};

module.exports = {
  getRandomClient,
  getLocation,
};
