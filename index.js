const { fetchPlaylist } = require('./playlist');
const config = require('./config');

module.exports = {
  fetchPlaylist,
  configure: config.set,
};
