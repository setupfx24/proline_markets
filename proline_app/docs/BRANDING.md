# Branding — ProlineMarket

The app was white-labelled to **ProlineMarket**. This is the map of
every place the brand lives, so the next rebrand is a checklist rather than a hunt.

## Identity

| Thing | Value |
|---|---|
| Display name | `ProlineMarket` (`app.json` → `expo.name`) |
| Slug | `prolinemarket` |
| Android package / iOS bundle | `com.prolinemarket.app` |
| API | `https://api.prolinemarket.com/api/v1` (`src/constants/api.js`) |
| WebSocket | derived from the API host → `wss://api.prolinemarket.com/ws/prices` |
| Trader web | `https://trade.prolinemarket.com` (`CHART_URL`, `TRADE_WEB_URL`) |

The API/WS hosts are overridable at build time via `@env` (`API_BASE_URL`,
`API_URL`, `WS_URL`) — drop a `.env` next to `package.json` to point a build at
staging without touching source.

## Assets — `assets/brand/`

All five are generated from the trader web's logo sources
(`frontend/trader/public/images/logo1.png` and `logo2.png`).

| File | Ink | Used by |
|---|---|---|
| `proline-icon.png` | mark on opaque black | app icon, Android adaptive foreground |
| `proline-logo.png` | **dark** wordmark | light-theme Signup + biometric lock screen |
| `proline-logo-white.png` | **white** wordmark | splash, dark-theme Signup |
| `proline-homebar.png` | dark mark, transparent | Home tab icon (light theme) |
| `proline-homebar-white.png` | white mark, transparent | Home tab icon (dark theme), Home card |
| `proline-favicon.png` | white mark, transparent | web favicon, dark-theme lock screen |

The wordmark ships in two inks on purpose: the previous brand had a single
dark-ink wordmark that was invisible on the black splash and on the dark theme.

Also brand-carrying:

- `assets/images/download.gif` — the cold-start loader (mark scales in, wordmark
  fades in below; 42 frames / 1400 ms, looping, black background).
- `src/constants/brandLogo.js` — the dark-ink wordmark inlined as a base64 data
  URI. Exported PDF statements print on a white page and must not depend on the
  trader web host being reachable, so the logo is embedded rather than fetched.
  Regenerate by base64-encoding `proline-logo.png` at ~440 px wide.
- `src/components/vantage/SpotlightCard.js` — `brandLabel` is the short monogram
  (`PM`) drawn as SVG text in a 56 px glow badge. Only a 2–3 character token fits.

`assets/images/card.png`, `card_image.png`, `chip.png` and `fund_banner.png` carry
no brand marks — they are generic artwork and were left alone.

## Storage keys

Namespaced keys were renamed with the brand: `prolinemarket.watchlist`,
`prolinemarket.balanceHidden`. Renaming them resets those preferences for anyone
upgrading in place — intended here, since this is a different app.

## ⚠️ Outstanding: EAS project

`app.json` deliberately ships with **no** `extra.eas.projectId`, no `owner`, and
`updates.enabled: false` — the old values pointed at the Expo account of the
build this was white-labelled from. Before the first build, on the ProlineMarket Expo account:

```bash
eas init                # writes extra.eas.projectId + owner
eas update:configure    # writes updates.url = https://u.expo.dev/<projectId>
```

then set `updates.enabled` back to `true`. Until that is done:

- **OTA updates are off.** `Updates.checkForUpdateAsync()` in `src/app/App.js`
  throws and is swallowed — harmless.
- **Theme switching degrades.** `setThemeAndReload()` reloads the JS bundle via
  `Updates.reloadAsync()`; with updates disabled it cannot, so the app falls back
  to showing *"Theme saved — reopen the app to apply"*. The preference still
  persists and applies on the next cold start.
- **Server-side push is off.** `registerForPushToken()` reads the project id from
  the Expo config (`src/services/notifications/pushNotifications.js`); with no id
  it returns `null`. Local notifications are unaffected.

All three fix themselves once `eas init` has run — no code changes needed.
