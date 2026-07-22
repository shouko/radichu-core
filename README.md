# Radichu Core

Core of Radichu

Requires Node.js 24 or newer.

Live and time-shift playback use the same `fetchPlaylist` API. Time-shift ranges are assembled from the upstream 300-second playlists and returned as one M3U8 document.

## Usage

```js
const radichuCore = require('radichu-core');

radichuCore.configure({
  "apiEndpoint": "https://example.jp/v2/api",
  "liveEndpoint": "https://example.jp",
  "metadataEndpoint": "https://example.jp/v3",
  "headerPrefix": "X-MyAwesome-App-",
  "appName": "aFeaturePhone7a",
  "fullKey": "EXAMPLEKEY=="
});
```
