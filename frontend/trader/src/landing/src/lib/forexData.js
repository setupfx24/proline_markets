export const BRAND = {
  name: "Proline Markets",
  tagline: "Future of Trading. Trusted Worldwide.",
  logo: "/prolinemarket%20logo%20landscap%20png.png",
  regulated: "Trusted by traders worldwide since 2019",
  founded: "2019",
};

export const EXTERNAL = {
  register: "/auth/login",
  login:    "/auth/login",
  whatsapp: "https://wa.me/447577347804",
  howToTrade: "https://www.youtube.com/watch?v=nfP5N9Yc72A&t=28s",
};

export const NAV_ITEMS = [
  { label: "Home",        href: "/" },
  {
    label: "Trading",
    href: "/platform",
    children: [
      { label: "Platform",                href: "/platform" },
      { label: "Accounts Overview",       href: "/accounts" },
      { label: "Cent",                    href: "/accounts/cent" },
      { label: "ECN",                     href: "/accounts/ecn" },
      { label: "Islamic",                 href: "/accounts/islamic" },
      { label: "Standard",                href: "/accounts/standard" },
      { label: "Proline VIP AC",          href: "/accounts/proline-vip" },
      { label: "Try Demo Ac",             href: "/accounts/demo" },
    ],
  },
  {
    label: "Markets",
    href: "/markets",
    children: [
      { label: "Markets Overview", href: "/markets" },
      { label: "Currencies",       href: "/markets/currencies" },
      { label: "Indices",          href: "/markets/indices" },
      { label: "CFDs",             href: "/markets/cfds" },
      { label: "Commodities",      href: "/markets/commodities" },
      { label: "Crypto",           href: "/markets/crypto" },
    ],
  },
  { label: "Partnership", href: "/partnership" },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "About Proline Markets", href: "/about" },
      { label: "Contact us",            href: "/contact" },
    ],
  },
];

export const HEADER_BUTTONS = {
  helpCenter:  { label: "Help Center",  href: "/contact" },
  clientPortal:{ label: "Client Portal", href: "/auth/login" },
  openAccount: { label: "Open an A/c",   href: "/auth/login" },
};

// ===== HERO SLIDER =====
export const HERO_SLIDES = [
  {
    heading: "Future of",
    sub: "Provides an extraordinary trading environment for exceptional traders.",
    ctaPrimary:   { label: "Try Free Demo", href: "/auth/login" },
    ctaSecondary: { label: "How to Trade",  href: "https://www.youtube.com/watch?v=nfP5N9Yc72A&t=28s" },
  },
  {
    heading: "The Safest Place to Trade",
    sub: "Provides an extraordinary trading environment for exceptional traders.",
    ctaPrimary:   { label: "Try Free Demo", href: "/auth/login" },
    ctaSecondary: { label: "How to Trade",  href: "https://www.youtube.com/watch?v=nfP5N9Yc72A&t=28s" },
  },
  {
    heading: "Our Insights Your Evolution",
    sub: "Provides an extraordinary trading environment for exceptional traders.",
    ctaPrimary:   { label: "Try Free Demo", href: "/auth/login" },
    ctaSecondary: { label: "How to Trade",  href: "https://www.youtube.com/watch?v=nfP5N9Yc72A&t=28s" },
  },
];

// Legacy single hero (kept for any leftover refs — points to first slide)
export const HERO = {
  pill: "Since 2019",
  pillBadge: "Live",
  headline: HERO_SLIDES[0].heading,
  sub: HERO_SLIDES[0].sub,
  ctaPrimary: HERO_SLIDES[0].ctaPrimary.label,
  ctaSecondary: HERO_SLIDES[0].ctaSecondary.label,
  ctaHref: HERO_SLIDES[0].ctaPrimary.href,
};

export const PARTNERS = ["MetaTrader 5", "MT4", "WebTrader", "iOS App", "Android App", "VPS"];

