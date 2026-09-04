// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

// Metro does not compress its own responses. The dev bundle is ~15MB, and over
// an ngrok tunnel (~50KB/s) that is a five-minute wait sitting at "Bundling
// 99%" — the bundle was built long ago, it is still being transferred.
//
// Gzip is applied as a STREAM, not by buffering: an earlier buffering attempt
// silently truncated the body (15MB in, 2.3MB out) because it did not capture
// everything Metro wrote. Piping through zlib preserves the bytes exactly.
// Only whole-bundle GETs are touched; HMR, the websocket and every other Metro
// route pass through untouched.
function gzipBundle(req, res) {
  if (req.method !== 'GET') return;
  if (!/\.(bundle|map)(\?|$)/.test(req.url || '')) return;
  if (!String(req.headers['accept-encoding'] || '').includes('gzip')) return;

  const gz = zlib.createGzip();
  const rawWrite = res.write.bind(res);
  const rawEnd = res.end.bind(res);
  const rawWriteHead = res.writeHead.bind(res);
  let piping = false;

  res.writeHead = (status, ...rest) => {
    const hdrs = rest.length && typeof rest[rest.length - 1] === 'object' ? rest[rest.length - 1] : {};
    hdrs['Content-Encoding'] = 'gzip';
    // Length changes under compression, and a stale one truncates the client.
    delete hdrs['Content-Length'];
    delete hdrs['content-length'];
    piping = true;
    gz.on('data', (c) => rawWrite(c));
    gz.on('end', () => rawEnd());
    return rawWriteHead(status, hdrs);
  };
  res.write = (chunk, enc, cb) => (piping ? gz.write(chunk, enc, cb) : rawWrite(chunk, enc, cb));
  res.end = (chunk, enc, cb) => {
    if (!piping) return rawEnd(chunk, enc, cb);
    if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
    if (chunk) gz.write(chunk, enc);
    gz.end(cb);
    return res;
  };
}

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url || !req.url.startsWith('/webchart/')) {
      gzipBundle(req, res);
      return middleware(req, res, next);
    }

    const rel = decodeURIComponent(req.url.split('?')[0].replace(/^\/webchart\//, ''));
    const __t0 = Date.now();
    res.on('finish', () => {
      console.log(`[webchart] ${res.statusCode} ${rel || 'index.html'} (${Date.now() - __t0}ms)`);
    });
    // Contain the path inside WEBCHART_DIR — a "../" in the URL must not be
    // able to read arbitrary files off the dev machine.
    const target = path.resolve(WEBCHART_DIR, rel || 'index.html');
    if (!target.startsWith(WEBCHART_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    fs.stat(target, (statErr, st) => {
      if (statErr || !st.isFile()) {
        res.writeHead(404);
        return res.end('Not found');
      }
      // Validator from size + mtime. Opening the chart pulls ~105 files, so
      // re-sending all of them every time is what made it feel slow; with a
      // validator the browser asks and gets a 304 for anything unchanged.
      //
      // This is deliberately revalidation rather than a long max-age: a blind
      // max-age was tried and had to be undone, because a slow tunnel left
      // PARTIAL responses cached and the library then failed to initialise with
      // no request and no error to show for it. A validator cannot do that —
      // the size is part of it, so a truncated copy never matches.
      const etag = `W/"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
        return res.end();
      }
      fs.readFile(target, (err, buf) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
      const headers = {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        ETag: etag,
        // "no-cache" means revalidate, NOT "do not store" — the copy is kept
        // and re-used the moment the ETag still matches.
        'Cache-Control': 'no-cache',
      };
      // Text assets compress ~4x, and the tunnel — not the disk — is the
      // bottleneck here, so spending CPU to send fewer bytes is a large win.
      const compressible = /^(text\/|application\/(javascript|json))/.test(type);
      const accepts = String(req.headers['accept-encoding'] || '').includes('gzip');
      if (compressible && accepts) {
        zlib.gzip(buf, (gzErr, gz) => {
          if (gzErr) {
            res.writeHead(200, headers);
            return res.end(buf);
          }
          res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
          res.end(gz);
        });
        return;
      }
      res.writeHead(200, headers);
      res.end(buf);
      });
    });
  },
};

module.exports = config;
