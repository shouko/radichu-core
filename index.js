const { getPlaylist } = require('./playlist');
const config = require('./config');

module.exports = {
  getPlaylist,
  configure: config.set,
};