// ===== HOME — FOREX PRICING (Top Pricing List) =====
export const LIVE_TICKER = [
  { pair: "EUR/USD", price: "1.06199", change: "-0.14",  up: false, sell: "$1.06199", buy: "$1.06185" },
  { pair: "USD/JPY", price: "1.22195", change: "+0.04",  up: true,  sell: "$1.22195", buy: "$1.22199" },
  { pair: "GBP/USD", price: "0.65982", change: "+0.12",  up: true,  sell: "$0.65982", buy: "$0.65994" },
  { pair: "AUD/CAD", price: "14.785",  change: "-0.14",  up: false, sell: "$14.785",  buy: "$13.625"  },
  { pair: "EUR/JPY", price: "162.14",  change: "-0.11",  up: false },
  { pair: "GBP/JPY", price: "189.54",  change: "+0.19",  up: true  },
  { pair: "XAU/USD", price: "2318.50", change: "+0.45",  up: true  },
  { pair: "BTC/USD", price: "67,420",  change: "+1.82",  up: true  },
  { pair: "WTI OIL", price: "79.35",   change: "+0.31",  up: true  },
  { pair: "US30",    price: "38,420",  change: "+0.55",  up: true  },
  { pair: "NAS100",  price: "17,850",  change: "+0.72",  up: true  },
  { pair: "USD/INR", price: "83.42",   change: "-0.05",  up: false },
];

export const FOREX_PRICING_PAIRS = LIVE_TICKER.slice(0, 4);

// ===== HOME — INSTRUMENTS / MARKETS BENTO =====
export const INSTRUMENTS = [
  { icon: "TrendingUp", title: "Currencies",  badge: "Major / Minor / Exotic", body: "Major, minor and exotic currency pairs. Tight spreads, 24/5 market access and no requotes.",        href: "/markets/currencies" },
  { icon: "BarChart2",  title: "Indices",     badge: "Global Markets",         body: "Trade the world's biggest stock market indices as CFDs with competitive spreads and leverage.",     href: "/markets/indices" },
  { icon: "Layers",     title: "CFDs",        badge: "Multi-Asset",            body: "Speculate on price movement of equities, ETFs and other instruments without owning the asset.",     href: "/markets/cfds" },
  { icon: "Gem",        title: "Commodities", badge: "Metals / Energy",        body: "Gold, Silver, Crude Oil, Natural Gas and more — trade safe-havens and energy markets.",              href: "/markets/commodities" },
  { icon: "Cpu",        title: "Crypto",      badge: "24/7 Markets",           body: "Bitcoin, Ethereum and major altcoins as CFDs — no wallet required, trade 24/7.",                    href: "/markets/crypto" },
  { icon: "Building",   title: "Stocks",      badge: "Global Equities",        body: "Go long or short on global blue-chip stocks as CFDs without owning the underlying shares.",         href: "/markets/cfds" },
];

// ===== HOME — WHY CHOOSE US =====
export const WHY_US = [
  { icon: "ShieldCheck", title: "Friendly & Expert",  body: "Traders around the world trust Proline Markets and have chosen to work or partner with us." },
  { icon: "Headphones",  title: "24/7 Support",       body: "Connect whenever you want. Get 24*7 uninterrupted client support from our experts." },
  { icon: "Zap",         title: "Demo account",       body: "Test the trading environment beforehand. Practice trading before entering the real-time markets." },
  { icon: "TrendingDown",title: "Global Recognition", body: "We continue to develop, extend, and evolve, inspired by the aptitude of industry experts who have recognized and appreciated our efforts." },
];

// ===== HOME — PLATFORM SECTION =====
export const PLATFORM_SECTION = {
  label: "Proline Platform",
  title: "Get an Exclusive Forex Experience with the Proline Platform",
  description: "Trade on one of the emerging trading platforms with access to dedicated support and integrated trading tools exclusive to Proline Markets.",
  features: [
    "Ultra fast trade execution",
    "Trading from a smartphone or tablet",
    "No dealing desk, no requotes",
  ],
  cta: { label: "Read More", href: "/auth/login" },
};

// ===== HOME — HOW IT WORKS (kept generic for the old Process section) =====
export const HOW_IT_WORKS = [
  { n: "1", title: "Open Account",         body: "Register in 3 minutes. Complete KYC and get your live account activated quickly." },
  { n: "2", title: "Fund Your Account",    body: "Deposit via bank transfer, card or crypto. Instant credit to your trading account." },
  { n: "3", title: "Choose Your Platform", body: "Use MT5, our WebTrader in-browser, or trade on iOS and Android. All platforms sync in real-time." },
  { n: "4", title: "Start Trading",        body: "Trade across Currencies, Indices, CFDs, Commodities and Crypto on a single unified account." },
];

export const STATS = [
  { value: "2019", label: "Established" },
  { value: "40+",  label: "Countries Served" },
  { value: "24/7", label: "Multi-Lang Support" },
  { value: "9",    label: "Industry Awards" },
];

