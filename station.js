const rp = require('request-promise');
const { JSDOM } = require('jsdom');
const config = require('./config');
const areas = require('./constants/areas');
const httpsAgent = require('./httpsAgent');

const areaToStations = {};
const stations = {};

const getStationAvailableAreas = async (stationId) => {
  if (stations[stationId]) return stations[stationId].areas;
  await Promise.all(areas.map((a) => a.id).map(async (areaId) => {
    const res = await rp({
      uri: `${config.get('metadataEndpoint')}/station/list/${areaId}.xml`,
      pool: httpsAgent,
    });
    const { document } = new JSDOM(res).window;
    const stationIds = Array.prototype.map.call(
      document.querySelectorAll('station > id'),
      (n) => n.textContent,
    );
    areaToStations[areaId] = stationIds;
    stationIds.forEach((sid) => {
      if (!stations[sid]) {
        stations[sid] = {
          areas: [],
        };
      }
      stations[sid].areas.push(areaId);
    });
  }));
  if (!stations[stationId]) throw new Error('INVALID_STATION_ID');
  return stations[stationId].areas;
};

module.exports = {
  getStationAvailableAreas,
};
