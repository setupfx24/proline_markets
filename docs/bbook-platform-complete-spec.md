# Forex CFD B-Book Trading Platform — Complete Specification

## Architecture: B-Book Model
- No external liquidity providers — admin IS the counterparty
- Real market data feed connected for pricing (not execution)
- All trades execute against the house book
- Admin controls spread, swap, charges, and can manage positions

---

## USER SIDE — 11 Modules

### 1. Dashboard
- Portfolio summary (balance, equity, margin, free margin, PnL)
- Promotional banners (admin-uploaded, rotational carousel)
- Market news feed (real-time, economic calendar integration)
- Quick trade widgets (top movers, watchlist shortcuts)
- Account alerts & notifications

### 2. Trading Workspace
- Custom charting engine (Canvas2D, WebGL fallback)
  - OHLCV candlesticks, line, area, Heikin-Ashi
  - 30+ indicators (MA, BB, RSI, MACD, Stoch, ATR, Ichimoku, VWAP, etc.)
  - Drawing tools (trendlines, Fibonacci, rectangles, channels, pitchfork)
  - Multiple timeframes (1m, 5m, 15m, 30m, 1H, 4H, Daily, Weekly, Monthly)
- Order panel
  - Market order, limit order, stop order, stop-limit
  - SL/TP with drag-on-chart
  - Lot size calculator with margin preview
  - One-click trading mode
- Positions table (live PnL, swap, commission, SL/TP displayed)
- Order book (pending orders with modify/cancel)
- Trade history (closed trades, statements, export CSV/PDF)
- Depth of market (Level 2 view)

### 3. Wallet System
- Internal wallet balance
- Manual deposit (bank transfer, UPI)
- Crypto deposit (BTC, ETH, USDT — on-chain)
- MetaMask integration (connect wallet, deposit/withdraw)
- Currency conversion (fiat ↔ crypto, rates from data feed)
- Transaction history with status tracking
- Fund transfer between accounts (if multi-account)

### 4. Deposit & Withdrawal
- Deposit: bank transfer, UPI, QR scan, crypto
- Upload screenshot + transaction ID for manual verification
- Withdrawal: bank, UPI, crypto wallet
- Withdrawal request with status tracking
- Minimum/maximum limits per method
- Processing time estimates

### 5. Social Trading
- Leaderboard (ranked by return %, drawdown, Sharpe, followers)
- Follow/copy a signal provider
- Set allocation %, max drawdown, max lot override
- Real-time copy with adjustable ratio
- Unfollow with open position handling (close all / keep)

### 6. MAMM / PAMM
- Browse available master accounts
- Request to join as investor (allocation amount)
- View master's performance, drawdown, history
- Profit distribution dashboard
- Request to BECOME a master (goes to admin for approval)
- Master dashboard: see all investors, performance, commission earned

### 7. Algo Trading
- Strategy editor (Python-based, sandboxed)
- Backtest engine
  - Select date range, instrument, timeframe
  - Run on historical data
  - Results: equity curve, drawdown, win rate, Sharpe, trade log
- Deploy strategy to live account
- Algo dashboard
  - All running strategies with live PnL
  - All backtest history
  - Modify strategy parameters without stopping
  - Pause/resume/stop strategy
- Strategy templates (MA crossover, grid, mean reversion, RSI)

### 8. Business Section — IB
- Apply to become an IB (form → admin approval)
- Get unique referral link (UTM tracked)
- IB dashboard:
  - Referral tree visualization
  - Commission earned (per trade, per lot)
  - Payout history & pending
  - Sub-IB performance (if MLM enabled)

### 9. Business Section — Sub-Broker
- Apply to become a sub-broker
- Get personal admin dashboard (limited):
  - See own clients
  - Client trading activity
  - Commission on client trades
  - Cannot modify trades or accounts (read-only + referral)

### 10. Portfolio & Order Book
- Open positions with live PnL
- Pending orders
- Closed trade history
- Account statement (daily, weekly, monthly, custom range)
- Performance analytics (win rate, avg trade, best/worst day)
- Export to CSV/PDF

### 11. Profile & Settings
- Personal details (name, email, phone, address)
- Password change
- 2FA setup (TOTP, SMS)
- Notification preferences
- Theme (dark/light)
- Language preference
- Trading preferences (default lot size, one-click settings)

### 12. Support (User Side)
- Create support ticket
- Live chat (WebSocket-based)
- FAQ / knowledge base
- Ticket history with status

---

## ADMIN SIDE — 16 Modules