// ===== HOME — TESTIMONIALS =====
export const TESTIMONIALS = [
  { quote: "I like one click feature.. amazing execution. easy to use. great experience.", name: "Nathan Felix",  role: "Malaysia · Dec 14, 2023 · 5/5",   title: "Awesome!..." },
  { quote: "Every thing is fast, either deposit, withdrawal.. all from my phone. recommended", name: "Nora Penelope", role: "Indonesia · Mar 14, 2022 · 4.5/5", title: "It's been fantastic!..." },
  { quote: "Connecting MT5, depositing and trading was straightforward. Support replied within minutes.", name: "Aditya Rao",   role: "India · Verified Trader · 5/5" },
  { quote: "Withdrawals are smooth and the spreads on majors are tight. Happy so far.",        name: "Sofia Marin", role: "Mexico · Verified Trader · 4.5/5" },
  { quote: "Demo account let me test strategies risk-free for weeks. Then I went live with confidence.", name: "Liam O'Connor", role: "Ireland · Verified Trader · 5/5" },
  { quote: "The Premium account suits my style — tighter pricing and a real human on support.",  name: "Hiro Tanaka", role: "Japan · Verified Trader · 5/5" },
];

// ===== HOME — AWARDS =====
export const AWARDS_SECTION = {
  label: "Awards & Achievements",
  title: "We're Proud of Our Awards",
  description: "Proline Markets team of professionals have been helping traders and investors reach new milestones.",
};
export const AWARDS = [
  { title: "Global Forex",                       org: "Global Forex Awards",   date: "Mar 2023" },
  { title: "Most Transparent FX Broker",         org: "The Forex Expo",        date: "Dec 2023" },
  { title: "Best Forex Rewards Program",         org: "Global Forex Awards",   date: "Jun 2022" },
  { title: "Global Forex Broker of the Year",    org: "Global Forex Awards",   date: "Jan 2024" },
  { title: "Most Transparent FX Broker",         org: "The Forex Expo USA",    date: "Dec 2023" },
  { title: "Best Forex Rewards Program",         org: "Global Forex Awards",   date: "Jun 2020" },
  { title: "Global Forex Broker of the Year",    org: "Global Forex Awards",   date: "Mar 2021" },
  { title: "Most Transparent FX Broker",         org: "The Forex Expo",        date: "Dec 2022" },
  { title: "Best Forex Rewards Program",         org: "Global Forex Awards",   date: "Jun 2023" },
];

// ===== HOME — ABOUT TEASER =====
export const ABOUT_TEASER = {
  label: "Proline",
  title: "Proline Markets team of professionals",
  description: "We light the way for traders by offering a gateway to the financial world.",
  cta: { label: "Read More", href: "/about" },
  established: "Since 2019",
};

// ===== HOME — MULTI LANGUAGE SUPPORT =====
export const MULTI_LANG_SUPPORT = {
  label: "Get in Touch",
  title: "Support in Multi Language",
  description: "We can assure you high-quality Multi Language Support..",
  cta: { label: "Read More", href: "/auth/login" },
  options: [
    { icon: "MapPin",        title: "Global Locations", body: "Five regional hubs across the globe." },
    { icon: "Phone",         title: "Make a Call",      body: "Talk to a real person, not an IVR maze." },
    { icon: "MessageSquare", title: "Live Chat",        body: "Chat with our team on WhatsApp.", href: "https://wa.me/447577347804" },
  ],
};

// ===== FAQ =====
export const FAQ = [
  { q: "What is Proline Markets?",                                    a: "Proline Markets is a global online broker established in 2019 offering Forex, Indices, CFDs, Commodities and Crypto trading on MT5, WebTrader and our iOS/Android apps." },
  { q: "Which account types are available?",                          a: "We offer Cent, ECN, Islamic, Standard and Proline VIP AC for live trading, plus a free Demo account so you can practice risk-free." },
  { q: "What is the minimum deposit?",                                a: "Cent starts at $10, Standard and Islamic at $100, ECN at $250, and Proline VIP AC at $5,000. The Demo account is completely free." },
  { q: "Which platforms can I trade on?",                              a: "Trade on the Desktop Terminal, Web Terminal, iOS iPhone app and Android app. All platforms sync in real-time across every device." },
  { q: "How do I get help?",                                          a: "Use Live Chat with our service team via WhatsApp, the in-platform Help Center or contact us directly through the Contact page." },
  { q: "Is there a partner program?",                                  a: "Yes — visit the Partnership page to learn how to partner or work with Proline Markets." },
];

