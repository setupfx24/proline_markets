#pragma once

class QWebEngineProfile;

// The shared browser profile for the two panels that embed a third-party
// widget — News and the economic Calendar.
//
// Why this exists: without it both panels fall back to
// QWebEngineProfile::defaultProfile(), which in Qt 6 is OFF-THE-RECORD. An
// off-the-record profile keeps no disk cache, so every launch re-downloaded
// TradingView's JS bundle from scratch. Measured on this machine: 8.2 s to
// first paint cold, 0.5 s once the bundle is cached — and the terminal was
// paying the 8.2 s every single time.
//
// This is deliberately NOT the profile the chart uses. WebChartWidget sets
// NoCache on purpose, because that page is the app's own web/ directory and a
// cached copy of it kept serving a stale datafeed after an update. That reason
// does not apply here: these pages are a third party's CDN assets, served with
// their own cache headers, and caching them is exactly what the cache is for.
//
// Cookies are NOT persisted. The cache is what makes this fast; keeping a
// third party's cookies on disk buys nothing and is worse for the trader.
//
// Both panels sharing one profile also tends to cost one renderer process
// instead of two — same profile, same site.
QWebEngineProfile* embedProfile();
