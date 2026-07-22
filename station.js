const { DOMParser } = require('@xmldom/xmldom');
const config = require('./config');
const areas = require('./constants/areas');
const { fetchText } = require('./http');

let ready = false;
const stationToAreas = new Map();

const buildMappings = async () => Promise.all(areas.map((a) => a.id).map(async (areaId) => {
  const res = await fetchText(
    `${config.get('metadataEndpoint')}/station/list/${areaId}.xml`,
  );
  const document = new DOMParser().parseFromString(res, 'text/xml');
  const stationIds = [...document.getElementsByTagName('station')].map(s => {
    const id = [...s.children].find(({tagName}) => tagName === 'id');
    return id?.textContent.trim();
  }).filter(Boolean);

  stationIds.forEach((sid) => {
    if (!stationToAreas.has(sid)) stationToAreas.set(sid, []);
    stationToAreas.get(sid).push(areaId);
  });
})).then(() => {
  ready = true;
});

const getStationAvailableAreas = async (stationId) => {
  if (!ready) await buildMappings();
  if (!stationToAreas.has(stationId)) throw new Error('INVALID_STATION_ID');
  return stationToAreas.get(stationId);
};

module.exports = {
  getStationAvailableAreas,
};