// ===== FOOTER =====
export const FOOTER_ABOUT = "We're Proline Markets, your gateway to the world of trading. Offering direct access to FX, global financial markets, and a range of assets like Forex, Indices, Commodities, and Metals.";
export const FOOTER_ESTABLISHED = "Since 2019";

export const FOOTER_COLUMNS = [
  {
    title: "About",
    links: [
      { label: "About Us",                 href: "/about" },
      { label: "Deposits & Withdrawals",   href: "/auth/login" },
      { label: "Partners",                 href: "/partnership" },
      { label: "Copy Trading",             href: "#" },
    ],
  },
  {
    title: "Trading Accounts",
    links: [
      { label: "Cent",                     href: "/accounts/cent" },
      { label: "ECN",                      href: "/accounts/ecn" },
      { label: "Islamic",                  href: "/accounts/islamic" },
      { label: "Standard",                 href: "/accounts/standard" },
      { label: "Proline VIP AC",           href: "/accounts/proline-vip" },
      { label: "Try Demo Ac",              href: "/accounts/demo" },
    ],
  },
  {
    title: "Our Trading Platforms",
    links: [
      { label: "Desktop Terminal",         href: "/auth/login" },
      { label: "Web Terminal",             href: "/auth/login" },
      { label: "IOS iPhone",               href: "/auth/login" },
      { label: "Android",                  href: "/auth/login" },
    ],
  },
  {
    title: "Beneficial Links",
    links: [
      { label: "Contact Us",               href: "/contact" },
      { label: "Risk Disclosure",          href: "/risk-disclosure" },
      { label: "Client Agreement",         href: "#" },
      { label: "Privacy Policy",           href: "/privacy-policy" },
      { label: "Refund Policy",            href: "/refund-policy" },
      { label: "AML Policy",               href: "/aml-policy" },
    ],
  },
];

export const FOOTER_ASSISTANCE = {
  title: "Need Assistance",
  body: "Live chat with our service team for information & assistance.",
  whatsapp: "https://wa.me/447577347804",
};

export const FOOTER_LINKS = [
  { label: "Risk Disclosure", href: "/risk-disclosure" },
  { label: "Privacy Policy",  href: "/privacy-policy" },
  { label: "Refund Policy",   href: "/refund-policy" },
  { label: "AML Policy",      href: "/aml-policy" },
  { label: "Contact Us",      href: "/contact" },
];

export const RISK_DISCLAIMER = "Risk Warning – Trading forex and other financial instruments involves a high level of risk and may not be suitable for all investors or traders. Intellectual Property Rights – Any kind of unauthorized publication, duplication, or quotation from the Proline Markets website, without prior consent, will be constituted as a violation of intellectual property rights.";

export const COPYRIGHT = "© 2024 Proline Market";

// ===== HOME — CTA =====
export const CTA = {
  headline: "Future of Trading.",
  sub: "Open your live account in minutes, or practice risk-free on our demo. Multi-language support available 24/7.",
  primary: "Open an A/c",
  secondary: "Try Free Demo",
  href: "/auth/login",
};

// ===== CONTACT (placeholder per spec) =====
export const CONTACT_INFO = {
  address: "Chicago 12, Melborne City, USA",
  phone:   "+88 01682648101",
  email:   "info@example.com",
  whatsapp: "https://wa.me/447577347804",
};

// ===== MARKETS DATA (kept structure, content adapted to Proline) =====
export const FOREX_PAIRS = [
  { pair: "EUR/USD", spread: "1.0", leverage: "1:400", minLot: "0.01", category: "Major" },
  { pair: "GBP/USD", spread: "1.2", leverage: "1:400", minLot: "0.01", category: "Major" },
  { pair: "USD/JPY", spread: "1.0", leverage: "1:400", minLot: "0.01", category: "Major" },
  { pair: "AUD/USD", spread: "1.3", leverage: "1:400", minLot: "0.01", category: "Major" },
  { pair: "USD/CHF", spread: "1.4", leverage: "1:400", minLot: "0.01", category: "Major" },
  { pair: "NZD/USD", spread: "1.5", leverage: "1:400", minLot: "0.01", category: "Major" },
  { pair: "EUR/GBP", spread: "1.5", leverage: "1:200", minLot: "0.01", category: "Minor" },
  { pair: "EUR/JPY", spread: "1.6", leverage: "1:200", minLot: "0.01", category: "Minor" },
  { pair: "GBP/JPY", spread: "1.9", leverage: "1:200", minLot: "0.01", category: "Minor" },
  { pair: "USD/INR", spread: "2.5", leverage: "1:100", minLot: "0.01", category: "Exotic" },
  { pair: "EUR/INR", spread: "4.0", leverage: "1:100", minLot: "0.01", category: "Exotic" },
  { pair: "USD/SGD", spread: "1.8", leverage: "1:100", minLot: "0.01", category: "Exotic" },
];

