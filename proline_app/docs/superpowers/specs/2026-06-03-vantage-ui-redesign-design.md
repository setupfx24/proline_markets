# ProlineMarket APK — Vantage-style UI Redesign

**Date:** 2026-06-03
**Status:** Approved for implementation planning
**Scope:** Mobile APK only (`ProlineMarket_apk/`). Web project (`ProlineMarket/`) is reference-only for backend API endpoints.

---

## 1. Goal

Rebuild the ProlineMarket mobile app's UI to match the visual language of Vantage (CFD trading app) while keeping only the features that exist in the ProlineMarket backend. The current PipHigh-fork UI is replaced with a design system extracted from Vantage screenshots: pure-black background, orange (`#F26A1F`) accent, sparkline-rich watchlists, a floating pill bottom-nav, and the signature Sell-pink / Buy-grey split order ticket.

---

## 2. Scope

### In scope
- Full visual redesign of all 22 existing screens (and several new ones).
- Bottom-tab navigation overhaul (4 tabs: Home / Markets / Trade / Funds).
- Native integration of the three payment gateways already wired in the backend (Razorpay, OxaPay, on-chain USDT) plus manual bank/UPI upload.
- New shared component library replacing scattered styling.
- Splash animation file slot reserved — **user will supply their own asset**; not designed here.

### Out of scope
- Web project (`ProlineMarket/`) — no changes.
- Backend changes — none. Backend endpoints already match what the app calls.
- Features that exist in Vantage but not in ProlineMarket backend: Earn tab (crypto savings APR), FX TV, Webinar, Analysis articles, dedicated news feed.
- Light theme — dark-only for v1 (Vantage is dark-only).
- Native Razorpay SDK — v1 uses WebView Razorpay Checkout (no new native dep). May upgrade later.
- Test suite — no Jest/RTL set up. Manual smoke-checks per phase.

---

## 3. Design Tokens

**File:** `src/theme/vantageTheme.js` (new). Replaces `src/theme/colors.js`.

```js
// Surfaces
bg:           '#000000'
bgElevated:   '#0F0F0F'
bgRaised:     '#161616'
bgPressed:    '#1F1F1F'
border:       '#1F1F1F'
borderStrong: '#2A2A2A'

// Text
textPrimary:   '#FFFFFF'
textSecondary: '#9CA3AF'
textMuted:     '#6B7280'
textInverse:   '#000000'

// Brand
accent:       '#F26A1F'
accentGlow:   '#FF8A3D'
accentMuted:  'rgba(242,106,31,0.12)'

// Directionals
up:           '#22C55E'
upMuted:      'rgba(34,197,94,0.10)'
down:         '#EF4565'
downMuted:    'rgba(239,69,101,0.10)'

// Trade-screen specific
sellBg:       '#EF4565'   // active Sell button
buyBg:        '#1F1F1F'   // inactive Buy side (and vice-versa)
spreadChip:   '#000000'

// Typography
fontFamily:   Platform.select({ ios: 'System', android: 'Roboto' })
weights:      { regular:'400', medium:'500', semibold:'600', bold:'700', heavy:'800' }
sizes:        { hero:32, h1:24, h2:20, h3:17, body:15, label:13, micro:11 }

// Spacing (4px grid)
space:        { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32, huge:48 }

// Radii
radius:       { sm:8, md:12, lg:16, xl:20, pill:999 }
```

`ThemeContext` keeps the same shape but only exports `vantage` tokens. Light theme branch removed.

---

## 4. Shared Component Library

**Path:** `src/components/vantage/`. All components are presentational (no data fetching), single default export, RN primitives + react-native-svg only.

