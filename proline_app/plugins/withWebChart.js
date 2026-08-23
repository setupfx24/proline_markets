// Expo config plugin — bundles the self-contained chart (TradingView charting
// library + our chart.html) into the native Android assets, so the app's
// WebView can load it fully offline from file:///android_asset/webchart/…
//
// This is what makes the mobile chart INDEPENDENT of the web: nothing is
// fetched from trade.prolinemarket.com — the library + chart page ship inside
// the APK. (Runs at prebuild/`eas build` time, not OTA.)
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

module.exports = function withWebChart(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, 'assets', 'webchart');
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
        'webchart',
      );
      if (!fs.existsSync(src)) {
        throw new Error(`[withWebChart] source folder missing: ${src}`);
      }
      if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
      copyDir(src, dest);
      return cfg;
    },
  ]);
};