export const COMMODITIES_LIST = [
  { name: "Gold (XAU/USD)",   spread: "0.35",  leverage: "1:200", category: "Precious Metal", hours: "23:00–22:00 GMT" },
  { name: "Silver (XAG/USD)", spread: "0.03",  leverage: "1:200", category: "Precious Metal", hours: "23:00–22:00 GMT" },
  { name: "Crude Oil (WTI)",  spread: "0.05",  leverage: "1:100", category: "Energy",         hours: "01:00–24:00 GMT" },
  { name: "Brent Oil",        spread: "0.05",  leverage: "1:100", category: "Energy",         hours: "01:00–24:00 GMT" },
  { name: "Natural Gas",      spread: "0.005", leverage: "1:100", category: "Energy",         hours: "01:00–24:00 GMT" },
  { name: "Platinum",         spread: "1.5",   leverage: "1:100", category: "Precious Metal", hours: "23:00–22:00 GMT" },
];

export const INDICES_LIST = [
  { name: "US30 (Dow Jones)",   spread: "3.0", leverage: "1:200", hours: "Mon–Fri 13:30–20:00 GMT" },
  { name: "NAS100 (Nasdaq)",    spread: "1.0", leverage: "1:200", hours: "Mon–Fri 13:30–20:00 GMT" },
  { name: "SPX500 (S&P 500)",   spread: "0.5", leverage: "1:200", hours: "Mon–Fri 13:30–20:00 GMT" },
  { name: "NIFTY50",            spread: "5.0", leverage: "1:100", hours: "Mon–Fri 03:45–10:00 GMT" },
  { name: "FTSE100",            spread: "1.0", leverage: "1:200", hours: "Mon–Fri 08:00–16:30 GMT" },
  { name: "DAX40",              spread: "1.0", leverage: "1:200", hours: "Mon–Fri 08:00–16:30 GMT" },
  { name: "CAC40",              spread: "1.5", leverage: "1:200", hours: "Mon–Fri 08:00–16:30 GMT" },
  { name: "Nikkei 225",         spread: "8.0", leverage: "1:200", hours: "Mon–Fri 23:00–06:00 GMT" },
];

export const CRYPTO_LIST = [
  { name: "Bitcoin (BTC/USD)",  spread: "50",    leverage: "1:100", availability: "24/7" },
  { name: "Ethereum (ETH/USD)", spread: "2.5",   leverage: "1:100", availability: "24/7" },
  { name: "Ripple (XRP/USD)",   spread: "0.002", leverage: "1:50",  availability: "24/7" },
  { name: "Litecoin (LTC/USD)", spread: "0.5",   leverage: "1:50",  availability: "24/7" },
  { name: "Cardano (ADA/USD)",  spread: "0.003", leverage: "1:50",  availability: "24/7" },
  { name: "Solana (SOL/USD)",   spread: "0.8",   leverage: "1:50",  availability: "24/7" },
];

export const STOCKS_LIST = [
  { name: "Apple Inc. (AAPL)",       spread: "0.05", leverage: "1:50", exchange: "NASDAQ" },
  { name: "Tesla Inc. (TSLA)",       spread: "0.10", leverage: "1:50", exchange: "NASDAQ" },
  { name: "Amazon.com (AMZN)",       spread: "0.08", leverage: "1:50", exchange: "NASDAQ" },
  { name: "Microsoft Corp (MSFT)",   spread: "0.05", leverage: "1:50", exchange: "NASDAQ" },
  { name: "Reliance Industries",     spread: "0.50", leverage: "1:50", exchange: "NSE"    },
  { name: "Infosys Ltd",             spread: "0.30", leverage: "1:50", exchange: "NSE"    },
  { name: "HSBC Holdings",           spread: "0.02", leverage: "1:50", exchange: "LSE"    },
  { name: "BP PLC",                  spread: "0.02", leverage: "1:50", exchange: "LSE"    },
];

