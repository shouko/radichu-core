const atob = require('atob');
const btoa = require('btoa');
const config = require('../config');

let key = null;

module.exports = (offset, length) => {
  if (!key) {
    key = atob(config.get('fullKey'));
  }
  return btoa(key.slice(offset, offset + length));
};