| Component | Purpose |
|---|---|
| `Screen` | Black bg + SafeArea + light StatusBar wrapper |
| `Card` | Rounded `bgElevated` surface; props `padding`, `radius`, `onPress` |
| `PillButton` | Pill button — variants: `primary` (orange), `secondary` (dark), `sell`, `buy`, `danger` |
| `IconButton` | Circular icon button (search, chat, back, close) |
| `BottomNavPill` | Floating 4-tab pill nav with active tab in dark capsule |
| `SegmentedTabs` | Two-segment header toggle (Watchlist \| Explore, CFDs \| Copy) |
| `CategoryTabs` | Horizontal scrollable pill tabs with orange underline |
| `QuickActionTile` | Circular icon + label + optional "New" badge |
| `SymbolIcon` | Colored circle with symbol initials/flag/coin (pure CSS, no images) |
| `Sparkline` | SVG mini chart from `number[]`; green if last≥first else red |
| `InstrumentRow` | SymbolIcon + name + Sparkline + price + %change row |
| `StatCard` | Label + value + optional delta tile |
| `BuySellSplit` | Sell-pink / Buy-grey split with spread chip in center |
| `NumberStepper` | `−ʼvalueʼ+` stepper |
| `DiscreteSlider` | Slider with snap dots for lot presets |
| `CheckboxRow` | Square checkbox + label |
| `Sheet` | Bottom-sheet modal |
| `CalendarStrip` | 7-day horizontal chip strip with active day in orange circle |
| `SpotlightCard` | Card with title + items + glowing ProlineMarket wordmark badge |
| `MoversBars` | 5-bar vertical visualization for risers/fallers (SVG rects) |
| `StrategyCard` | Avatar + name + category + 30D return for Copy section |
| `MenuRow` | Icon + label + value + chevron for Profile menu rows |
| `Toast` | Top-of-screen toast notification (Reanimated, ~50 lines) |
| `EmptyState` | Empty list placeholder (existing, restyled) |

Old `src/components/ui/TabBar.js` and `ScreenHeader.js` are unused after Phase 8 and deleted.

---

## 5. Navigation Shell

**File:** `App.js` (replaces existing single stack).

```
RootNavigator (conditional on AuthContext.user)
├── AuthStack       (when !user)
│   ├── Login
│   ├── Signup
│   └── ForgotPassword
└── MainTabs        (when user) — BottomNavPill floats above safe area
    ├── HomeTab     (stack)
    │   ├── Home
    │   ├── EconomicCalendar
    │   ├── Notifications
    │   ├── Search
    │   ├── Portfolio
    │   └── ProfileMenu   (animation: slide_from_left)
    │       ├── KYC
    │       ├── Accounts
    │       ├── Support
    │       ├── IB / Business
    │       ├── PAMM
    │       ├── Academy
    │       ├── RiskCalculator
    │       ├── Instructions
    │       └── Settings (Language, Theme, Security, Notifications)
    ├── MarketsTab  (stack)
    │   ├── Markets       (hosts Watchlist | Explore)
    │   ├── InstrumentDetail
    │   └── WatchlistEdit
    ├── TradeTab    (stack)
    │   ├── Trade         (hosts CFDs | Copy)
    │   ├── StrategyDetail
    │   ├── OrderBook
    │   └── PositionDetail
    └── FundsTab    (stack)
        ├── Funds
        ├── Deposit
        ├── DepositRazorpay
        ├── DepositOxaPay
        ├── DepositOnchain
        ├── DepositManual
        ├── Withdraw
        ├── WithdrawCrypto
        ├── WithdrawManual
        ├── Transfer
        └── TransactionHistory
```

- Tabs preserve their stack state on switch.
- After login the user lands on `HomeTab > Home`.
- Any "Trade" CTA pushes `TradeTab > Trade` with `route.params.symbol` pre-filled.
- Notifications deep-link to relevant screens (e.g., deposit complete → FundsTab > TransactionHistory).

---

## 6. Home Screen

**File:** `src/screens/HomeScreen.js` (replaces `DashboardScreen.js`).