export const ETFS_LIST = [
  { name: "SPDR S&P 500 ETF (SPY)",   spread: "0.05", leverage: "1:50", category: "Equity Index" },
  { name: "iShares MSCI World ETF",   spread: "0.10", leverage: "1:50", category: "Global Equity" },
  { name: "Invesco QQQ Trust",        spread: "0.08", leverage: "1:50", category: "Tech Index" },
  { name: "SPDR Gold Shares (GLD)",   spread: "0.15", leverage: "1:50", category: "Commodity" },
  { name: "iShares Core MSCI EM",     spread: "0.12", leverage: "1:50", category: "Emerging Markets" },
  { name: "Vanguard FTSE Europe ETF", spread: "0.10", leverage: "1:50", category: "European Equity" },
];

// ===== ACCOUNTS =====
export const ACCOUNT_TYPES = [
  {
    name: "Cent",
    slug: "cent",
    tagline: "Micro account to start small",
    badge: null,
    minDeposit: "$10",
    leverage: "Up to 1:1000",
    orderVolume: "0.01 - 10 lots",
    spread: "From 2.0",
    platforms: ["MT5", "WebTrader", "Mobile App"],
    features: ["Cent-based balance", "Low entry deposit", "Ideal for beginners", "All instruments"],
    featured: false,
    primaryCta: { label: "Open Your Account", href: "/auth/login" },
    secondaryCta: { label: "More Info",       href: "/accounts/cent" },
  },
  {
    name: "ECN",
    slug: "ecn",
    tagline: "Best trading conditions account",
    badge: "Most Recommended",
    minDeposit: "$250",
    leverage: "Up to 1:400",
    orderVolume: "0.01 - 100 lots",
    spread: "From 0.0 pips",
    platforms: ["MT5", "WebTrader", "Mobile App"],
    features: ["Commission free", "ECN execution", "Tight pricing", "All instruments"],
    featured: true,
    primaryCta: { label: "Open Your Account", href: "/auth/login" },
    secondaryCta: { label: "More Info",       href: "/accounts/ecn" },
  },
  {
    name: "Islamic",
    slug: "islamic",
    tagline: "Swap-free, Shariah-compliant account",
    badge: null,
    minDeposit: "$100",
    leverage: "Up to 1:400",
    orderVolume: "0.01 - 100 lots",
    spread: "From 1.8",
    platforms: ["MT5", "WebTrader", "Mobile App"],
    features: ["Swap-free (no overnight interest)", "Shariah-compliant", "Hedging allowed", "All instruments"],
    featured: false,
    primaryCta: { label: "Open Your Account", href: "/auth/login" },
    secondaryCta: { label: "More Info",       href: "/accounts/islamic" },
  },
  {
    name: "Standard",
    slug: "standard",
    tagline: "A trading account ideal for all",
    badge: null,
    minDeposit: "$100",
    leverage: "Up to 1:400",
    orderVolume: "0.01 - 30 lots",
    spread: "From 1.8",
    platforms: ["MT5", "WebTrader", "Mobile App"],
    features: ["No commission", "Instant order execution", "Hedging allowed", "All instruments"],
    featured: false,
    primaryCta: { label: "Open Your Account", href: "/auth/login" },
    secondaryCta: { label: "More Info",       href: "/accounts/standard" },
  },
  {
    name: "Proline VIP AC",
    slug: "proline-vip",
    tagline: "Experience elite trading environment",
    badge: null,
    minDeposit: "$5000",
    leverage: "Up to 1:200",
    orderVolume: "0.01 - 250 lots",
    spread: "From 0.1 pips",
    platforms: ["MT5", "WebTrader", "Mobile App"],
    features: ["Premium pricing", "Personal manager", "Priority support", "VPS available"],
    featured: false,
    primaryCta: { label: "Open Your Account", href: "/auth/login" },
    secondaryCta: { label: "More Info",       href: "/accounts/proline-vip" },
  },
  {
    name: "Try Demo Ac",
    slug: "demo",
    tagline: "Practice risk-free with virtual funds",
    badge: null,
    minDeposit: "Free",
    leverage: "Up to 1:500",
    orderVolume: "0.01 - 100 lots",
    spread: "Live market spreads",
    platforms: ["MT5", "WebTrader", "Mobile App"],
    features: ["Virtual funds", "Reset balance anytime", "All instruments", "Never expires"],
    featured: false,
    primaryCta: { label: "Open Your Account", href: "/auth/login" },
    secondaryCta: { label: "More Info",       href: "/accounts/demo" },
  },
];

