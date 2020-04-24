const config = require('./config');

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const prependHeaderPrefix = (key, isLower) => {
  const headerPrefix = config.get('headerPrefix');
  const prefix = isLower ? headerPrefix.toLowerCase() : headerPrefix;
  return `${prefix}${key}`;
};

const addHeaderPrefix = (headers) => {
  const entries = Object.entries(headers);
  const prefixed = entries.map(([key, val]) => [prependHeaderPrefix(key), val]);
  return Object.fromEntries(prefixed);
};

module.exports = {
  getRandomElement,
  prependHeaderPrefix,
  addHeaderPrefix,
};