### A1. User Management
- User list with search, filter (active, banned, KYC status)
- "Login as user" (impersonate — see exactly what user sees)
- User detail view:
  - All account info, KYC documents
  - Add fund / deduct fund (manual adjustment)
  - Give credit / take credit (non-withdrawable)
  - Ban user (full account freeze)
  - Block user (trading disabled, can view)
  - Kill switch (instant close all positions + block)
  - Stop trading with time limit (e.g., block for 24 hours)
  - IP address log (all IPs used)
  - Device login history (browser, OS, timestamps)
  - Session management (force logout all devices)

### A2. Trade Management
- All trades view (open, closed, pending — across all users)
- Filter by user, symbol, date, status
- Modify running trade:
  - Change SL/TP
  - Change lot size
  - Close partially or fully
  - **STEALTH MODE**: all admin modifications appear as user-initiated in user's dashboard
- Create trade in any user's account:
  - Market or pending order
  - Appears as if user placed it
- Trade history with full audit trail (admin-only view)

### A3. Deposit & Withdrawal Management
- Pending deposit requests with:
  - User-uploaded screenshot
  - Transaction ID
  - Amount, method, timestamp
  - Approve / reject with reason
- Pending withdrawal requests with:
  - Amount, method, bank details
  - Approve / reject
- Automation mode:
  - Auto-approve deposits below threshold
  - Auto-verify transaction ID against bank API (if available)
  - Manual override always available
- Transaction history (all deposits/withdrawals, filterable)

### A4. Bank Management
- Add multiple bank accounts (name, number, IFSC, bank name)
- Add UPI IDs
- Add QR codes (upload image)
- **Tier-based routing**:
  - Tier 1: ₹1,000 - ₹5,000 → show QR set A
  - Tier 2: ₹5,000 - ₹10,000 → show QR set B
  - Tier 3: ₹10,000+ → show QR set C
  - Admin configurable tiers and amounts
- **Auto-shuffle**: rotate which account/QR is shown within a tier
  - Round-robin or random per request
  - Daily/weekly rotation schedule
  - Load balancing across accounts
- Enable/disable individual accounts

### A5. Charges Configuration
- Charge types: commission per lot, per trade, percentage of spread
- Configuration levels (priority: user > instrument > segment > default):
  1. **Default** (applies to all)
  2. **Per segment** (forex, indices, commodities, crypto, stocks)
  3. **Per instrument** (EURUSD, XAUUSD, etc.)
  4. **Per user** (override for specific accounts)
- Checkbox grid view:
  - Rows = all instruments grouped by segment
  - Columns = charge type, current value, enable/disable
  - Bulk edit: select multiple → set charge → apply
- Quick view: "what charges is user X paying?" summary

### A6. Spread Configuration
- Same hierarchy as charges (default → segment → instrument → user)
- Spread types:
  - Fixed spread (constant pips added)
  - Variable markup (% on top of feed spread)
- Same checkbox grid UI as charges
- Real-time preview: show current feed spread + markup = displayed spread

### A7. Swap Configuration
- Swap long and swap short per instrument
- Triple swap day (usually Wednesday for forex)
- Same hierarchy (default → segment → instrument → user)
- Swap-free accounts option (Islamic accounts)