**Sections (top → bottom):** sticky header (avatar / search / chat with red-dot) · BalanceBlock (Total Value + 👁 hide toggle + Today's PnL) · QuickActionsGrid (4 tiles: Promotion · Calendar · Academy · IB) · PromoBanner (admin-controlled hero banner) · StrategyCarousel (horizontal scroll of top strategies) · WatchlistList (pinned symbols with sparklines).

**Data flow**

| Block | Endpoint(s) |
|---|---|
| Avatar / profile | `GET /profile` (cached in AuthContext) |
| Chat red-dot | `GET /support/tickets?status=unread` |
| Balance / PnL | `GET /portfolio/summary` + `GET /portfolio/performance?period=1d` |
| Promotion "New" badge | `GET /banners` — local-storage tracks lastReadBannerId |
| PromoBanner | `GET /banners?type=hero` (top item) |
| StrategyCarousel | `GET /social/leaderboard?sort=overall&limit=10` |
| WatchlistList | SecureStore `@prolinemarket/watchlist` + `GET /instruments/prices/all` + WS `/ws/prices` patch |
| Sparkline per row | `GET /instruments/{symbol}/bars?resolution=60&limit=24` (cached 60 s) |

**Behaviors:** pull-to-refresh re-fetches; live ticks patch rows individually via `React.memo`; hidden-balance state persisted to SecureStore (`@prolinemarket/balance-hidden`).

**Dropped Vantage features:** ❌ News tile, ❌ Webinar tile (not in backend).

---

## 7. Markets Screen

**File:** `src/screens/MarketsScreen.js` (new — no current equivalent).

Top header uses `SegmentedTabs` to switch between **Watchlist** and **Explore**.

### 7A. Explore sub-view
QuickActionsGrid (Calendar · Risk Calculator — 2 tiles, dropped Analysis & News) · CategoryTabs (Overview · Indices · Forex · Crypto · Metals · Shares) · SpotlightCard (top-3 marquee instruments with glowing wordmark) · MoversBars (Top risers / Top fallers tabs, 5 bars) · Essentials list (filtered by selected segment).

**Data**: `GET /instruments/prices/all` (sorted client-side for movers/spotlight), `GET /instruments` (segment filter), per-row sparklines as in Home, WS patch for live prices.

### 7B. Watchlist sub-view
Filter chips (All · Indices · Crypto · Metals) + sort icon · InstrumentRow list (reused) · bottom-fixed action bar (Edit / + Add).

**Data**: SecureStore pinned symbols + same prices source as Home.

**Behaviors**: row tap from Watchlist pushes `TradeTab > Trade` with symbol; row tap from Explore pushes `Markets > InstrumentDetail`. Empty Watchlist → "Tap + Add" with CTA.

### `InstrumentDetail` screen
Symbol header · mini chart (TradingView WebView reused) · Bid/Ask/Spread/24h H/L/Volume stats · "Trade" CTA · "Add to Watchlist" toggle.

---

## 8. Trade Screen

**File:** `src/screens/TradeScreen.js` (orchestrator). The current `MainTradingScreen.js` (~360 KB) is split into:
- `TradeScreen.js` — top-level + segmented tabs (~200 lines)
- `src/screens/trade/OrderTicket.js` — order form
- `src/screens/trade/ChartPanel.js` — TradingView WebView host
- `src/screens/trade/PositionsList.js` — open positions + pending orders
- `src/screens/trade/AccountSwitcher.js` — bottom-sheet account selector
- `src/chart/bootstrap.js` — the existing chart bootstrap JS string (extracted; **content unchanged from the rebrand step**)

### 8A. CFDs sub-view
Account switcher row (with Equity readout) · symbol row with chart icon (📊 opens chart modal) · **BuySellSplit** (Sell-pink ↔ Buy-grey with spread chip) · order-type dropdown (`market | limit | stop`) · limit-price input (limit/stop only) · NumberStepper for Volume + Lots unit selector · DiscreteSlider with max-lots presets · TP/SL checkbox (collapsible price inputs) · Margin/Fees/Free Margin/Margin-Level-After/Leverage info table · big Sell/Buy PillButton CTA · Positions/Pending tabs with rows and "Close All" dropdown.

**Endpoints**

| Action | API |
|---|---|
| Account list | `GET /accounts` |
| Equity | `GET /accounts/{id}/summary` (+ WS `/ws/trades/{accountId}`) |
| Bid / Ask | `GET /instruments/{symbol}/price` (+ WS `/ws/prices`) |
| Place order | `POST /orders { account_id, symbol, side, order_type, volume, price?, stop_price?, stop_loss?, take_profit? }` |
| Positions list | `GET /positions?account_id={id}&status=open` |
| Pending orders | `GET /orders?account_id={id}&status=pending` |
| Modify position | `PUT /positions/{id}` |
| Close position | `POST /positions/{id}/close` |
| Cancel order | `DELETE /orders/{id}` |
| Close All | iterate `POST /positions/{id}/close` — confirm at impl time if backend exposes a bulk endpoint |

**Chart panel**: hidden by default; opens as a fullscreen modal when the chart icon is tapped. Keeps the order ticket as the primary surface and dodges the 5840-line chart bootstrap on mount of every trade view.

### 8B. Copy sub-view
"Become a Signal Provider" entry card · Discover/Community sub-tabs · top-1 "Best Overall Strategies" card · Leaderboards (Most Copied · Highest Return · Highest Win Rate) · "Top 20 Performing Signal Providers" banner · Starter Guide horizontal cards.

**Endpoints**

| Action | API |
|---|---|
| Become provider eligibility | `GET /social/masters/eligibility` |
| Apply | `POST /social/masters/apply` (or `POST /social/become-provider`) |
| Leaderboards | `GET /social/leaderboard?sort=most_copied\|highest_return\|highest_win_rate` |
| Followers | `GET /followers/my-followers` |
| Strategy detail | `GET /social/providers/{id}` |
| Copy subscription | `POST /social/copy` |
| MAMM/PAMM invest | `POST /social/mamm-pamm/{id}/invest` |

### `StrategyDetail` screen
Header (avatar + name + follower count + open/full) · stats grid (30D / 90D / 1Y returns, ROI, drawdown, win rate, AUM) · performance line chart · recent trades list · bottom "Copy" / "Invest" CTA.

### Absorbed/deleted
- `MainTradingScreen.js` → split as above
- `CopyTradeScreen.js`, `SocialScreen.js` → merged into Copy sub-view
- `PammScreen.js` retained only as "My PAMM Investments" detail page reached from Copy or Profile menu

---

## 9. Funds Screen + Payment Gateway Integration

**Folder:** `src/screens/funds/`.

### 9A. `FundsScreen.js` (replaces `WalletScreen.js`)
BalanceBlock (Total Balance + Main/Trading split) · 4-tile action grid (Deposit · Withdraw · Transfer · History) · Recent Transactions list (last 5).

**Data:** `GET /wallet/summary` + `GET /wallet/transactions?limit=5`.

### 9B. `DepositScreen.js` — method picker
Amount input (USD) with quick-amount chips ($100/$500/$1000/$5000) + four method tiles:

| Tile | Sub-screen | Backend flow |
|---|---|---|
| 💳 Card / UPI / Netbanking (Razorpay) | `DepositRazorpay.js` | `GET /wallet/deposit/razorpay/rate` → `POST /wallet/deposit/razorpay/order` → WebView with Razorpay Checkout JS → on `handler` postMessage call `POST /wallet/deposit/razorpay/verify` |
| ₿ Crypto (OxaPay) | `DepositOxaPay.js` | `POST /wallet/deposit { method:'oxapay', amount, currency }` → open returned payment_url in WebView → poll `GET /wallet/transactions` for the new deposit_id |
| ⛓ Direct USDT (TRC20 / BEP20 / ERC20) | `DepositOnchain.js` | `GET /wallet/deposit/bank-details` (returns admin addresses) → display QR + address + warning → user submits tx_hash via `POST /wallet/deposit/onchain` → poll `GET /wallet/deposit/{id}/onchain-status` every 10s up to 30 min |
| 🏦 Manual Bank / UPI | `DepositManual.js` | `GET /wallet/deposit/bank-details` → user picks bank/UPI → pays externally → uploads proof via `POST /wallet/deposit/manual` (multipart) |

**Why WebView (not native) Razorpay:** zero new native deps, no dev-client rebuild, works in Expo Go. Native SDK may be added later if UX demands.

### 9C. `WithdrawScreen.js` — method picker

| Tile | Sub-screen | Backend |
|---|---|---|
| ⛓ Crypto | `WithdrawCrypto.js` | `POST /wallet/withdraw/onchain { chain, amount, address }` → poll `GET /wallet/withdraw/{id}/onchain-status` |
| 🏦 Manual UPI | `WithdrawManual.js` | `POST /wallet/withdraw/manual` multipart (UPI ID + amount + optional QR proof) |

Both withdrawal flows are **step-up auth gated**. On 401 with `step_up_required`, present OTP modal (`POST /auth/step-up/start` → `POST /auth/step-up/verify`), then resubmit. KYC gate: if `kyc_status !== 'approved'`, show banner with deep link to ProfileMenu > KYC.

### 9D. `TransferScreen.js`
From/To account dropdowns + amount + confirm sheet. Endpoints: `POST /wallet/transfer-internal`, `/wallet/transfer-main-to-trading`, `/wallet/transfer-trading-to-main` depending on direction.

### 9E. `TransactionHistoryScreen.js` (rewritten)
Tabs (All · Deposits · Withdrawals · Transfers) + date-range chip + infinite scroll on `GET /wallet/transactions?page={n}&type={filter}`. Row tap → detail sheet with tx hash / payment_id / proof image / admin notes.

### New dependency
- `react-native-qrcode-svg` — for on-chain QR codes. Uses existing react-native-svg, no native module.

### Helper
`src/utils/stepUp.js` — central 401-with-step_up handler shared by all withdrawal screens.

### Absorbed/deleted
`WalletScreen.js` is removed; logic spreads across the seven `funds/` files above.

---

## 10. Auth + Profile

### 10A. `src/screens/auth/`
- `LoginScreen.js` — wordmark + tagline · email · password (with 👁 toggle) · Forgot link · big orange Log In · "or continue with Google" (conditional on Google client ID env) · Sign up link.
- `SignupScreen.js` — email · password (strength meter) · full name · country dropdown · referral (auto-fill from deep link) · ToS checkbox · Create Account → email OTP screen → into MainTabs.
- `ForgotPasswordScreen.js` — progressive 3-step (email → OTP → new password) on one screen.
- `TwoFactor.js` — TOTP input shown only if login returns `2fa_required`.

**Endpoints**: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` (TBC vs `/auth/verify-reset-otp` — see Open Questions), `/auth/email/start-verification`, `/auth/email/verify-otp`, `/auth/2fa/verify`, `/auth/google` (optional).

**Google sign-in** adds `expo-auth-session` + `expo-crypto`. Optional — drop if not desired.

### 10B. `src/screens/profile/ProfileMenuScreen.js` (replaces `ProfileScreen.js`)
Slide-in-from-left drawer with sections: header (avatar + name + email + KYC badge) · ACCOUNTS (My Accounts, Open New Account) · VERIFICATION (KYC) · PROGRAMS (IB, Sub-Broker, PAMM) · TOOLS (Academy, Risk Calculator, Economic Calendar, Order History) · SETTINGS (Language, Theme, Security & 2FA, Notifications) · HELP (Support, Instructions, About) · Logout (red outline pill → `POST /auth/logout`).

Each row uses `<MenuRow icon label value chevron onPress />`.

---

## 11. Phase 8 Cleanup

Secondary screens get visual restyle only (layout unchanged):

| Screen | Action |
|---|---|
| `KycScreen.js` | Token swap, file-upload tiles as Cards, orange Submit |
| `NotificationsScreen.js` | Empty state Vantage-style, rows as Card with colored accent strip |
| `SupportScreen.js` | Ticket cards, orange FAB |
| `AcademyScreen.js` | Phase cards Vantage style, orange progress bars |
| `PortfolioScreen.js` | Stats via `<StatCard>`, dark chart |
| `IBScreen.js` / `BusinessScreen.js` | Card grid layout |
| `PammScreen.js` | "My PAMM Investments" view only (other PAMM UX moved into Copy sub-view) |
| `OrderBookScreen.js` | Row restyle |
| `RiskCalculatorScreen.js` | Inputs dark style, orange result card |
| `EconomicCalendarScreen.js` | Reuses `<CalendarStrip>` |
| `InstructionsScreen.js` | Step cards Vantage style |

**Deletions at end of Phase 8:**
- `src/theme/colors.js`
- `src/components/ui/TabBar.js`, `src/components/ui/ScreenHeader.js`
- `src/screens/DashboardScreen.js`, `MainTradingScreen.js`, `WalletScreen.js`, `CopyTradeScreen.js`, `SocialScreen.js`, `ProfileScreen.js` (after replacements are wired)

---

## 12. Cross-cutting

### Error handling
- `ApiService.request` already throws on non-2xx. Each screen wraps calls in try/catch → toast via new `<Toast>` component.
- Offline detection through `@react-native-community/netinfo` (Expo built-in) → top banner.
- Token refresh handled by existing `authedFetch`. Permanent 401 resets to AuthStack.

### Performance
- `FlatList` for any list >10 rows.
- `React.memo(InstrumentRow)` + stable callback props for live-tick updates.
- Chart WebView mounts on demand (Trade screen modal only).
- Sparkline bar data cached in-memory per symbol for 60 s.

### Accessibility
- `accessibilityLabel` on every Pressable.
- `accessibilityRole="button"` on PillButtons.
- WCAG AA contrast on Vantage tokens against black bg.

### Testing
- No automated suite. Each phase ships with a manual smoke checklist (physical Android via Expo Go).

---

## 13. Phased Rollout Order

| Phase | Deliverable | User-visible result |
|---|---|---|
| 0 | Design tokens + shared components in `src/theme/` and `src/components/vantage/` | None (foundation) |
| 1 | Navigation shell — `App.js` swap to BottomNavPill, 4-tab routes scaffolded | First Vantage look lands (bottom nav) |
| 2 | Home screen | Visible redesign of landing screen |
| 3 | Markets screen (Watchlist + Explore) | Markets browse-able |
| 4 | Trade screen — CFDs sub-view + Copy sub-view | Order ticket + Copy trading flow |
| 5 | Funds — overview + Razorpay + OxaPay + on-chain + manual + Withdraw + Transfer + History | Payment gateways live |
| 6 | Auth — Login + Signup + ForgotPassword + 2FA + (optional) Google | New auth UX |
| 7 | Profile menu + KYC + Security + Settings | Profile/Settings UX |
| 8 | Secondary screen restyling + old-file deletion | Final polish |

Every phase ends with a manual smoke test on Android Expo Go before the next phase begins.

---

## 14. New Dependencies

| Package | Reason | Phase | Size |
|---|---|---|---|
| `react-native-qrcode-svg` | On-chain deposit QR | 5 | ~10 KB |
| `expo-auth-session` + `expo-crypto` (optional) | Google sign-in on Auth | 6 | depends on platform |

Everything else (`react-native-svg`, `react-native-webview`, `expo-image-picker`, navigation libs, secure-store, dotenv) is already in `package.json`.

---

## 15. Open Questions / Risks

| # | Question | Resolution path |
|---|---|---|
| Q1 | Backend `auth/reset-password` vs app's `/auth/verify-reset-otp` — endpoint name mismatch. | Confirm with backend in Phase 6; if different, update app accordingly. |
| Q2 | Bulk "Close All" positions endpoint — does it exist? | Check during Phase 4 impl; if not, iterate single-close. |
| Q3 | Backend "Spotlight" flag on instruments? | If exists, use it; else fall back to marquee list `['XAUUSD','BTCUSD','NAS100']` in Phase 3. |
| Q4 | Backend "Shares" segment availability — does ProlineMarket list equities? | Inspect `GET /instruments` response in Phase 3; hide Shares tab if no rows. |
| Q5 | Master eligibility endpoint exact path (`/social/masters/eligibility` vs `/social/become-provider` precheck). | Check during Phase 4. |
| Q6 | Splash animation asset format (Lottie JSON / video / image sequence). | User will supply; spec reserves the slot only. |

---

## 16. Files added / replaced / deleted (summary)

**Added (~50 new files):**
- `src/theme/vantageTheme.js`
- `src/components/vantage/*` (~24 components)
- `src/screens/HomeScreen.js`
- `src/screens/MarketsScreen.js`, `InstrumentDetailScreen.js`, `WatchlistEditScreen.js`
- `src/screens/TradeScreen.js`, `trade/OrderTicket.js`, `trade/ChartPanel.js`, `trade/PositionsList.js`, `trade/AccountSwitcher.js`, `trade/StrategyDetailScreen.js`, `trade/PositionDetailScreen.js`
- `src/screens/funds/` (7 screens)
- `src/screens/auth/LoginScreen.js`, `SignupScreen.js`, `ForgotPasswordScreen.js`, `TwoFactor.js`
- `src/screens/profile/ProfileMenuScreen.js`
- `src/chart/bootstrap.js` (extracted from MainTradingScreen)
- `src/utils/stepUp.js`

**Replaced / restyled in place:**
- All 22 existing screens — either rewritten (above) or restyled in Phase 8.

**Deleted (after rollout):**
- `src/theme/colors.js`
- `src/components/ui/TabBar.js`, `ScreenHeader.js`
- `src/screens/DashboardScreen.js`, `MainTradingScreen.js`, `WalletScreen.js`, `CopyTradeScreen.js`, `SocialScreen.js`, `ProfileScreen.js`
