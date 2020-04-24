const https = require('https');

const httpsAgent = new https.Agent();
httpsAgent.maxSockets = 10;

module.exports = httpsAgent;