### A8. MAMM / PAMM Admin
- Pending master requests (approve / reject)
- Before approving, admin sets:
  - Commission markup (admin takes X% of master's fee)
  - Performance fee structure
  - Maximum investors allowed
- Active master accounts overview
- Social trading provider requests (same flow)
- Commission distribution reports

### A9. IB Management
- Pending IB applications (approve / reject)
- Commission plans:
  - Default plan (applies to all IBs)
  - Custom plan per IB (override default)
  - Commission types: per lot, per trade, spread share, CPA (per deposit)
- **MLM Chain System**:
  - Admin sets number of levels (e.g., 5 levels deep)
  - Distribution per level (e.g., L1: 40%, L2: 25%, L3: 15%, L4: 10%, L5: 10%)
  - Tree visualization (who referred whom, down to N levels)
  - Auto-calculation and payout scheduling
- IB performance reports

### A10. Sub-Broker Management
- Pending applications
- Sub-broker gets a limited admin dashboard
- Commission on all client activity under them
- Admin can set commission rates
- Sub-broker cannot modify client accounts or trades
- Performance tracking and reports

### A11. Analytics Dashboard (Real-Time)
- Revenue streams broken down:
  - Spread revenue (per second/minute/hour)
  - Commission revenue
  - Swap revenue
  - Social trading markup revenue
  - IB commission (cost)
- Per-user profitability
- Total platform P&L (day, week, month, year, all-time)
- Live feed: every trade, every commission, every deposit — real-time ticker
- Charts: revenue trend, user growth, active traders, volume
- Export reports (CSV, PDF)

### A12. Bonus Management
- Create bonus offers:
  - Deposit bonus (e.g., 20% on deposits above ₹10,000)
  - Welcome bonus (new accounts)
  - Trading volume bonus
- Bonus rules:
  - Goes to credit section (non-withdrawable)
  - Conditions for release (e.g., trade X lots to convert to balance)
  - Expiry date
  - Max bonus per user
- Active/expired/upcoming offers view
- Per-user bonus history

### A13. Banner Management
- Upload banners (image, link, target: dashboard/trading/deposit page)
- Schedule (start date, end date, always-on)
- Target audience (all users, specific segments, new users only)
- Position (top banner, sidebar, popup)
- Priority ordering (drag to reorder)
- Click tracking analytics

### A14. Support Admin
- All tickets view (open, in-progress, resolved, escalated)
- Reply to tickets
- Live chat interface
- Assign tickets to team members
- Canned responses
- Average response time tracking
- Escalation rules

### A15. Admin Profile & Settings
- Admin password change
- Admin details update
- Role-based access control (super admin, trade manager, support, finance)
- Activity log (what did each admin do, when)
- Two-factor authentication

### A16. Employee Management
- Add/remove employees
- Assign roles (see A15 for role types)
- Track employee activity (login time, actions taken)
- Commission for sub-brokers who are also employees
- Performance dashboards per employee

---

## SECTIONS YOU MISSED (Recommended Additions)

### User Side Missing:
1. **KYC Module** — Document upload (ID, address proof, selfie), verification status, reminder to complete before trading
2. **Demo Account** — Practice account with virtual funds, switch between demo/live
3. **Notifications Center** — In-app notification bell, push notifications, email alerts for margin call, SL hit, deposit confirmed, etc.
4. **Economic Calendar** — Built-in calendar showing upcoming events (NFP, FOMC, CPI) with impact ratings
5. **Multi-Account** — User can have multiple accounts (e.g., Standard, ECN, Cent) and switch between them
6. **Referral Rewards** — User-facing referral program (not just IB — casual "invite friends" with small rewards)

### Admin Side Missing:
7. **KYC Verification Queue** — Admin reviews uploaded documents, approve/reject with reason, auto-expiry reminders
8. **Risk Dashboard** — B-book specific: which users are profitable (admin is losing money on them), exposure per instrument, hedging alerts
9. **Instrument Management** — Add/remove instruments, set trading hours, set lot size constraints, enable/disable per segment
10. **Notification Management** — Configure automated notifications (margin call at 80%, stop-out at 50%, etc.), push notification campaigns
11. **Account Group Management** — Create account types (Standard, ECN, VIP, Demo, Islamic) with different leverage, spread, commission defaults
12. **Audit Log** — Full audit trail of every admin action, every trade modification, every fund adjustment — for compliance
13. **System Settings** — Global settings: default leverage, margin call level, stop-out level, max open trades per account, maintenance mode
14. **Report Scheduling** — Auto-generate daily P&L reports, weekly IB payouts, monthly statements — email to admin

### Critical for B-Book:
15. **Exposure Monitor** — Real-time view of admin's net exposure per instrument. If 100 users are long XAUUSD, admin is short — this dashboard shows that risk.
16. **Hedging Controls** — If exposure gets too high on one side, admin can choose to hedge externally (optional future feature)
17. **Price Manipulation Guard** — Logging system that tracks if/when admin-side spread changes affected active trades (compliance protection)

---

## TECH STACK (Confirmed)

### Backend
- **Python 3.12 + FastAPI** — all services
- **Cython** — matching engine hot path, margin calculator
- **Kafka** — event bus (trades, deposits, commissions)
- **Redis** — live price pub/sub, session cache, rate limiting
- **TimescaleDB** — tick/bar storage (market data)
- **PostgreSQL** — all business data
- **Celery + Redis** — async tasks (email, reports, payout calculation)

### Frontend
- **Next.js 14** (App Router) — both user and admin panels
- **TypeScript** — everything
- **Canvas2D / WebGL** — custom charting engine
- **Zustand** — state management
- **TailwindCSS** — styling
- **ethers.js** — MetaMask integration
- **WebSocket** — real-time prices, trade updates, notifications

### Infrastructure (AWS)
- ECS Fargate — service containers
- RDS (PostgreSQL) — business DB
- EC2 (TimescaleDB) — market data
- ElastiCache (Redis) — cache + pub/sub
- MSK (Kafka) — event streaming
- CloudFront + S3 — frontend CDN
- SES — transactional emails
- CloudWatch + Grafana — monitoring

---

## BUILD ORDER (Revised for B-Book)

### Phase 1: Core Engine (Weeks 1-4)
1. Monorepo + Docker Compose + CI/CD
2. Market data feed handler (connect to free/paid feed)
3. B-book matching engine (all trades execute internally)
4. Risk engine (margin calc, SL/TP, stop-out)
5. Basic WebSocket gateway
6. **Milestone: orders execute, positions track, prices stream**

### Phase 2: Charting + Trading UI (Weeks 5-8)
1. Custom charting engine (candlesticks, axes, crosshair)
2. 8 core indicators (MA, BB, RSI, MACD, Stoch, ATR, VWAP, Ichimoku)
3. Drawing tools (trendlines, Fibonacci, horizontals)
4. Trading workspace (order panel, positions, order book)
5. One-click trading mode
6. **Milestone: users can see charts and trade**

### Phase 3: Account & Wallet (Weeks 9-11)
1. Auth (register, login, 2FA)
2. KYC module
3. Wallet system (manual + crypto + MetaMask)
4. Deposit/withdrawal flow
5. User dashboard with banners and news
6. **Milestone: full onboarding → deposit → trade → withdraw**

### Phase 4: Admin Panel Core (Weeks 12-15)
1. User management (login-as, fund, credit, ban, kill)
2. Trade management (view, modify, create, stealth mode)
3. Deposit/withdrawal admin (approve, screenshot verify)
4. Bank management with tier routing + auto shuffle
5. Charges, spread, swap configuration (checkbox grid)
6. **Milestone: admin can manage entire platform**

### Phase 5: Business Features (Weeks 16-19)
1. IB system + MLM chain
2. Sub-broker management + personal dashboards
3. MAMM/PAMM system
4. Social trading (copy engine, leaderboard)
5. Bonus management
6. **Milestone: full business operations running**

### Phase 6: Algo + Advanced (Weeks 20-23)
1. Strategy editor + sandboxed execution
2. Backtest engine
3. Algo deployment + dashboard
4. Analytics dashboard (real-time P&L)
5. Support system (tickets + live chat)
6. Banner management
7. **Milestone: complete platform**

### Phase 7: Polish + Production (Weeks 24-26)
1. AWS Terraform deployment
2. Load testing
3. Security audit
4. Mobile responsive optimization
5. Employee management + audit logs

---

## MONOREPO STRUCTURE (Updated)

```
nexus-broker/
├── packages/
│   ├── shared-types/          # TypeScript types shared frontend ↔ backend
│   ├── proto/                 # API contracts
│   └── common/                # Python shared utilities
│
├── services/
│   ├── gateway/               # FastAPI WebSocket + REST gateway
│   ├── b-book-engine/         # Matching, execution, position management
│   ├── risk-engine/           # Margin, SL/TP, stop-out, exposure monitor
│   ├── market-data/           # Feed handler, normalizer, distributor
│   ├── account/               # Auth, KYC, profiles, multi-account
│   ├── wallet/                # Deposits, withdrawals, crypto, MetaMask
│   ├── social-trading/        # Copy engine, MAMM/PAMM, leaderboard
│   ├── ib-system/             # IB, sub-broker, MLM chain, commissions
│   ├── algo-engine/           # Strategy sandbox, backtest, deployment
│   ├── notification/          # Email, push, in-app, SMS
│   ├── support/               # Tickets, live chat
│   ├── bonus/                 # Bonus offers, credit management
│   ├── analytics/             # Real-time P&L, reports, dashboards
│   └── banner/                # Banner CRUD, scheduling, targeting
│
├── frontend/
│   ├── trader/                # Next.js — user-facing platform
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── trading/
│   │   │   │   ├── wallet/
│   │   │   │   ├── social/
│   │   │   │   ├── algo/
│   │   │   │   ├── business/
│   │   │   │   ├── portfolio/
│   │   │   │   ├── support/
│   │   │   │   └── profile/
│   │   │   ├── charting/      # Custom chart engine
│   │   │   ├── components/
│   │   │   ├── stores/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── admin/                 # Next.js — admin panel (separate app)
│       ├── src/
│       │   ├── app/
│       │   │   ├── users/
│       │   │   ├── trades/
│       │   │   ├── deposits/
│       │   │   ├── banks/
│       │   │   ├── config/    # charges, spread, swap
│       │   │   ├── social/
│       │   │   ├── business/  # IB, sub-broker, MLM
│       │   │   ├── analytics/
│       │   │   ├── bonus/
│       │   │   ├── banners/
│       │   │   ├── support/
│       │   │   ├── employees/
│       │   │   └── settings/
│       │   ├── components/
│       │   ├── stores/
│       │   └── lib/
│       └── package.json
│
├── infra/
│   ├── terraform/aws/
│   ├── docker/
│   └── k8s/
│
└── docs/
```
