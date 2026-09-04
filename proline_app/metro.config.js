// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Dev-only: serve the bundled chart over the dev server ────────────────────
// The chart (TradingView charting library + our chart.html) normally ships
// INSIDE the APK and the WebView loads it from file:///android_asset/webchart/.
// That directory is created by the withWebChart config plugin at prebuild, so
// in Expo Go it does not exist and the chart could not load at all.
//
// Serving the same directory from Metro gives Expo Go a working chart with the
// exact same files and the exact same chart code — no forked logic. It rides on
// the dev server's own port, so it works over LAN and over --tunnel alike.
// Production builds never hit this: they still read from android_asset.
const WEBCHART_DIR = path.join(__dirname, 'assets', 'webchart');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url || !req.url.startsWith('/webchart/')) return middleware(req, res, next);

    const rel = decodeURIComponent(req.url.split('?')[0].replace(/^\/webchart\//, ''));
    // Contain the path inside WEBCHART_DIR — a "../" in the URL must not be
    // able to read arbitrary files off the dev machine.
    const target = path.resolve(WEBCHART_DIR, rel || 'index.html');
    if (!target.startsWith(WEBCHART_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    fs.readFile(target, (err, buf) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buf);
    });
  },
};

module.exports = config;
