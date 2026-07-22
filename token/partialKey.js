const config = require('../config');

let key = null;

module.exports = (offset, length) => {
  if (!key) {
    key = Buffer.from(config.get('fullKey'), 'base64');
  }
  return key.subarray(offset, offset + length).toString('base64');
};