export const DEPOSIT_METHODS = [
  { method: "UPI / PhonePe / GPay",   minDeposit: "$10",  maxDeposit: "$2,500/day", time: "Instant",                fee: "Zero" },
  { method: "NEFT / IMPS / RTGS",     minDeposit: "$10",  maxDeposit: "Unlimited",  time: "Instant – 4 hours",      fee: "Zero" },
  { method: "Credit / Debit Card",    minDeposit: "$10",  maxDeposit: "$1,000",     time: "Instant",                fee: "Zero" },
  { method: "Cryptocurrency (USDT)",  minDeposit: "$10",  maxDeposit: "Unlimited",  time: "Network confirmation",   fee: "Network only" },
  { method: "International Wire",     minDeposit: "$100", maxDeposit: "Unlimited",  time: "1–2 business days",      fee: "Zero" },
];

// ===== EDUCATION (kept) =====
export const EDUCATION_MODULES = [
  { icon: "BookOpen",  level: "Beginner",     title: "Forex Fundamentals",   lessons: 12, duration: "3 hours", topics: ["What is Forex?", "How currency pairs work", "Reading a quote", "Pips, lots, and leverage", "Your first trade"] },
  { icon: "LineChart", level: "Intermediate", title: "Technical Analysis",   lessons: 18, duration: "5 hours", topics: ["Candlestick patterns", "Support and resistance", "Moving averages", "RSI, MACD, Bollinger", "Chart pattern recognition"] },
  { icon: "Globe",     level: "Intermediate", title: "Fundamental Analysis", lessons: 10, duration: "3 hours", topics: ["Economic indicators", "Central bank decisions", "NFP and CPI reports", "Interest rate impact", "Geopolitical events"] },
  { icon: "Shield",    level: "All Levels",   title: "Risk Management",      lessons: 8,  duration: "2 hours", topics: ["Position sizing", "Stop-loss strategies", "Risk-reward ratios", "Drawdown management", "Trader psychology"] },
  { icon: "Cpu",       level: "Advanced",     title: "Algorithmic Trading",  lessons: 14, duration: "6 hours", topics: ["Intro to Expert Advisors", "MQL5 basics", "Backtesting strategies", "Optimization techniques", "Deploying on VPS"] },
  { icon: "Users",     level: "All Levels",   title: "Copy Trading Mastery", lessons: 6,  duration: "1.5 hours",topics: ["Choosing signal providers", "Reading performance stats", "Risk and lot sizing", "Monitoring portfolio", "When to stop copying"] },
];

export const WEBINARS = [
  { date: "May 7, 2026",  time: "6:00 PM IST", title: "Live NFP Trading Session",                 host: "James Carter, Senior Analyst",   type: "Live" },
  { date: "May 12, 2026", time: "7:00 PM IST", title: "Gold Technical Outlook Q2 2026",           host: "Priya Kapoor, Market Strategist", type: "Live" },
  { date: "May 15, 2026", time: "5:30 PM IST", title: "Beginner: How to Place Your First Trade",  host: "Rahul Singh, Trading Coach",      type: "Live" },
  { date: "Apr 28, 2026", time: "Recorded",    title: "EUR/USD Breakout Strategy Deep Dive",      host: "James Carter, Senior Analyst",   type: "Recorded" },
  { date: "Apr 20, 2026", time: "Recorded",    title: "Risk Management: The Complete Guide",      host: "David Okonkwo, Risk Manager",    type: "Recorded" },
];

// ===== TOOLS =====
export const ECONOMIC_CALENDAR = [
  { time: "08:30 GMT", currency: "USD", event: "Non-Farm Payrolls (Apr)",   impact: "High",   forecast: "215K",  previous: "228K"  },
  { time: "10:00 GMT", currency: "EUR", event: "ECB Interest Rate Decision", impact: "High",   forecast: "4.25%", previous: "4.50%" },
  { time: "12:30 GMT", currency: "GBP", event: "UK CPI Year-on-Year",        impact: "High",   forecast: "3.1%",  previous: "3.4%"  },
  { time: "14:00 GMT", currency: "USD", event: "ISM Manufacturing PMI",      impact: "Medium", forecast: "50.2",  previous: "49.8"  },
  { time: "15:00 GMT", currency: "CAD", event: "BOC Rate Statement",         impact: "High",   forecast: "—",     previous: "4.75%" },
  { time: "23:00 GMT", currency: "JPY", event: "BOJ Policy Rate",            impact: "High",   forecast: "0.10%", previous: "0.10%" },
];

