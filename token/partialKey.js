const atob = require('atob');
const btoa = require('btoa');

const key = atob(require('../constants/fullKey.json'));

module.exports = (offset, length) => btoa(key.slice(offset, offset + length));