// ===== COMPANY / ABOUT =====
export const COMPANY_STATS = [
  { value: "2019", label: "Year Founded" },
  { value: "40+",  label: "Countries Served" },
  { value: "9",    label: "Industry Awards" },
  { value: "24/7", label: "Multi-Lang Support" },
];

export const REGULATIONS = [
  { authority: "Global Operations", country: "Multiple Jurisdictions", license: "Refer to disclosure", description: "Proline Markets operates across multiple jurisdictions. Please refer to the Risk Disclosure and Client Agreement for full details." },
];

export const TEAM = [
  { name: "Proline Leadership Team", role: "Executive Office",    bio: "Decades of combined experience across institutional FX and broking." },
  { name: "Trading Operations",      role: "Dealing & Execution", bio: "24/7 dealing desk and execution team across regional hubs." },
  { name: "Client Services",         role: "Multi-Language Support", bio: "Multi-lingual support team available across global hubs." },
  { name: "Compliance & Risk",       role: "Compliance Office",   bio: "Risk and compliance professionals overseeing client protections and AML." },
];

// ===== PARTNERSHIP =====
export const PARTNERSHIPS = [
  { icon: "Users",   title: "Introducing Broker (IB)", body: "Earn commission on every trade your referred clients make. Real-time tracking and regular payouts.", cta: "Become an IB" },
  { icon: "Share2",  title: "Affiliate Program",       body: "Promote Proline Markets through your website, YouTube, or social media and earn competitive CPA per qualified client.", cta: "Join Affiliate Program" },
  { icon: "Code",    title: "White Label Solution",    body: "Launch your own branded brokerage powered by Proline Markets — full MT5 white label, CRM and payment gateway.", cta: "Request White Label Demo" },
];

// ===== TRADING PLATFORMS =====
export const PLATFORMS = [
  { icon: "Monitor",    title: "Desktop Terminal", body: "Full-featured Desktop Terminal with advanced charting and one-click trading. Built for power users.",   cta: "Open Account" },
  { icon: "Globe",      title: "Web Terminal",     body: "Trade directly in your browser — no downloads. HTML5 platform with full charting and account management.", cta: "Open Account" },
  { icon: "Smartphone", title: "iOS iPhone",       body: "Native iOS app with real-time charts, push notifications and biometric login.",                            cta: "Open Account" },
  { icon: "Smartphone", title: "Android",          body: "Native Android app with full account management and trading on the go.",                                  cta: "Open Account" },
];

export const TRADING_CONDITIONS = [
  { label: "Minimum spread",        value: "From 0.1 pips" },
  { label: "Minimum trade size",    value: "0.01 lot" },
  { label: "Maximum trade size",    value: "250 lots" },
  { label: "Maximum leverage",      value: "1:400" },
  { label: "Margin call level",     value: "80%" },
  { label: "Stop-out level",        value: "50%" },
  { label: "Order execution",       value: "Ultra fast" },
  { label: "Hedging allowed",       value: "Yes" },
  { label: "Scalping allowed",      value: "Yes" },
  { label: "EAs / Algo trading",    value: "Yes" },
];

// ===== SUPPORT =====
export const SUPPORT_CHANNELS = [
  { icon: "MessageSquare", title: "Live Chat",     body: "Average response under 60 seconds. Available 24/7 in multiple languages.", action: "Start Chat",     href: "https://wa.me/447577347804" },
  { icon: "Phone",         title: "Phone Support", body: "Speak with a real human, no IVR mazes.",                                   action: "Call Now",       href: "#" },
  { icon: "Mail",          title: "Email Support", body: "Detailed queries answered quickly. info@example.com.",                     action: "Email Us",       href: "mailto:info@example.com" },
  { icon: "Send",          title: "WhatsApp",      body: "Convenient mobile-first support on WhatsApp.",                              action: "Open WhatsApp", href: "https://wa.me/447577347804" },
];
