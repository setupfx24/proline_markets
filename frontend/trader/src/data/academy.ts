export const phases = [
  {
    id: 1,
    num: 'I',
    title: 'FOUNDATIONS',
    subtitle: 'The Bedrock of Forex',
    duration: '4-6 Weeks',
    level: 'BEGINNER',
    totalMinutes: 170,
    color: '#22c55e',
    description: 'Build an unshakeable foundation. No shortcuts. No skipping. Every professional trader started here.',
    modules: [
      { id: '1.1', title: 'What Is the Forex Market?', topics: 6, minutes: 20, level: 'BEGINNER' },
      { id: '1.2', title: 'Currency Pairs & Market Structure', topics: 6, minutes: 30, level: 'BEGINNER' },
      { id: '1.3', title: 'Trading Sessions & Timing', topics: 6, minutes: 20, level: 'BEGINNER' },
      { id: '1.4', title: 'Brokers, Platforms & Account Types', topics: 7, minutes: 35, level: 'BEGINNER' },
      { id: '1.5', title: 'Core Mechanics: Pips, Lots & Orders', topics: 7, minutes: 30, level: 'BEGINNER' },
      { id: '1.6', title: 'Risk & Money Management Fundamentals', topics: 6, minutes: 30, level: 'BEGINNER' },
    ],
    quiz: {
      title: 'PHASE I Quiz',
      questions: [
        {
          id: 1,
          question: 'What is the daily trading volume of the forex market?',
          options: ['$1.5 Trillion', '$4.5 Trillion', '$7.5 Trillion', '$10 Trillion'],
          correct: 2,
        },
        {
          id: 2,
          question: 'Which session has the highest trading volume?',
          options: ['Asian Session', 'London Session', 'New York Session', 'Sydney Session'],
          correct: 1,
        },
        {
          id: 3,
          question: 'What does a pip represent in forex trading?',
          options: ['1% price change', 'Smallest price increment', 'A trading strategy', 'A type of order'],
          correct: 1,
        },
      ],
    },
  },
  {
    id: 2,
    num: 'II',
    title: 'TECHNICAL ANALYSIS',
    subtitle: 'Reading the Chart Like a Map',
    duration: '6-8 Weeks',
    level: 'BEGINNER',
    totalMinutes: 305,
    color: '#9c27b0',
    description: 'Master price action, chart patterns, and the indicators that separate signal from noise.',
    modules: [
      { id: '2.1', title: 'Chart Types & Timeframes', topics: 6, minutes: 20, level: 'BEGINNER' },
      { id: '2.2', title: 'Candlestick Patterns', topics: 8, minutes: 35, level: 'BEGINNER' },
      { id: '2.3', title: 'Support, Resistance & Key Levels', topics: 6, minutes: 35, level: 'BEGINNER' },
      { id: '2.4', title: 'Trend Analysis', topics: 6, minutes: 25, level: 'BEGINNER' },
      { id: '2.5', title: 'Chart Patterns', topics: 6, minutes: 30, level: 'BEGINNER' },
      { id: '2.6', title: 'Technical Indicators — The Right Way', topics: 8, minutes: 44, level: 'BEGINNER' },
      { id: '2.7', title: 'Fibonacci & Advanced Tools', topics: 6, minutes: 30, level: 'BEGINNER' },
    ],
    quiz: {
      title: 'PHASE II Quiz',
      questions: [
        {
          id: 1,
          question: 'What does OHLC stand for in candlestick analysis?',
          options: ['Open, High, Low, Close', 'Order, Hold, Limit, Cancel', 'Overbought, High, Low, Crossover', 'Open, Hedge, Leverage, Commission'],
          correct: 0,
        },
        {
          id: 2,
          question: "What is a 'double bottom' pattern?",
          options: ['Continuation pattern', 'Bearish reversal', 'Bullish reversal', 'Consolidation'],
          correct: 2,
        },
        {
          id: 3,
          question: 'Which indicator measures momentum?',
          options: ['Moving Average', 'Bollinger Bands', 'RSI', 'Fibonacci'],
          correct: 2,
        },
      ],
    },
  },
  {
    id: 3,
    num: 'III',
    title: 'PRICE ACTION MASTERY',
    subtitle: 'Trading the Naked Chart',
    duration: '5-7 Weeks',
    level: 'INTERMEDIATE',
    totalMinutes: 195,
    color: '#ff9800',
    description: 'Strip away the indicators. Learn to read the raw language of the market through pure price movement.',
    modules: [
      { id: '3.1', title: 'Understanding Price Action', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '3.2', title: 'Supply & Demand Zones', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '3.3', title: 'Market Structure & Order Flow', topics: 6, minutes: 35, level: 'INTERMEDIATE' },
      { id: '3.4', title: 'Entry Techniques', topics: 6, minutes: 25, level: 'INTERMEDIATE' },
      { id: '3.5', title: 'Advanced Candlestick Reading', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '3.6', title: 'Building a Price Action Strategy', topics: 6, minutes: 35, level: 'INTERMEDIATE' },
    ],
    quiz: {
      title: 'PHASE III Quiz',
      questions: [
        {
          id: 1,
          question: "What does a 'Break of Structure' (BOS) indicate?",
          options: ['A pattern failure', 'Trend continuation', 'Market closure', 'Indicator divergence'],
          correct: 1,
        },
        {
          id: 2,
          question: "What is a 'fair value gap'?",
          options: ['Price gap between sessions', 'Imbalance in price delivery', 'Spread between bid/ask', 'Gap between indicators'],
          correct: 1,
        },
        {
          id: 3,
          question: 'Which is the best entry technique for price action?',
          options: ['Random entry', 'Confirmation at key level', 'Buying at resistance', 'Selling at support'],
          correct: 1,
        },
      ],
    },
  },
  {
    id: 4,
    num: 'IV',
    title: 'FUNDAMENTAL ANALYSIS',
    subtitle: 'The Economic Engine Behind Price',
    duration: '6-8 Weeks',
    level: 'INTERMEDIATE',
    totalMinutes: 185,
    color: '#2dd4bf',
    description: 'Understand the forces that move markets. From central bank decisions to economic data, learn to trade the fundamental picture.',
    modules: [
      { id: '4.1', title: 'Introduction to Fundamental Analysis', topics: 6, minutes: 20, level: 'INTERMEDIATE' },
      { id: '4.2', title: 'Economic Indicators & Reports', topics: 6, minutes: 35, level: 'INTERMEDIATE' },
      { id: '4.3', title: 'Central Banks & Monetary Policy', topics: 6, minutes: 35, level: 'INTERMEDIATE' },
      { id: '4.4', title: 'Interest Rates & Market Impact', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '4.5', title: 'News Trading Strategies', topics: 6, minutes: 30, level: 'INTERMEDIATE' },
      { id: '4.6', title: 'Building a Fundamental Framework', topics: 6, minutes: 35, level: 'INTERMEDIATE' },
    ],
    quiz: {
      title: 'PHASE IV Quiz',
      questions: [
        {
          id: 1,
          question: 'What does the NFP report measure?',
          options: ['Stock market performance', 'US employment change', 'Federal reserve balance sheet', 'GDP growth rate'],
          correct: 1,
        },
        {
          id: 2,
          question: 'When a central bank raises interest rates, what typically happens to its currency?',
          options: ['It weakens', 'It strengthens', 'It stays flat', 'It becomes more volatile only'],
          correct: 1,
        },
        {
          id: 3,
          question: 'Which economic event typically causes the most forex volatility?',
          options: ['Holiday markets', 'Central bank rate decisions', 'Weekends', 'Low liquidity sessions'],
          correct: 1,
        },
      ],
    },
  },
  {
    id: 5,
    num: 'V',
    title: 'TRADING PSYCHOLOGY',
    subtitle: 'Master Your Mind, Master the Market',
    duration: '4-6 Weeks',
    level: 'INTERMEDIATE',
    totalMinutes: 115,
    color: '#f59e0b',
    description: 'Your mindset is your most powerful trading tool. Build the mental framework that separates consistent winners from the rest.',
    modules: [
      { id: '5.1', title: 'The Psychology of Trading', topics: 6, minutes: 35, level: 'INTERMEDIATE' },
      { id: '5.2', title: 'Trading Mindset & Mental Models', topics: 6, minutes: 25, level: 'INTERMEDIATE' },
      { id: '5.3', title: 'Discipline & Consistency', topics: 6, minutes: 20, level: 'INTERMEDIATE' },
      { id: '5.4', title: 'Emotional Regulation Techniques', topics: 6, minutes: 20, level: 'INTERMEDIATE' },
      { id: '5.5', title: 'Building Unbreakable Habits', topics: 6, minutes: 15, level: 'INTERMEDIATE' },
    ],
    quiz: {
      title: 'PHASE V Quiz',
      questions: [
        {
          id: 1,
          question: "What is the biggest enemy of a trader's performance?",
          options: ['Poor charting skills', 'Emotional decision-making', 'Bad internet connection', 'Wrong broker'],
          correct: 1,
        },
        {
          id: 2,
          question: 'What does "trading discipline" primarily mean?',
          options: ['Following your rules even when it is hard', 'Trading every single day', 'Using more indicators', 'Having a large account'],
          correct: 0,
        },
        {
          id: 3,
          question: 'How should a trader handle a losing streak?',
          options: ['Double position size to recover fast', 'Take a break and review the trades', 'Ignore the losses and keep trading', 'Change strategy every day'],
          correct: 1,
        },
      ],
    },
  },
  {
    id: 6,
    num: 'VI',
    title: 'STRATEGY DEVELOPMENT',
    subtitle: 'Building Your Trading Edge',
    duration: '6-8 Weeks',
    level: 'ADVANCED',
    totalMinutes: 145,
    color: '#3b82f6',
    description: 'Develop, test, and deploy your proven edge. Construct systematic strategies that perform under real market conditions.',
    modules: [
      { id: '6.1', title: 'Trading Styles Deep Dive', topics: 6, minutes: 30, level: 'ADVANCED' },
      { id: '6.2', title: 'Strategy Construction Framework', topics: 6, minutes: 25, level: 'ADVANCED' },
      { id: '6.3', title: 'Backtesting & Optimization', topics: 6, minutes: 40, level: 'ADVANCED' },
      { id: '6.4', title: 'Risk-Adjusted Performance Metrics', topics: 6, minutes: 25, level: 'ADVANCED' },
      { id: '6.5', title: 'Live Trading Transition', topics: 6, minutes: 25, level: 'ADVANCED' },
    ],
    quiz: {
      title: 'PHASE VI Quiz',
      questions: [
        {
          id: 1,
          question: 'What is backtesting in trading strategy development?',
          options: ['Testing on live markets with real money', 'Testing a strategy on historical data', 'Copying another trader\'s strategy', 'Using demo account only'],
          correct: 1,
        },
        {
          id: 2,
          question: 'What does a positive expectancy in a strategy mean?',
          options: ['Every trade is a winner', 'The strategy loses money on average', 'The strategy is profitable on average over many trades', 'There are no losing trades'],
          correct: 2,
        },
        {
          id: 3,
          question: 'Why is forward testing important after backtesting?',
          options: ['It is not important', 'To validate results in live market conditions', 'To increase position size', 'To find more indicators'],
          correct: 1,
        },
      ],
    },
  },
  {
    id: 7,
    num: 'VII',
    title: 'ADVANCED CONCEPTS',
    subtitle: "The Professional's Toolkit",
    duration: '5-7 Weeks',
    level: 'ADVANCED',
    totalMinutes: 145,
    color: '#a855f7',
    description: 'Advanced techniques used by institutional traders and professional fund managers. Take your analysis to the elite level.',
    modules: [
      { id: '7.1', title: 'Multi-Timeframe Mastery', topics: 6, minutes: 30, level: 'ADVANCED' },
      { id: '7.2', title: 'Advanced Order Flow & Volume', topics: 6, minutes: 35, level: 'ADVANCED' },
      { id: '7.3', title: 'Correlation Trading', topics: 6, minutes: 25, level: 'ADVANCED' },
      { id: '7.4', title: 'Algorithmic & Systematic Trading', topics: 6, minutes: 30, level: 'ADVANCED' },
      { id: '7.5', title: 'Portfolio & Position Management', topics: 6, minutes: 25, level: 'ADVANCED' },
    ],
    quiz: {
      title: 'PHASE VII Quiz',
      questions: [
        {
          id: 1,
          question: 'What does order flow analysis reveal?',
          options: ['Indicator signals', 'Real buying and selling pressure in the market', 'Chart pattern names', 'News event timing'],
          correct: 1,
        },
        {
          id: 2,
          question: 'What is the main purpose of multi-timeframe analysis?',
          options: ['To trade every timeframe simultaneously', 'To get confirmation and context from higher timeframes', 'To use more indicators', 'To find more setups per day'],
          correct: 1,
        },
        {
          id: 3,
          question: 'Which currency pairs are typically positively correlated?',
          options: ['EUR/USD and GBP/USD', 'EUR/USD and USD/CHF', 'AUD/USD and USD/JPY', 'USD/CAD and EUR/USD'],
          correct: 0,
        },
      ],
    },
  },
  {
    id: 8,
    num: 'VIII',
    title: 'PROFESSIONAL TRADING',
    subtitle: 'Trading as a Business',
    duration: 'Ongoing',
    level: 'ADVANCED',
    totalMinutes: 135,
    color: '#eab308',
    description: 'Operate like a professional trading business. Build sustainable systems for long-term performance and wealth creation.',
    modules: [
      { id: '8.1', title: 'The Business of Trading', topics: 6, minutes: 25, level: 'ADVANCED' },
      { id: '8.2', title: 'Advanced Risk Management', topics: 6, minutes: 30, level: 'ADVANCED' },
      { id: '8.3', title: 'Trading Plan Masterclass', topics: 6, minutes: 35, level: 'ADVANCED' },
      { id: '8.4', title: 'Performance Analysis & Growth', topics: 6, minutes: 25, level: 'ADVANCED' },
      { id: '8.5', title: 'Legacy & Long-Term Wealth', topics: 6, minutes: 20, level: 'ADVANCED' },
    ],
    quiz: {
      title: 'PHASE VIII Quiz',
      questions: [
        {
          id: 1,
          question: 'What separates a professional trader from a retail trader?',
          options: ['Bigger screens', 'A structured process, risk management and consistent review', 'More indicators', 'Trading more pairs'],
          correct: 1,
        },
        {
          id: 2,
          question: 'What is a trading journal used for?',
          options: ['Predicting market moves', 'Tracking and reviewing trades to improve performance', 'Finding new strategies online', 'Recording news events only'],
          correct: 1,
        },
        {
          id: 3,
          question: 'What is the primary goal of advanced risk management?',
          options: ['Maximum profit per trade', 'Protecting capital while allowing consistent growth', 'Avoiding all losses', 'Increasing position size every trade'],
          correct: 1,
        },
      ],
    },
  },
];

export interface TopicBlock {
  type: 'definition' | 'keyConcept' | 'practiceTip' | 'comparison' | 'text' | 'timeline' | 'stats' | 'sessions' | 'hierarchy';
  content: string;
  comparisonData?: { left: { title: string; items: string[] }; right: { title: string; items: string[] } };
  timelineData?: { year: string; label: string; desc: string; icon: string }[];
  statsData?: { icon: string; value: string; label: string; sublabel: string }[];
  sessionsData?: { flag: string; city: string; hours: string }[];
  hierarchyData?: { icon: string; title: string; desc: string }[];
}

export interface TopicData {
  id: number;
  title: string;
  blocks: TopicBlock[];
}

export interface LessonData {
  topics: TopicData[];
  keyTakeaways: string[];
  studyNotes: string;
}

export const lessonContent: Record<string, LessonData> = {
  '1.1': {
    topics: [
      {
        id: 1,
        title: 'What Is the Forex Market?',
        blocks: [
          {
            type: 'text',
            content:
              'Currency exchange dates back thousands of years to ancient Mesopotamia, where money changers facilitated trade between different civilizations. The modern foreign exchange system, however, has its roots in the gold standard established in the 1870s. Under this system, countries pegged their currencies to a fixed amount of gold, creating stable exchange rates but limiting monetary policy flexibility.',
          },
          {
            type: 'text',
            content:
              'The gold standard collapsed during World War I as nations printed money to fund military operations. After World War II, the Bretton Woods Agreement (1944) established a new system where currencies were pegged to the US dollar, which itself was convertible to gold at $35 per ounce. This system created the International Monetary Fund (IMF) and World Bank.',
          },
          {
            type: 'keyConcept',
            content:
              'In 1971, President Nixon ended the dollar\'s convertibility to gold — an event known as the "Nixon Shock." This ushered in the era of floating exchange rates, where currency values are determined by supply and demand in the open market. This transition gave birth to the modern forex market as we know it today, creating opportunities for speculation and hedging that didn\'t exist under fixed-rate systems.',
          },
          {
            type: 'timeline',
            content: 'KEY HISTORICAL MILESTONES',
            timelineData: [
              { year: '1870s', label: 'Gold Standard', desc: 'Countries peg currencies to fixed gold amounts', icon: '🏅' },
              { year: '1914', label: 'WWI Collapse', desc: 'Nations abandon gold to fund war efforts', icon: '⚔️' },
              { year: '1944', label: 'Bretton Woods', desc: 'USD pegged to gold at $35/oz, other currencies to USD', icon: '🏛️' },
              { year: '1971', label: 'Nixon Shock', desc: 'End of gold convertibility, floating rates begin', icon: '💥' },
              { year: 'Today', label: 'Modern Forex', desc: '$7.5T daily volume, fully electronic trading', icon: '🌐' },
            ],
          },
        ],
      },
      {
        id: 2,
        title: 'How the global FX market operate 24/5',
        blocks: [
          {
            type: 'text',
            content:
              'The forex market operates 24 hours a day, five days a week, because it spans multiple time zones across the globe. Unlike stock exchanges with fixed opening and closing bells, forex trading begins when the Sydney market opens on Monday morning (Sunday evening in the US) and doesn\'t stop until New York closes on Friday afternoon.',
          },
          {
            type: 'text',
            content:
              'This continuous operation is possible because trading passes from one major financial center to the next as the Earth rotates. Sydney opens first, followed by Tokyo, then London, and finally New York. As one center winds down, the next picks up, creating an unbroken chain of liquidity.',
          },
          {
            type: 'keyConcept',
            content:
              'The market is "over-the-counter" (OTC), meaning there\'s no central exchange building. Instead, trading occurs electronically through a global network of banks, brokers, and financial institutions connected via the Electronic Broking Services (EBS) and Reuters platforms. This decentralized structure is what enables the 24-hour cycle — there\'s no single point that needs to "open" or "close."',
          },
          {
            type: 'sessions',
            content: 'GLOBAL TRADING SESSIONS',
            sessionsData: [
              { flag: '🇦🇺', city: 'Sydney', hours: '5PM–2AM EST' },
              { flag: '🇯🇵', city: 'Tokyo', hours: '7PM–4AM EST' },
              { flag: '🇬🇧', city: 'London', hours: '3AM–12PM EST' },
              { flag: '🇺🇸', city: 'New York', hours: '8AM–5PM EST' },
            ],
          },
        ],
      },
      {
        id: 3,
        title: 'Market participants: Banks, Institutions and Retail Traders',
        blocks: [
          {
            type: 'text',
            content:
              'The forex market has a clear hierarchy of participants. At the top sit the major global banks — JP Morgan, Deutsche Bank, Citigroup, UBS, and others — collectively known as the "interbank market." These banks trade directly with each other in massive volumes, often in lots of $10 million or more. They set the benchmark exchange rates that flow down to all other participants.',
          },
          {
            type: 'text',
            content:
              'Below the banks are institutional investors: hedge funds, pension funds, insurance companies, and multinational corporations. Hedge funds speculate on currency movements for profit, while corporations use forex to manage currency risk from international business operations. A US company paying European suppliers, for example, needs to convert dollars to euros.',
          },
          {
            type: 'keyConcept',
            content:
              'Central banks are unique participants who intervene in forex markets to implement monetary policy or stabilize their currency. The Bank of Japan, for instance, has historically intervened to weaken the yen when it strengthens too much against the dollar.',
          },
          {
            type: 'text',
            content:
              'Retail traders — individual traders like you — make up a small but growing segment, estimated at 5-6% of total market volume. Retail traders access the market through brokers who aggregate orders and connect to the interbank system.',
          },
          {
            type: 'hierarchy',
            content: 'MARKET PARTICIPANT HIERARCHY',
            hierarchyData: [
              { icon: '🏦', title: 'Central Banks', desc: 'Monetary policy & intervention' },
              { icon: '🏢', title: 'Major Banks', desc: 'Interbank market makers' },
              { icon: '📊', title: 'Institutional', desc: 'Hedge funds, pensions, corps' },
              { icon: '💻', title: 'Retail Brokers', desc: 'Aggregate client orders' },
              { icon: '👤', title: 'Retail Traders', desc: '5-6% of market volume' },
            ],
          },
        ],
      },
      {
        id: 4,
        title: 'The interbank market vs retail broker',
        blocks: [
          {
            type: 'definition',
            content:
              'The interbank market is where the world\'s largest banks trade currencies directly with each other. This is the "wholesale" level of forex, with minimum transaction sizes typically starting at $1 million. Banks trade on ultra-tight spreads (sometimes less than 0.1 pips on major pairs) through platforms like EBS and Reuters Matching.',
          },
          {
            type: 'definition',
            content:
              'Retail brokers serve as intermediaries that give individual traders access to this market. They aggregate orders from thousands of clients and either pass them through to the interbank market (Straight-Through Processing or STP) or take the opposite side of the trade internally (Market Making). The broker adds a markup — the spread you see in your trading platform — which is wider than interbank rates but still far tighter than what was available before electronic trading.',
          },
          {
            type: 'comparison',
            content: 'BROKER MODELS',
            comparisonData: {
              left: {
                title: 'ECN / STP Broker',
                items: ['Direct market access', 'Variable spreads (tighter)', 'Commission-based pricing', 'No conflict of interest', 'Faster execution'],
              },
              right: {
                title: 'Market Maker',
                items: ['Internal order matching', 'Fixed spreads (wider)', 'Spread-based pricing', 'Potential conflict', 'Guaranteed fills'],
              },
            },
          },
          {
            type: 'practiceTip',
            content: 'Compare at least 3 regulated brokers on spreads, execution, and available pairs before committing to one platform.',
          },
        ],
      },
      {
        id: 5,
        title: 'Why forex market volume is so huge',
        blocks: [
          {
            type: 'definition',
            content:
              'The Bank for International Settlements (BIS) Triennial Survey reported that daily forex turnover reached $7.5 trillion in 2022, making it by far the largest financial market in the world. To put this in perspective, the New York Stock Exchange trades roughly $25 billion per day — meaning forex dwarfs the world\'s largest stock exchange by a factor of 300.',
          },
          {
            type: 'text',
            content:
              'Several factors drive this enormous volume. First, every international business transaction requires currency conversion — when Toyota sells cars in America, dollars must eventually become yen. Global trade generates trillions in necessary currency exchanges annually. Second, investment flows between countries create constant demand — a US pension fund buying Japanese bonds needs to purchase yen.',
          },
          {
            type: 'text',
            content:
              'Third, central banks hold foreign currency reserves and periodically rebalance them. China alone holds over $3 trillion in foreign reserves. Fourth, speculative trading by banks, hedge funds, and retail traders adds significant volume as participants try to profit from exchange rate movements. Finally, hedging activity by multinational corporations protecting against adverse currency moves contributes substantially to daily volume.',
          },
          {
            type: 'keyConcept',
            content:
              'This massive liquidity is a major advantage for traders — it means you can enter and exit positions almost instantly in major pairs, with minimal slippage even during volatile markets.',
          },
          {
            type: 'stats',
            content: 'FOREX BY THE NUMBERS',
            statsData: [
              { icon: '📈', value: '$7.5T', label: 'Daily Volume', sublabel: 'BIS 2022 Survey' },
              { icon: '⚡', value: '300x', label: 'vs NYSE', sublabel: 'NYSE trades ~$25B/day' },
              { icon: '🌍', value: '170+', label: 'Currencies', sublabel: 'Traded worldwide' },
              { icon: '🕐', value: '24/5', label: 'Market Hours', sublabel: 'Sun 5pm–Fri 5pm EST' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Study where stop-loss clusters likely sit (above highs/below lows) and observe how price hunts those levels.',
          },
        ],
      },
      {
        id: 6,
        title: 'Centralized vs decentralized markets',
        blocks: [
          {
            type: 'text',
            content:
              'A centralized market, like the New York Stock Exchange (NYSE), operates through a single exchange where all buy and sell orders are routed. There\'s one official price at any given moment, a central order book showing all pending orders, and a regulatory body overseeing every transaction. This structure provides transparency and price consistency but creates a single point of failure and limits trading hours.',
          },
          {
            type: 'definition',
            content:
              'The forex market is decentralized (also called "over-the-counter" or OTC), meaning there\'s no single exchange, no central order book, and no universal price. Instead, prices are quoted by thousands of different participants — banks, brokers, and electronic platforms — simultaneously. Two banks in different cities might quote slightly different EUR/USD prices at the same millisecond.',
          },
          {
            type: 'keyConcept',
            content:
              'This decentralized structure has important implications for traders. On the positive side, it enables 24-hour trading, massive liquidity, and competitive pricing as participants compete for order flow. On the negative side, prices can vary between brokers (especially during volatile moments) and there\'s no central regulatory authority — regulation is country-by-country.',
          },
          {
            type: 'text',
            content:
              'As a retail trader, you should understand that your broker is your window into this decentralized network. The price you see is your broker\'s price, which may differ slightly from what another broker shows. This is normal and generally immaterial for most trading strategies.',
          },
          {
            type: 'comparison',
            content: 'CENTRALIZED vs DECENTRALIZED',
            comparisonData: {
              left: {
                title: 'Centralized (NYSE)',
                items: ['Single exchange location', 'Central order book', 'One official price', 'Fixed trading hours', 'Single regulator'],
              },
              right: {
                title: 'Decentralized (Forex)',
                items: ['Global network of dealers', 'No central order book', 'Prices vary by provider', '24-hour trading', 'Multi-jurisdiction'],
              },
            },
          },
        ],
      },
    ],
    keyTakeaways: [
      'Forex evolved from the gold standard (1870s) through Bretton Woods to today\'s $7.5T daily floating-rate market',
      'The market operates 24/5 as trading passes between Sydney, Tokyo, London, and New York sessions',
      'A hierarchy of participants — central banks → interbank → institutional → retail — determines price formation',
      'ECN/STP brokers offer direct market access; market makers internalize orders with fixed spreads',
      'High liquidity from global trade, investment flows, and speculation allows instant entry/exit with minimal slippage',
      'Decentralization means no single price — your broker\'s price may differ slightly from other providers',
    ],
    studyNotes:
      'This module covers the complete history and structure of the forex market across 6 topics (~20 min read). Focus on understanding WHY the market is decentralized and HOW that affects you as a retail trader. After reading, open your broker platform and observe the bid/ask spread on EUR/USD to see the broker markup in action.',
  },
  '1.2': {
    topics: [
      {
        id: 1,
        title: 'Major, minor and exotic currency pairs',
        blocks: [
          {
            type: 'text',
            content:
              'Currency pairs in forex are divided into three categories based on trading volume and liquidity. Major pairs all include the US dollar (USD) and one of the other seven most-traded currencies: EUR/USD (Euro), GBP/USD (British Pound), USD/JPY (Japanese Yen), USD/CHF (Swiss Franc), AUD/USD (Australian Dollar), USD/CAD (Canadian Dollar), and NZD/USD (New Zealand Dollar). These seven pairs account for approximately 75% of all forex transactions and offer the tightest spreads.',
          },
          {
            type: 'text',
            content:
              'Minor pairs (also called "crosses") combine two major currencies without the US dollar: EUR/GBP, EUR/JPY, GBP/JPY, AUD/NZD, and others. These pairs have decent liquidity and slightly wider spreads than majors. They\'re particularly useful when you have a directional view on two non-USD currencies.',
          },
          {
            type: 'keyConcept',
            content:
              'Exotic pairs combine a major currency with a currency from a developing economy: USD/TRY (Turkish Lira), USD/ZAR (South African Rand), EUR/PLN (Polish Zloty), USD/MXN (Mexican Peso). Exotics offer larger price movements but come with significantly wider spreads, higher swap costs, and lower liquidity. They can be volatile and are generally better suited for experienced traders.',
          },
          {
            type: 'stats',
            content: 'CURRENCY PAIR CATEGORIES',
            statsData: [
              { icon: '⭐', value: '7', label: 'Major Pairs', sublabel: '75% of all volume' },
              { icon: '🔀', value: '20+', label: 'Minor Pairs', sublabel: 'Cross currencies' },
              { icon: '🌴', value: '30+', label: 'Exotic Pairs', sublabel: 'Emerging markets' },
              { icon: '📏', value: '0.1–0.5', label: 'Major Spread', sublabel: 'Pips typical' },
            ],
          },
        ],
      },
      {
        id: 2,
        title: 'Base and quote currency',
        blocks: [
          {
            type: 'definition',
            content:
              'In every currency pair, the first currency listed is the "base currency" and the second is the "quote currency." When you see EUR/USD = 1.0850, it means one Euro is worth 1.0850 US dollars. The quote tells you how much of the quote currency you need to buy one unit of the base currency.',
          },
          {
            type: 'definition',
            content:
              'When you "buy" EUR/USD, you\'re buying Euros and simultaneously selling US dollars. If the price rises to 1.0900, your Euros have appreciated — each Euro now buys more dollars. Conversely, "selling" EUR/USD means selling Euros and buying dollars; you profit if the price falls.',
          },
          {
            type: 'keyConcept',
            content:
              'This concept is fundamental because it determines your profit/loss direction. A common beginner mistake is confusing which direction to trade. Remember: buying = expecting the base currency to strengthen relative to the quote currency; selling = expecting the base currency to weaken. Always think in terms of the base currency\'s strength or weakness.',
          },
          {
            type: 'hierarchy',
            content: 'QUICK REFERENCE',
            hierarchyData: [
              { icon: '🔺', title: 'Buy (Long)', desc: 'Expect base currency to strengthen vs quote currency' },
              { icon: '🔻', title: 'Sell (Short)', desc: 'Expect base currency to weaken vs quote currency' },
              { icon: '📐', title: 'Base Currency', desc: 'First currency in pair (EUR in EUR/USD)' },
              { icon: '💱', title: 'Quote Currency', desc: 'Second currency — how much to buy 1 unit of base' },
            ],
          },
        ],
      },
      {
        id: 3,
        title: 'Bid, ask and the spread',
        blocks: [
          {
            type: 'text',
            content:
              'Every currency quote has two prices: the bid (the price at which you can sell) and the ask (the price at which you can buy). If EUR/USD shows 1.0848/1.0850, the bid is 1.0848 and the ask is 1.0850. The difference — 0.0002 or 2 pips — is the spread.',
          },
          {
            type: 'text',
            content:
              'The spread is your primary trading cost and goes directly to your broker or liquidity provider. When you open a trade, you\'re immediately "in the red" by the amount of the spread. For the trade to break even, price must move in your favor by at least the spread amount.',
          },
          {
            type: 'keyConcept',
            content:
              'Spreads vary based on several factors: the currency pair (majors have tighter spreads), time of day (spreads widen during low-liquidity periods), market conditions (spreads balloon during news events or flash crashes), and your broker\'s model (ECN vs market maker). A typical EUR/USD spread might be 0.1–0.5 pips during London/New York sessions but could widen to 3–5 pips during the Asian session or during major news releases.',
          },
          {
            type: 'definition',
            content: 'SPREAD CALCULATION: Spread = Ask Price − Bid Price. Example: Ask 1.0850 − Bid 1.0848 = 0.0002 = 2 pips cost.',
          },
        ],
      },
      {
        id: 4,
        title: 'What moves currency prices: macro forces',
        blocks: [
          {
            type: 'definition',
            content:
              'Currency prices are driven by a complex web of macroeconomic forces. Interest rate differentials are the primary driver — when a country raises interest rates, its currency typically strengthens because higher rates attract foreign capital seeking better returns. This is why forex traders obsessively watch central bank decisions.',
          },
          {
            type: 'text',
            content:
              'Economic data releases move currencies by changing expectations about future monetary policy. Strong GDP growth, low unemployment, or rising inflation might signal upcoming rate hikes, strengthening the currency. Conversely, weak data suggesting an economic slowdown can trigger currency weakness as markets price in potential rate cuts.',
          },
          {
            type: 'keyConcept',
            content:
              'Geopolitical events — elections, trade wars, military conflicts, sanctions — can cause dramatic currency movements. The Swiss Franc, Japanese Yen, and US Dollar typically strengthen during global uncertainty as "safe haven" currencies. Risk-sensitive currencies like AUD, NZD, and emerging market currencies tend to weaken during turbulent periods.',
          },
          {
            type: 'text',
            content:
              'Market sentiment and positioning also matter significantly. If too many traders are positioned in one direction, a reversal can be sharp as positions unwind. The Commitment of Traders (COT) report, released weekly by the CFTC, shows speculative positioning in currency futures and can provide valuable sentiment insights.',
          },
          {
            type: 'hierarchy',
            content: 'WHAT MOVES CURRENCIES',
            hierarchyData: [
              { icon: '🏦', title: 'Interest Rates', desc: 'Higher rates attract capital → currency strengthens' },
              { icon: '📊', title: 'Economic Data', desc: 'GDP, employment, inflation shape rate expectations' },
              { icon: '🌍', title: 'Geopolitics', desc: 'Elections, wars, trade deals cause sharp moves' },
              { icon: '🛡️', title: 'Safe Havens', desc: 'USD, JPY, CHF strengthen during global uncertainty' },
            ],
          },
        ],
      },
      {
        id: 5,
        title: 'Cross rates and how they are calculated',
        blocks: [
          {
            type: 'text',
            content:
              'A cross rate is an exchange rate between two currencies that doesn\'t involve the US dollar, calculated using each currency\'s rate against the dollar. For example, to find EUR/GBP, you divide EUR/USD by GBP/USD. If EUR/USD = 1.0850 and GBP/USD = 1.2700, then EUR/GBP = 1.0850 ÷ 1.2700 = 0.8543.',
          },
          {
            type: 'text',
            content:
              'Cross rates are important for several reasons. First, they allow you to trade currency relationships that don\'t involve the dollar. If you believe the Euro will strengthen against the Pound regardless of what the dollar does, you\'d trade EUR/GBP directly rather than taking two separate positions.',
          },
          {
            type: 'keyConcept',
            content:
              'Cross rate calculations help identify arbitrage opportunities. If the calculated cross rate differs significantly from the market-quoted cross rate, there\'s a brief opportunity for risk-free profit — though in practice, these are exploited by algorithms in milliseconds.',
          },
          {
            type: 'text',
            content:
              'Understanding cross rates deepens your grasp of currency relationships. A move in EUR/USD affects not just that pair but also EUR/GBP, EUR/JPY, and every other Euro cross. This interconnection means watching multiple crosses can confirm or contradict your analysis on a single pair.',
          },
        ],
      },
      {
        id: 6,
        title: 'Currency correlations: positive & negative',
        blocks: [
          {
            type: 'text',
            content:
              'Currency correlation measures how two currency pairs move in relation to each other, expressed as a coefficient from -1.0 (perfect negative correlation) to +1.0 (perfect positive correlation). EUR/USD and GBP/USD typically have a strong positive correlation (around +0.85), meaning they tend to move in the same direction. EUR/USD and USD/CHF have a strong negative correlation (around -0.90), meaning they tend to move in opposite directions.',
          },
          {
            type: 'keyConcept',
            content:
              'Correlations matter for risk management. If you\'re long EUR/USD and long GBP/USD simultaneously, you\'re essentially doubling your exposure because they tend to move together. Your actual risk is much higher than it appears from looking at each trade individually. Conversely, being long EUR/USD and short GBP/USD partly hedges your positions.',
          },
          {
            type: 'text',
            content:
              'Correlations are not static — they shift over time based on changing economic conditions, monetary policy divergence, and geopolitical factors. During the 2008 financial crisis, many normally uncorrelated pairs suddenly moved in lockstep as risk sentiment dominated all markets. Traders should regularly recalculate correlations (using 30-day, 90-day, and 1-year windows) and adjust position sizing accordingly.',
          },
          {
            type: 'practiceTip',
            content:
              'Practical applications: avoid redundant positions in highly correlated pairs, use correlations to confirm trade setups (if EUR/USD breaks out but GBP/USD doesn\'t follow, question the breakout), and build diversified portfolios by selecting uncorrelated pairs.',
          },
          {
            type: 'comparison',
            content: 'CORRELATION EXAMPLES',
            comparisonData: {
              left: {
                title: 'Positive Correlation',
                items: ['EUR/USD & GBP/USD (~+0.85)', 'AUD/USD & NZD/USD (~+0.90)', 'EUR/USD & AUD/USD (~+0.70)', 'Move in same direction', 'Doubles risk if both long'],
              },
              right: {
                title: 'Negative Correlation',
                items: ['EUR/USD & USD/CHF (~−0.90)', 'EUR/USD & USD/DXY (~−0.95)', 'GBP/USD & USD/JPY (~−0.50)', 'Move in opposite direction', 'Natural hedge if both long'],
              },
            },
          },
        ],
      },
    ],
    keyTakeaways: [
      'Major pairs (7) account for ~75% of forex volume with the tightest spreads; exotics have wide spreads and high volatility',
      'The base currency is first in the pair — buying means expecting the base to strengthen against the quote currency',
      'The spread (ask − bid) is your primary trading cost; it widens during low-liquidity periods and major news releases',
      'Interest rates are the #1 driver of currency prices — higher rates attract foreign capital and strengthen a currency',
      'Cross rates (e.g. EUR/GBP) are calculated by dividing two USD pairs; they reveal non-dollar currency relationships',
      'Correlated pairs (EUR/USD & GBP/USD ~+0.85) double your risk when traded in the same direction simultaneously',
    ],
    studyNotes:
      'This module covers the complete structure of currency pairs and market mechanics across 6 topics (~30 min read). Pay special attention to correlations — they\'re a hidden risk many beginners miss. After reading, open your trading platform and compare the spread on EUR/USD vs USD/ZAR to see the major/exotic difference. Also pull up EUR/USD and GBP/USD charts side-by-side to observe their positive correlation in real-time.',
  },
  '1.3': {
    topics: [
      {
        id: 1,
        title: 'The four major trading sessions',
        blocks: [
          {
            type: 'text',
            content:
              'The forex market runs 24 hours a day, but not all hours are equal. Trading activity is concentrated around four major financial centers, each with its own open and close time. The Sydney session kicks off the week, followed by Tokyo, then London, and finally New York. As each center closes, the next one overlaps or takes over, keeping currency markets continuously active from Sunday evening to Friday afternoon (EST).',
          },
          {
            type: 'text',
            content:
              'Each session has a distinct personality. The Asian session (Sydney + Tokyo) is generally quieter with smaller price ranges — ideal for range-bound strategies on JPY, AUD, and NZD pairs. The London session is the most active, accounting for roughly 35–40% of global forex volume. The New York session overlaps with London for 4 hours, creating the highest-volume window of the entire trading day.',
          },
          {
            type: 'keyConcept',
            content:
              'Session transitions are significant. When London opens, it often breaks the overnight Asian range — either continuing a trend or reversing it sharply. When New York opens, it frequently provides a second volatility spike. Understanding these transition points helps you avoid being caught in false moves and positions you to trade with institutional flow rather than against it.',
          },
          {
            type: 'sessions',
            content: 'GLOBAL TRADING SESSIONS',
            sessionsData: [
              { flag: '🇦🇺', city: 'Sydney', hours: '5PM–2AM EST' },
              { flag: '🇯🇵', city: 'Tokyo', hours: '7PM–4AM EST' },
              { flag: '🇬🇧', city: 'London', hours: '3AM–12PM EST' },
              { flag: '🇺🇸', city: 'New York', hours: '8AM–5PM EST' },
            ],
          },
        ],
      },
      {
        id: 2,
        title: 'Session overlaps: when volume and volatility spike',
        blocks: [
          {
            type: 'definition',
            content:
              'Session overlaps occur when two major markets are simultaneously open, creating a surge in liquidity and volatility. The London–New York overlap (8AM–12PM EST) is the most important — it combines the two largest forex centers into a 4-hour window that accounts for approximately 50–60% of all daily forex volume. Spreads tighten to their absolute minimum during this window.',
          },
          {
            type: 'text',
            content:
              'The Tokyo–London overlap (3AM–4AM EST) is brief but often signals the day\'s directional bias. Institutional traders in London frequently use this transition to position themselves for the day. Price breakouts during this hour — especially through Asian session highs or lows — often have significant follow-through.',
          },
          {
            type: 'keyConcept',
            content:
              'During overlap periods, watch for "Asian range breakouts." The Asian session often consolidates price within a tight range. When London opens, it hunts the stops placed above and below this range before making the real directional move. Patient traders who wait for the false breakout and subsequent reversal can capture high-probability entries with tight stops.',
          },
          {
            type: 'stats',
            content: 'SESSION VOLUME DISTRIBUTION',
            statsData: [
              { icon: '🇬🇧', value: '~38%', label: 'London Session', sublabel: 'Highest single-session volume' },
              { icon: '🇺🇸', value: '~22%', label: 'New York Session', sublabel: 'Second highest volume' },
              { icon: '🔥', value: '~50%', label: 'London+NY Overlap', sublabel: 'Best trading hours' },
              { icon: '🇯🇵', value: '~17%', label: 'Tokyo Session', sublabel: 'Best for JPY pairs' },
            ],
          },
        ],
      },
      {
        id: 3,
        title: 'Best pairs to trade in each session',
        blocks: [
          {
            type: 'text',
            content:
              'Not all currency pairs are equally active in every session. EUR/USD, GBP/USD, and EUR/GBP are most active during the London and London–New York overlap. USD/JPY, AUD/USD, and NZD/USD see their highest volume during the Asian session. USD/CAD is most active during the New York session due to Canada\'s close economic ties with the US. Matching your pair selection to the active session dramatically improves liquidity and reduces slippage.',
          },
          {
            type: 'comparison',
            content: 'PAIRS BY SESSION',
            comparisonData: {
              left: {
                title: 'Asian Session (Best Pairs)',
                items: ['USD/JPY — most liquid', 'AUD/USD — high activity', 'NZD/USD — good moves', 'AUD/JPY — strong correlation', 'USD/SGD — regional pair'],
              },
              right: {
                title: 'London/NY Session (Best Pairs)',
                items: ['EUR/USD — tightest spread', 'GBP/USD — high volatility', 'EUR/GBP — major cross', 'USD/CHF — safe haven flows', 'USD/CAD — NY session peak'],
              },
            },
          },
          {
            type: 'practiceTip',
            content:
              'Pick 2–3 pairs that are active in YOUR available trading hours and master them deeply. Knowing one pair\'s behavior patterns, typical daily range, and reaction to news events is far more valuable than watching 20 pairs superficially.',
          },
        ],
      },
      {
        id: 4,
        title: 'The economic calendar: trading around news',
        blocks: [
          {
            type: 'definition',
            content:
              'The economic calendar lists scheduled macroeconomic data releases — NFP (Non-Farm Payrolls), CPI (Consumer Price Index), interest rate decisions, GDP reports, and dozens of others. These events cause predictable spikes in volatility. Knowing when they\'re scheduled is essential: trading through a major news release without awareness is one of the most common ways new traders get stopped out unexpectedly.',
          },
          {
            type: 'text',
            content:
              'High-impact news events (marked red on most economic calendars) can move price 50–200+ pips in seconds. During the 15–30 minutes surrounding these releases, spreads widen dramatically, slippage increases, and price can whipsaw in both directions before finding direction. Many experienced traders either close positions before major releases or specifically avoid trading in that window.',
          },
          {
            type: 'keyConcept',
            content:
              'The most important events to track: US Non-Farm Payrolls (first Friday of each month), Central Bank rate decisions (Fed, ECB, BOE, BOJ), US CPI and Core CPI, GDP releases, and FOMC meeting minutes. These consistently generate the largest price moves and should be on your radar every week without exception.',
          },
          {
            type: 'hierarchy',
            content: 'HIGH-IMPACT NEWS EVENTS',
            hierarchyData: [
              { icon: '💼', title: 'Non-Farm Payrolls', desc: 'First Friday monthly — biggest USD mover' },
              { icon: '🏦', title: 'Central Bank Decisions', desc: 'Fed, ECB, BOE, BOJ rate announcements' },
              { icon: '📊', title: 'CPI / Inflation Data', desc: 'Shapes rate expectations — major market mover' },
              { icon: '📈', title: 'GDP Reports', desc: 'Economic health indicator — medium–high impact' },
            ],
          },
        ],
      },
      {
        id: 5,
        title: 'Volatility patterns: daily and weekly rhythms',
        blocks: [
          {
            type: 'text',
            content:
              'Markets follow predictable volatility rhythms within the week. Monday often opens with gap risk from weekend news — particularly for JPY and CHF safe haven pairs. Tuesday through Thursday represent the core trading days with the most reliable patterns. Friday sees reduced volume as traders close positions before the weekend, and liquidity thins out after the New York afternoon session.',
          },
          {
            type: 'text',
            content:
              'Within each day, there are distinct volatility phases. The first 30–60 minutes after London open is typically the highest-momentum period — institutional desks are establishing positions and stops are being triggered. The 12PM–2PM EST window (London close) often sees a reversal of the morning trend as London traders book profits. The New York afternoon session (2PM–5PM EST) typically slows down.',
          },
          {
            type: 'keyConcept',
            content:
              'The "kill zones" concept in institutional trading refers to specific time windows with the highest probability of significant moves: the London open (2AM–5AM EST), the New York open (7AM–10AM EST), and the London close (11AM–1PM EST). Many professional traders only look for entries during these windows and ignore all other hours entirely.',
          },
          {
            type: 'stats',
            content: 'DAILY VOLATILITY WINDOWS',
            statsData: [
              { icon: '🌅', value: '2–5AM', label: 'London Open', sublabel: 'EST — highest probability' },
              { icon: '🌄', value: '7–10AM', label: 'NY Open', sublabel: 'EST — second kill zone' },
              { icon: '🌇', value: '11AM–1PM', label: 'London Close', sublabel: 'EST — reversal zone' },
              { icon: '🌙', value: '2–5PM', label: 'NY Afternoon', sublabel: 'EST — low activity' },
            ],
          },
        ],
      },
      {
        id: 6,
        title: 'Building your trading schedule',
        blocks: [
          {
            type: 'text',
            content:
              'One of the most overlooked aspects of trading success is aligning your trading schedule with high-quality market hours. Trading at 3AM because you can\'t sleep, or frantically checking charts during work hours, leads to impulsive decisions. The most successful retail traders treat trading like a business — they have defined hours, a pre-market routine, and clear rules about when NOT to trade.',
          },
          {
            type: 'text',
            content:
              'Your trading session should be determined by: (1) which pairs you want to trade, (2) which sessions provide the best setups for your strategy, and (3) your real-life schedule. A part-time trader in India (IST = EST + 10.5 hours) would find the London session (8:30AM–6PM IST) accessible and highly productive — capturing both the London open and the London–New York overlap.',
          },
          {
            type: 'keyConcept',
            content:
              'Quality over quantity applies to trading time as much as it applies to trade selection. Two focused hours during the London–New York overlap will produce better results than eight scattered hours of unfocused screen time. Define your session, prepare your analysis beforehand, execute your plan, then close the charts.',
          },
          {
            type: 'practiceTip',
            content:
              'Create a weekly routine: Sunday evening — review upcoming economic calendar events and mark key levels. Before each session — identify the highest probability setups. After each session — log your trades and review decisions. This process compounds your learning dramatically faster than unstructured screen watching.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Four sessions — Sydney, Tokyo, London, New York — each have distinct volume profiles and best pairs',
      'The London–New York overlap (8AM–12PM EST) is the highest-volume window — ideal for most trading strategies',
      'Match your currency pair selection to the session: JPY/AUD pairs for Asia, EUR/GBP pairs for London/NY',
      'Check the economic calendar before every session — high-impact news causes spreads to widen and stops to get hunted',
      'Kill zones (London open, NY open, London close) are the highest-probability times for institutional moves',
      'Build a disciplined trading schedule aligned with your timezone and available high-quality market hours',
    ],
    studyNotes:
      'This module covers forex trading sessions and timing strategies across 6 topics (~20 min read). After reading, bookmark a reliable economic calendar (Forex Factory or Investing.com) and spend one week checking it every morning before markets open. Note which pairs move most during your local trading hours — this will define your pair selection going forward.',
  },
  '2.3': {
    topics: [],
    keyTakeaways: [],
    studyNotes: 'Module content coming soon.',
  },
  '1.4': {
    topics: [
      {
        id: 1,
        title: 'ECN vs Market Maker vs STP brokers',
        blocks: [
          {
            type: 'definition',
            content:
              'ECN (Electronic Communication Network) brokers connect traders directly to a network of liquidity providers — banks, hedge funds, and other participants. Your orders are matched with the best available prices from multiple providers, resulting in variable spreads that can be as tight as 0.0 pips during peak liquidity. ECN brokers charge a commission per trade (typically $3–7 per lot round-trip) in addition to the spread. They have no conflict of interest because they don\'t take the other side of your trade.',
          },
          {
            type: 'definition',
            content:
              'Market Maker brokers create their own market by taking the opposite side of your trades internally. They provide fixed or near-fixed spreads and guarantee fills, which is convenient for beginners. However, the inherent conflict of interest (they profit when you lose) means some less-reputable market makers may engage in practices like re-quoting, stop hunting, or widening spreads during volatile periods.',
          },
          {
            type: 'text',
            content:
              'STP (Straight-Through Processing) brokers sit between these two models. They route orders directly to their liquidity providers without intervention but may add a markup to the spread rather than charging a separate commission. Some brokers offer "hybrid" models, acting as STP for larger accounts and market making for smaller ones. When choosing a broker, focus on regulation, execution quality, and total trading costs (spread + commission) rather than just the label they use.',
          },
          {
            type: 'comparison',
            content: 'BROKER TYPES',
            comparisonData: {
              left: {
                title: 'ECN / STP',
                items: ['Direct market access', 'Variable spreads from 0.0', 'Commission per lot', 'No dealing desk', 'Best for scalpers'],
              },
              right: {
                title: 'Market Maker',
                items: ['Acts as counterparty', 'Fixed or wider spreads', 'No commission', 'Dealing desk involved', 'Simpler pricing'],
              },
            },
          },
        ],
      },
      {
        id: 2,
        title: 'How brokers make money: spread vs commission',
        blocks: [
          {
            type: 'definition',
            content:
              'Brokers generate revenue through several mechanisms. The spread markup is the most common — your broker receives prices from liquidity providers and adds a small markup before showing them to you. If the raw interbank EUR/USD spread is 0.1 pips, your broker might show you 0.8 pips, keeping 0.7 pips as revenue.',
          },
          {
            type: 'definition',
            content:
              'Commissions are charged by ECN-style brokers, typically $3–7 per standard lot per round trip (opening + closing). This model offers transparency — you see the raw spread plus a clear commission charge. Some traders prefer this because total costs can be lower, especially on major pairs.',
          },
          {
            type: 'keyConcept',
            content:
              'Swap fees (overnight financing charges) are charged when you hold positions past the daily rollover time (typically 5:00 PM EST). These reflect the interest rate differential between the two currencies in your pair. The "triple swap" on Wednesdays accounts for the weekend.',
          },
          {
            type: 'text',
            content:
              'Other revenue sources include: deposit/withdrawal fees, inactivity fees, currency conversion charges, and premium services (VPS hosting, advanced tools). Some brokers also earn from the dealing desk by profiting from clients\' losing trades — which is why choosing a well-regulated broker with transparent pricing is essential.',
          },
          {
            type: 'hierarchy',
            content: 'BROKER REVENUE SOURCES',
            hierarchyData: [
              { icon: '📊', title: 'Spread Markup', desc: 'Difference between bid and ask price goes to the broker' },
              { icon: '💲', title: 'Commission', desc: 'Fixed fee per lot traded, common with ECN accounts' },
              { icon: '🔄', title: 'Swap / Rollover', desc: 'Interest charged or paid for holding positions overnight' },
            ],
          },
        ],
      },
      {
        id: 3,
        title: 'Regulation: FCA, NFA, ASIC, CySEC — why it matters',
        blocks: [
          {
            type: 'text',
            content:
              'Regulation is arguably the most important factor when choosing a broker. Regulated brokers must maintain segregated client funds (your money is kept separate from the company\'s operating funds), meet minimum capital requirements, submit to regular audits, and comply with fair dealing practices.',
          },
          {
            type: 'definition',
            content:
              'The top-tier regulators are: FCA (UK Financial Conduct Authority) — considered the gold standard with strict capital requirements and comprehensive oversight; ASIC (Australian Securities and Investments Commission) — strong regulation with good trader protection; CySEC (Cyprus Securities and Exchange Commission) — covers the EU market under MiFID II framework; NFA/CFTC (US) — the strictest regulatory environment with leverage caps of 50:1.',
          },
          {
            type: 'keyConcept',
            content:
              'Trading with an unregulated broker means you have no legal recourse if they manipulate prices, refuse withdrawals, or go bankrupt with your funds. Even "regulated" brokers in weak jurisdictions (some Caribbean or Pacific Island nations) may offer little real protection. Always verify your broker\'s regulation by checking the regulator\'s official website — don\'t just trust the logo on the broker\'s site.',
          },
          {
            type: 'text',
            content:
              'Key protections offered by top-tier regulators include: negative balance protection (you can\'t lose more than your deposit), compensation schemes (up to £85,000 with FCA, €20,000 with CySEC), and mandatory risk warnings.',
          },
          {
            type: 'stats',
            content: 'TOP REGULATORS',
            statsData: [
              { icon: '🇬🇧', value: 'FCA', label: 'United Kingdom', sublabel: 'Gold standard' },
              { icon: '🇦🇺', value: 'ASIC', label: 'Australia', sublabel: 'Strict oversight' },
              { icon: '🇪🇺', value: 'CySEC', label: 'Cyprus / EU', sublabel: 'EU passporting' },
              { icon: '🇺🇸', value: 'NFA', label: 'United States', sublabel: 'Strictest leverage caps' },
            ],
          },
        ],
      },
      {
        id: 4,
        title: 'MetaTrader 4 vs MetaTrader 5 vs cTrader',
        blocks: [
          {
            type: 'definition',
            content:
              'MetaTrader 4 (MT4) remains the most widely used retail forex platform, known for its simplicity, stability, and massive library of custom indicators and Expert Advisors (automated trading bots). It supports 9 timeframes, one-click trading, and a built-in strategy tester for backtesting. However, MT4 is aging technology — released in 2005 — and has limitations in charting capabilities and order types.',
          },
          {
            type: 'definition',
            content:
              'MetaTrader 5 (MT5) is the successor with significant improvements: 21 timeframes, a built-in economic calendar, more order types (including buy stop limit and sell stop limit), improved backtesting with multi-currency support, and better performance. MT5 also supports trading in stocks, futures, and options — not just forex. However, MT5 uses a "netting" system by default rather than MT4\'s "hedging" system, though hedging accounts are now available.',
          },
          {
            type: 'text',
            content:
              'cTrader is a modern alternative offering a cleaner interface, advanced charting, Level II pricing (depth of market), detachable charts, and transparent commission-based pricing. cTrader Automate (formerly cAlgo) provides algorithmic trading capabilities using C#. It\'s growing in popularity among traders who value a more professional-grade platform without MT4/5\'s legacy constraints.',
          },
          {
            type: 'comparison',
            content: 'PLATFORM COMPARISON',
            comparisonData: {
              left: {
                title: 'MetaTrader 4 / 5',
                items: ['Industry standard', 'Huge indicator library', 'Expert Advisors (EAs)', 'Mobile & desktop apps', 'Most brokers support it'],
              },
              right: {
                title: 'cTrader',
                items: ['Modern interface', 'Level II pricing', 'cBots automation (C#)', 'Better charting tools', 'Transparent commissions'],
              },
            },
          },
        ],
      },
      {
        id: 5,
        title: 'Account types: standard, mini, micro, cent',
        blocks: [
          {
            type: 'text',
            content:
              'Account types determine your minimum deposit, lot sizes, and per-pip values. Standard accounts trade in standard lots (100,000 units of the base currency), where one pip on EUR/USD equals $10. These require larger capital (typically $1,000+ minimum) and are suitable for experienced traders.',
          },
          {
            type: 'text',
            content:
              'Mini accounts trade in mini lots (10,000 units), where one pip equals $1. They\'re good for intermediate traders with moderate capital ($200–$1,000). Micro accounts trade in micro lots (1,000 units) at $0.10 per pip, ideal for beginners or traders wanting to practice with real money and minimal risk (minimums often $10–$100). Cent accounts (offered by some brokers) go even smaller, displaying your balance in cents rather than dollars, so a $10 deposit shows as 1,000 cents.',
          },
          {
            type: 'keyConcept',
            content:
              'When choosing an account type, consider: your total capital (never deposit more than you can afford to lose), your position sizing needs (micro accounts allow precise risk management with small accounts), and the spreads/commissions for each tier (premium account types often offer better pricing). Many brokers now offer flexible accounts that allow trading from 0.01 lots (micro) up to standard lots, eliminating the need to choose a fixed account type.',
          },
          {
            type: 'practiceTip',
            content: 'Compare at least 3 regulated brokers on spreads, execution, and available pairs before committing real capital.',
          },
        ],
      },
      {
        id: 6,
        title: 'Leverage explained: 1:10 to 1:500 — dangers & uses',
        blocks: [
          {
            type: 'definition',
            content:
              'Leverage allows you to control a large position with a small amount of capital. With 1:100 leverage, $1,000 in your account can control a $100,000 position (one standard lot). This amplifies both potential profits AND losses by the same factor. A 1% move in your favor yields a 100% return on your margin — but a 1% move against you wipes out your entire margin.',
          },
          {
            type: 'definition',
            content:
              'Leverage ranges vary dramatically by regulation: US brokers cap at 1:50, EU/UK at 1:30 for majors (1:20 for minors), while offshore brokers may offer 1:500 or even 1:1000. Higher leverage doesn\'t mean you should use it — professional traders rarely use more than 1:10 effective leverage, regardless of what\'s available.',
          },
          {
            type: 'keyConcept',
            content:
              'The golden rule: just because you CAN control $100,000 with $200 doesn\'t mean you SHOULD. Excessive leverage is the #1 reason retail traders blow their accounts. Use leverage as a tool for flexibility in position sizing, not as a way to take oversized positions relative to your account. Always calculate your risk based on the full position size, not your margin deposit.',
          },
          {
            type: 'definition',
            content:
              'LEVERAGE & MARGIN FORMULA: Margin = (Trade Size × Price) ÷ Leverage. Example: with 1:100 leverage on 1 lot EUR/USD at 1.0850 → (100,000 × 1.0850) ÷ 100 = $1,085 margin required.',
          },
          {
            type: 'practiceTip',
            content: 'Start with the lowest effective leverage possible (1:5 to 1:10). Increase only after demonstrating consistent profitability on a demo account.',
          },
        ],
      },
      {
        id: 7,
        title: 'Margin, free margin, and margin call mechanics',
        blocks: [
          {
            type: 'definition',
            content:
              'Margin is the collateral your broker requires to open and maintain a leveraged position. If you open a $100,000 EUR/USD position with 1:100 leverage, your "used margin" is $1,000. Your "free margin" is your remaining equity — the funds available to open new trades or absorb losses on existing ones.',
          },
          {
            type: 'definition',
            content:
              'A margin call occurs when your account equity falls to a dangerous level relative to your used margin. Most brokers issue a margin call when your margin level (equity ÷ used margin × 100) drops below 100%, warning you to deposit more funds or close positions. If your equity continues declining — typically to a margin level of 20–50% — the broker will forcibly close your positions (a "stop-out") to prevent your account from going negative.',
          },
          {
            type: 'keyConcept',
            content:
              'Understanding margin mechanics prevents catastrophic surprises. Always monitor your margin level, especially when holding multiple positions or trading during volatile events. Many new traders don\'t realize that a string of small losses can gradually consume their free margin until they can\'t absorb even a minor adverse move, triggering a cascade of forced closures at the worst possible prices.',
          },
          {
            type: 'text',
            content:
              'Practical rule: never use more than 5–10% of your account as margin at any given time. This leaves a substantial buffer for adverse moves and prevents margin-related forced closures.',
          },
          {
            type: 'hierarchy',
            content: 'MARGIN CALL SEQUENCE',
            hierarchyData: [
              { icon: '🟢', title: 'Trade Opened', desc: 'Full margin available, position active' },
              { icon: '🟡', title: 'Floating Loss', desc: 'Free margin decreasing as trade moves against you' },
              { icon: '🟠', title: 'Margin Warning', desc: 'Margin level drops below 100% — broker alerts you' },
              { icon: '🔴', title: 'Margin Call', desc: 'Broker requires deposit or position closure' },
              { icon: '❌', title: 'Stop Out', desc: 'Positions force-closed at current market price' },
            ],
          },
        ],
      },
    ],
    keyTakeaways: [
      'ECN brokers offer direct market access with variable spreads + commission; market makers take the other side with fixed spreads',
      'Total trading cost = spread + commission + swap; always compare across brokers before depositing',
      'Only trade with brokers regulated by FCA, ASIC, CySEC, or NFA — verify the license number on the regulator\'s official website',
      'MT4 is the industry standard; MT5 offers more features; cTrader provides a modern professional-grade experience',
      'Micro and cent accounts allow beginners to trade real money with minimal risk — start small, scale up with experience',
      'Excessive leverage is the #1 reason retail traders blow accounts; professional traders use 1:10 or less effective leverage',
      'Monitor your margin level constantly — a margin call sequence (warning → call → stop-out) can wipe your account within minutes',
    ],
    studyNotes:
      'This module covers broker selection, platforms, and account mechanics across 7 topics (~35 min read). Before opening a live account, spend at least 30 days on a demo account on MT4, MT5, or cTrader. Research 3 regulated brokers, compare their spreads on EUR/USD, and verify their regulation on the FCA or ASIC official website. Never fund a live account until you\'re consistently profitable on demo.',
  },
  '1.5': {
    topics: [
      {
        id: 1,
        title: 'What is a pip? Pipettes and fractional pips',
        blocks: [
          {
            type: 'definition',
            content:
              'A pip (Percentage in Point) is the smallest standard unit of price movement in forex, typically the fourth decimal place in most currency pairs. For EUR/USD moving from 1.0850 to 1.0851, that\'s a one-pip change. For JPY pairs (which are quoted to two decimal places), a pip is the second decimal place: USD/JPY moving from 150.25 to 150.26 is one pip.',
          },
          {
            type: 'definition',
            content:
              'A pipette (or fractional pip) is one-tenth of a pip — the fifth decimal place for most pairs, or the third decimal for JPY pairs. When your broker shows EUR/USD at 1.08503, that last digit (3) is a pipette. Fractional pricing gives brokers more precise quotes and tighter effective spreads, but for your trading analysis and risk calculations, you\'ll primarily work with full pips.',
          },
          {
            type: 'text',
            content:
              'Understanding pips is essential because they\'re the universal unit for measuring price movement, spread costs, stop-loss distances, and profit/loss calculations. When a trader says "I risked 20 pips on that trade with a 60-pip target," they\'re communicating precise risk and reward in a standardized language that applies regardless of the currency pair.',
          },
          {
            type: 'stats',
            content: 'PIP BASICS',
            statsData: [
              { icon: '📏', value: '0.0001', label: 'Standard Pip', sublabel: '4th decimal for most pairs' },
              { icon: '🇯🇵', value: '0.01', label: 'JPY Pairs', sublabel: '2nd decimal due to yen value' },
              { icon: '🔬', value: '0.00001', label: 'Pipette', sublabel: '5th decimal — fractional pip' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Open EUR/USD and USD/JPY side by side and track pip movements in both until the difference feels intuitive.',
          },
        ],
      },
      {
        id: 2,
        title: 'Pip value calculations for different pairs',
        blocks: [
          {
            type: 'definition',
            content:
              'Pip value — the monetary value of a one-pip movement — varies depending on the pair, your position size, and your account currency. For any pair where USD is the quote currency (EUR/USD, GBP/USD), the pip value is straightforward: $10 per pip for a standard lot, $1 for a mini lot, $0.10 for a micro lot.',
          },
          {
            type: 'definition',
            content:
              'For pairs where USD is the base currency (USD/JPY, USD/CHF), the pip value depends on the exchange rate. The formula is: Pip Value = (0.0001 ÷ exchange rate) × position size. For USD/JPY at 150.00 with a standard lot: (0.01 ÷ 150.00) × 100,000 = $6.67 per pip.',
          },
          {
            type: 'keyConcept',
            content:
              'For cross pairs (EUR/GBP, AUD/NZD), you need to convert through your account currency. Most trading platforms calculate pip values automatically, but understanding the math helps you verify position sizing and ensures you\'re risking the correct amount on each trade. Never assume all pairs have the same pip value — a 20-pip stop on GBP/JPY has a very different dollar value than a 20-pip stop on AUD/USD.',
          },
          {
            type: 'definition',
            content:
              'PIP VALUE FORMULA: Pip Value = (0.0001 ÷ Exchange Rate) × Lot Size. Example — EUR/USD with a mini lot (10,000 units): (0.0001 ÷ 1.0850) × 10,000 = $0.92 per pip. USD-quoted pairs simplify to exactly $1/pip for mini lots.',
          },
          {
            type: 'practiceTip',
            content: 'Before each trade, manually verify the pip value for your chosen pair and lot size. Over time this becomes automatic, but the habit prevents costly position-sizing errors.',
          },
        ],
      },
      {
        id: 3,
        title: 'Lot sizes: standard (100K), mini (10K), micro (1K), nano',
        blocks: [
          {
            type: 'definition',
            content:
              'Lot sizes determine the amount of currency you\'re trading and directly affect your per-pip profit or loss. A standard lot is 100,000 units of the base currency — trading 1 standard lot of EUR/USD means you\'re buying or selling 100,000 Euros. At $10 per pip, a 50-pip move equals $500.',
          },
          {
            type: 'definition',
            content:
              'A mini lot (0.10 lots) is 10,000 units, a micro lot (0.01 lots) is 1,000 units, and a nano lot (0.001 lots on some brokers) is 100 units. These smaller sizes are crucial for proper risk management, especially with smaller accounts. A trader with $1,000 risking 2% ($20) with a 20-pip stop needs a position size of $1 per pip — exactly one mini lot. With a standard lot, that same 20-pip stop would risk $200 (20% of the account), which is recklessly overleveraged.',
          },
          {
            type: 'keyConcept',
            content:
              'Practical guidance: calculate your required lot size BEFORE placing a trade, not after. The formula is: Lot Size = (Account Balance × Risk %) ÷ (Stop Loss in Pips × Pip Value). This ensures every trade risks the same percentage of your account, regardless of the pair or stop-loss distance.',
          },
          {
            type: 'stats',
            content: 'LOT SIZE REFERENCE',
            statsData: [
              { icon: '📦', value: '100K', label: 'Standard Lot', sublabel: '~$10 per pip' },
              { icon: '📋', value: '10K', label: 'Mini Lot', sublabel: '~$1 per pip' },
              { icon: '📎', value: '1K', label: 'Micro Lot', sublabel: '~$0.10 per pip' },
              { icon: '🔬', value: '100', label: 'Nano Lot', sublabel: '~$0.01 per pip' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Always use a position size calculator before entering a trade. Myfxbook and Babypips both have free calculators. Enter your account size, risk %, stop distance, and pair to get the exact lot size.',
          },
        ],
      },
      {
        id: 4,
        title: 'Market orders, limit orders, stop orders',
        blocks: [
          {
            type: 'definition',
            content:
              'Market orders execute immediately at the current market price. When you click "Buy" or "Sell," your order fills at the best available ask or bid price. Market orders guarantee execution but not price — during fast-moving markets, you may receive a price slightly different from what you saw (slippage).',
          },
          {
            type: 'definition',
            content:
              'Limit orders set a specific price at which you want to enter or exit. A buy limit order is placed BELOW the current price (you want to buy cheaper), and a sell limit order is placed ABOVE the current price (you want to sell higher). Limit orders guarantee price but not execution — the market may never reach your limit price.',
          },
          {
            type: 'keyConcept',
            content:
              'Stop orders become market orders when a specified price is reached. A buy stop is placed ABOVE the current price (to catch a breakout), and a sell stop is placed BELOW the current price (to catch a breakdown or to cut losses). Once triggered, they execute at the next available price, which can differ from the stop price during volatility.',
          },
          {
            type: 'text',
            content:
              'Stop-loss orders are the most critical order type — they automatically close your position at a predetermined price to limit losses. Never trade without a stop-loss. Take-profit orders do the opposite, automatically closing your position at a predetermined profit target.',
          },
          {
            type: 'hierarchy',
            content: 'ORDER TYPES',
            hierarchyData: [
              { icon: '⚡', title: 'Market Order', desc: 'Buy/sell instantly at best available price — guaranteed fill' },
              { icon: '📌', title: 'Limit Order', desc: 'Execute at your specified price or better — not guaranteed' },
              { icon: '🛑', title: 'Stop Order', desc: 'Triggers when price reaches your stop level, then fills at market' },
              { icon: '🎯', title: 'Take Profit', desc: 'Auto-closes position at a pre-set profit target' },
            ],
          },
        ],
      },
      {
        id: 5,
        title: 'Buy stop, sell stop, buy limit, sell limit',
        blocks: [
          {
            type: 'definition',
            content:
              'A buy stop order is placed above the current price, triggering a long position when price rises to that level. It\'s used for breakout trading — if EUR/USD is at 1.0850 and you want to buy if it breaks above resistance at 1.0880, you\'d place a buy stop at 1.0881. A sell stop is placed below the current price, triggering a short position when price drops to that level — used for breakdown trading.',
          },
          {
            type: 'definition',
            content:
              'A buy limit order is placed below the current price, entering a long position if price drops to a cheaper level. Used for "buying the dip" at support — if EUR/USD is at 1.0850 and you expect a bounce at support near 1.0800, you\'d place a buy limit at 1.0800. A sell limit is placed above the current price, entering a short position if price rises to an expensive level — used for selling at resistance.',
          },
          {
            type: 'keyConcept',
            content:
              'The key difference: stop orders expect price to CONTINUE in the direction of the trigger (momentum/breakout strategy), while limit orders expect price to REVERSE at the trigger level (mean reversion/bounce strategy). Understanding when to use each type is fundamental to executing your trading plan correctly.',
          },
          {
            type: 'comparison',
            content: 'PENDING ORDER TYPES',
            comparisonData: {
              left: {
                title: 'Stop Orders (Momentum)',
                items: ['Buy Stop — above current price', 'Sell Stop — below current price', 'Expects price to CONTINUE', 'Used for breakout entries', 'Higher slippage risk'],
              },
              right: {
                title: 'Limit Orders (Reversal)',
                items: ['Buy Limit — below current price', 'Sell Limit — above current price', 'Expects price to REVERSE', 'Used for bounce/dip entries', 'Guaranteed price or better'],
              },
            },
          },
        ],
      },
      {
        id: 6,
        title: 'OCO orders and order types across platforms',
        blocks: [
          {
            type: 'definition',
            content:
              'OCO (One-Cancels-the-Other) orders link two pending orders together — when one is triggered, the other is automatically canceled. This is useful for trading scenarios where you expect a big move but aren\'t sure of the direction (e.g., ahead of a news release). You might place a buy stop above resistance and a sell stop below support as an OCO pair — whichever triggers first cancels the other.',
          },
          {
            type: 'text',
            content:
              'Not all platforms support OCO natively. MetaTrader 4 doesn\'t have built-in OCO functionality, though Expert Advisors can replicate it. cTrader and some MT5 brokers offer OCO. Check your platform\'s order management capabilities before designing strategies around specific order types.',
          },
          {
            type: 'keyConcept',
            content:
              'Other advanced order types include: GTC (Good Till Cancelled) — the order remains active until filled or manually cancelled; GTD (Good Till Date) — expires at a specified date/time; IOC (Immediate or Cancel) — fills whatever quantity is available immediately and cancels the rest; FOK (Fill or Kill) — must be filled entirely or not at all. These are more relevant for institutional traders but understanding them adds depth to your trading knowledge.',
          },
          {
            type: 'practiceTip',
            content: 'Practice placing all pending order types on a demo account before going live. Set up a buy stop, sell stop, buy limit, and sell limit on the same pair and observe how each behaves as price moves.',
          },
        ],
      },
      {
        id: 7,
        title: 'Slippage, requotes, and execution quality',
        blocks: [
          {
            type: 'text',
            content:
              'Slippage occurs when your order executes at a different price than expected. If you place a market buy at 1.0850 but get filled at 1.0852, you experienced 2 pips of negative slippage. Slippage is most common during high-volatility events (news releases, market opens), low-liquidity periods, and with large position sizes.',
          },
          {
            type: 'definition',
            content:
              'Slippage can be positive too — getting filled at a better price than requested. However, negative slippage is more common because liquidity tends to disappear during the moments when slippage is most likely (everyone is trying to trade in the same direction simultaneously).',
          },
          {
            type: 'keyConcept',
            content:
              'Requotes occur when your broker cannot fill your order at the requested price and asks if you\'d accept a different price. This is more common with market maker brokers and can be frustrating during fast-moving markets. Some brokers offer "no requotes" execution but may instead widen spreads during volatile periods.',
          },
          {
            type: 'text',
            content:
              'Execution quality — the speed and accuracy of order fills — varies significantly between brokers. Look for brokers that publish execution statistics: average fill speed (under 100ms is good), percentage of orders filled at or better than requested price, and slippage distribution data. Poor execution can erode trading profits just as surely as a bad strategy.',
          },
          {
            type: 'comparison',
            content: 'EXECUTION QUALITY',
            comparisonData: {
              left: {
                title: 'Good Execution',
                items: ['Low latency (<50ms)', 'Minimal slippage', 'No requotes', 'Deep liquidity', 'Transparent statistics'],
              },
              right: {
                title: 'Poor Execution',
                items: ['High latency (>200ms)', 'Frequent slippage', 'Requotes common', 'Thin liquidity', 'No execution data'],
              },
            },
          },
        ],
      },
    ],
    keyTakeaways: [
      'A pip is the 4th decimal place for most pairs (2nd for JPY); pipettes are 1/10th of a pip — used for precise broker quotes',
      'Pip value varies by pair and lot size — always verify before trading; never assume it\'s the same across all pairs',
      'Lot size calculation: (Account Balance × Risk %) ÷ (Stop Loss Pips × Pip Value) — run this before every trade',
      'Market orders guarantee execution; limit orders guarantee price; stop orders trigger when price reaches a level',
      'Stop orders bet on continuation (breakout); limit orders bet on reversal (bounce) — choose based on your strategy',
      'OCO orders automate two-sided setups; always check your platform\'s order capabilities before designing strategies',
      'Slippage and requotes erode profitability — test broker execution with small lots before committing full capital',
    ],
    studyNotes:
      'This module covers the complete core mechanics of forex trading across 7 topics (~30 min read). After reading, open a demo account and practice: (1) calculating lot size for a $1,000 account risking 1% with a 20-pip stop on EUR/USD, (2) placing all 4 pending order types, and (3) verifying pip values across at least 3 different pairs. These mechanical skills must become second nature before live trading.',
  },
  '1.6': {
    topics: [
      {
        id: 1,
        title: 'The 1% and 2% rule — protecting capital',
        blocks: [
          {
            type: 'definition',
            content:
              'The 1% rule states that you should never risk more than 1% of your total account balance on any single trade. With a $10,000 account, your maximum risk per trade is $100. The 2% rule is a slightly more aggressive variant — risking up to 2% or $200 per trade on the same account.',
          },
          {
            type: 'definition',
            content:
              'These rules exist because of the mathematics of recovery. A 10% drawdown requires an 11.1% gain to recover. A 20% drawdown requires 25%. A 50% drawdown requires 100% — you need to double your money just to get back to even. By limiting risk per trade, you ensure that even a string of consecutive losses won\'t create an unrecoverable hole.',
          },
          {
            type: 'text',
            content:
              'Consider the math: with 1% risk per trade, you\'d need 10 consecutive losers to draw down 10% — unlikely with a decent strategy. With 5% risk per trade, just 4 consecutive losers creates a 20% drawdown. Professional traders who have survived decades in the market almost universally use position sizing that risks 0.5–2% per trade. This isn\'t conservative — it\'s survival. Capital preservation must always come before capital appreciation.',
          },
          {
            type: 'stats',
            content: 'RISK RULES AT A GLANCE',
            statsData: [
              { icon: '🛡️', value: '1–2%', label: 'Max Risk / Trade', sublabel: 'Capital protection rule' },
              { icon: '⚖️', value: '1:2+', label: 'Min R:R Ratio', sublabel: 'Risk vs reward target' },
              { icon: '🚫', value: '5–6%', label: 'Max Daily Loss', sublabel: 'Walk away limit' },
              { icon: '📉', value: '20%', label: 'Max Drawdown', sublabel: 'Strategy review trigger' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Set a hard rule of 1% risk per trade and track your results over 20+ trades before considering any increase.',
          },
        ],
      },
      {
        id: 2,
        title: 'Risk-to-reward ratio explained (1:1, 1:2, 1:3+)',
        blocks: [
          {
            type: 'definition',
            content:
              'The risk-to-reward ratio (R:R) compares your potential loss to your potential gain on a trade. A 1:2 R:R means you\'re risking $1 to potentially make $2 — your take-profit target is twice as far from entry as your stop-loss. A 1:3 R:R risks $1 for $3 potential.',
          },
          {
            type: 'definition',
            content:
              'This ratio, combined with your win rate, determines whether your strategy is profitable long-term. With a 1:2 R:R, you only need to win 34% of your trades to break even (excluding fees). With a 1:3 R:R, you need just 26%. This means you can be wrong more often than you\'re right and still make money, provided your winners are bigger than your losers.',
          },
          {
            type: 'keyConcept',
            content:
              'The key equation: Expected Value = (Win Rate × Average Win) − (Loss Rate × Average Loss). If you win 40% of trades with a 1:2 R:R: (0.40 × $200) − (0.60 × $100) = $80 − $60 = $20 average profit per trade. Even with more losers than winners, the strategy is profitable.',
          },
          {
            type: 'text',
            content:
              'A common beginner mistake is aiming for a 1:1 R:R, which requires a win rate above 50% (plus spread costs) to be profitable. Professional traders typically target 1:2 minimum, allowing them to sustain profitability even through inevitable losing streaks.',
          },
          {
            type: 'comparison',
            content: 'RISK-REWARD SCENARIOS',
            comparisonData: {
              left: {
                title: '1:1 Ratio',
                items: ['Risk $100 to make $100', 'Need >50% win rate', 'Barely profitable after fees', 'High psychological pressure', 'Not recommended long-term'],
              },
              right: {
                title: '1:3 Ratio',
                items: ['Risk $100 to make $300', 'Profitable at just 30% wins', 'Room for losing streaks', 'Less stressful to trade', 'Professional standard'],
              },
            },
          },
          {
            type: 'practiceTip',
            content: 'For every trade setup, measure the distance from entry to stop-loss, then ensure your target is at least 2× that distance. Only take trades that offer a minimum 1:2 R:R.',
          },
        ],
      },
      {
        id: 3,
        title: 'Position sizing formula: account size × risk % ÷ stop loss pips',
        blocks: [
          {
            type: 'definition',
            content:
              'Position sizing is the process of determining exactly how many lots to trade on each setup, based on your account size, risk percentage, and stop-loss distance. The formula is: Position Size (in lots) = (Account Balance × Risk %) ÷ (Stop Loss in Pips × Pip Value per Lot).',
          },
          {
            type: 'text',
            content:
              'Example: $10,000 account, 1% risk ($100), 25-pip stop-loss on EUR/USD (pip value = $10/standard lot): Position Size = $100 ÷ (25 × $10) = $100 ÷ $250 = 0.40 standard lots (or 4 mini lots).',
          },
          {
            type: 'keyConcept',
            content:
              'If the same trade had a 50-pip stop-loss: Position Size = $100 ÷ (50 × $10) = $100 ÷ $500 = 0.20 lots. A wider stop-loss results in a smaller position — this keeps your dollar risk constant regardless of the trade\'s characteristics.',
          },
          {
            type: 'text',
            content:
              'Dynamic position sizing is superior to trading the same lot size every time. A fixed 0.50-lot trade with a 20-pip stop risks $100, but the same 0.50 lots with a 50-pip stop risks $250 — 2.5× more risk for the same position size. By adjusting your lot size based on stop-loss distance, every trade carries the same risk in dollar terms, creating the consistency that is the foundation of professional risk management.',
          },
          {
            type: 'definition',
            content:
              'POSITION SIZING FORMULA: Lots = (Account × Risk%) ÷ (SL Pips × Pip Value). Example with $5,000 account, 1% risk, 30-pip SL on EUR/USD: ($5,000 × 0.01) ÷ (30 × $10) = $50 ÷ $300 = 0.17 lots (micro lot territory).',
          },
          {
            type: 'practiceTip',
            content: 'Calculate your position size for 3 different scenarios using the formula above. Practice until it becomes automatic before every trade entry.',
          },
        ],
      },
      {
        id: 4,
        title: 'The psychology of risk: why beginners over-leverage',
        blocks: [
          {
            type: 'text',
            content:
              'Fear and greed are the primary psychological forces that drive poor risk decisions. Fear of losing causes traders to set stop-losses too tight (getting stopped out before the trade has room to work), exit winners too early (leaving money on the table), and avoid taking valid setups after a losing streak. Greed causes over-leveraging, moving stop-losses further away (increasing risk beyond plan), and doubling down on losing positions.',
          },
          {
            type: 'definition',
            content:
              'Beginners are particularly vulnerable to the "leverage trap" — the temptation to use high leverage to make a small account feel big. A trader with $500 using 1:200 leverage can control a $100,000 position, making each pip worth $10. A 50-pip adverse move would wipe out the entire account. Yet this scenario plays out thousands of times daily because the potential for quick, large profits overrides rational risk assessment.',
          },
          {
            type: 'keyConcept',
            content:
              'The antidote is pre-trade planning and mechanical execution. Calculate your position size BEFORE entering the trade. Set your stop-loss based on technical levels, not on how much you\'re willing to lose. Once the trade is placed, let it play out according to plan. Emotional interference — moving stops, adding to losers, cutting winners short — is the enemy of consistent profitability. Trading psychology is not a "soft skill" — it\'s arguably the most important factor separating profitable traders from the 90% who fail.',
          },
          {
            type: 'practiceTip',
            content: 'Before placing any trade, write down: entry price, stop-loss level, take-profit level, lot size, and dollar risk. If you can\'t fill out all five, don\'t enter the trade.',
          },
        ],
      },
      {
        id: 5,
        title: 'Drawdown: what it is and how to recover from it',
        blocks: [
          {
            type: 'definition',
            content:
              'Drawdown is the peak-to-trough decline in your account balance, expressed as a percentage. If your account grows from $10,000 to $12,000 then falls to $10,500, your drawdown is 12.5% (from the $12,000 peak to the $10,500 trough). Maximum drawdown measures the largest such decline over a specific period.',
          },
          {
            type: 'definition',
            content:
              'The mathematics of recovery make drawdown management critical. A 10% drawdown requires an 11.1% gain to recover — manageable. A 25% drawdown requires 33.3%. A 50% drawdown requires 100% — you need to double your remaining capital. At 75% drawdown, you need a 300% return just to break even. This exponential relationship means that preventing large drawdowns is far more important than chasing large gains.',
          },
          {
            type: 'text',
            content:
              'Professional traders typically set maximum drawdown thresholds — e.g., "if I\'m down 15% from my equity peak, I stop trading and re-evaluate my strategy." This circuit-breaker approach prevents emotional trading during losing streaks, which often compounds losses. When you hit your drawdown limit, take at least a few days off, review your recent trades for mistakes, and don\'t resume until you\'ve identified and addressed the issue.',
          },
          {
            type: 'stats',
            content: 'DRAWDOWN RECOVERY MATH',
            statsData: [
              { icon: '🟡', value: '11%', label: '10% Drawdown', sublabel: 'Gain needed to recover' },
              { icon: '🟠', value: '33%', label: '25% Drawdown', sublabel: 'Gain needed to recover' },
              { icon: '🔴', value: '100%', label: '50% Drawdown', sublabel: 'Must double remaining capital' },
              { icon: '💀', value: '300%', label: '75% Drawdown', sublabel: 'Nearly unrecoverable' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Set a hard maximum drawdown limit of 15–20% on your demo account and treat it as a real stop-trading signal. Build this discipline before trading live funds.',
          },
        ],
      },
      {
        id: 6,
        title: 'Building your first risk management ruleset',
        blocks: [
          {
            type: 'text',
            content:
              'Your risk management ruleset is a written document that governs every aspect of how you manage risk. It should be specific, non-negotiable, and followed mechanically. A basic ruleset includes: maximum risk per trade (1% of account balance), maximum number of open positions (3), maximum daily loss (3% — stop trading for the day), maximum weekly loss (5% — reduce position size by 50% for the rest of the week), maximum drawdown (15% — stop trading, review, and recalibrate).',
          },
          {
            type: 'keyConcept',
            content:
              'Additional rules might include: no trading during major news events (or reduce size by 50%), no trading after two consecutive losses without a 30-minute break, no trading outside your designated session times, no correlation concentration (e.g., no more than 2 positively correlated positions simultaneously).',
          },
          {
            type: 'text',
            content:
              'The power of a ruleset is that it removes decision-making during emotional moments. When you\'re in a trade and it\'s going against you, that\'s not the time to decide how much risk is appropriate. That decision was already made, written down, and is now simply being executed. Treat your risk rules like a pilot treats a pre-flight checklist — non-negotiable, every single time, without exception.',
          },
          {
            type: 'hierarchy',
            content: 'YOUR RISK RULESET',
            hierarchyData: [
              { icon: '1️⃣', title: 'Max Risk Per Trade', desc: '1% of account balance — no exceptions' },
              { icon: '2️⃣', title: 'Max Open Positions', desc: '3 concurrent trades to avoid overexposure' },
              { icon: '3️⃣', title: 'Daily Loss Limit', desc: '3% — stop trading for the remainder of the day' },
              { icon: '4️⃣', title: 'Weekly Loss Limit', desc: '5% — halve your position size for the rest of the week' },
              { icon: '5️⃣', title: 'Max Drawdown', desc: '15% — stop, review, and recalibrate before resuming' },
            ],
          },
        ],
      },
    ],
    keyTakeaways: [
      'Never risk more than 1–2% of your account on a single trade — this keeps a losing streak from becoming a catastrophe',
      'A 1:2 minimum R:R means you can be right only 34% of the time and still be profitable',
      'Position size formula: (Account × Risk%) ÷ (Stop Pips × Pip Value) — run this before every single trade',
      'The leverage trap is the #1 cause of blown accounts; treat high leverage as a tool for precision, not for oversizing',
      'A 50% drawdown requires 100% gain to recover — preventing drawdowns is more valuable than chasing gains',
      'A written risk ruleset removes emotional decision-making; it must be specific, non-negotiable, and followed mechanically',
    ],
    studyNotes:
      'This module covers the complete framework for risk and money management across 6 topics (~30 min read). After reading, write your personal risk ruleset on paper and commit to it for your next 30 demo trades. Track every trade in a spreadsheet: entry, exit, pip result, dollar P&L, and R:R achieved. This journal will reveal patterns in your risk behavior that are invisible without data.',
  },
  '2.1': {
    topics: [
      {
        id: 1,
        title: 'Line, bar, and candlestick charts compared',
        blocks: [
          {
            type: 'definition',
            content:
              'Line charts are the simplest chart type, connecting closing prices with a continuous line. They provide a clean view of the overall trend but lose all information about intraday price action — you can\'t see the high, low, or opening price for each period. Line charts are useful for identifying long-term trends and support/resistance levels at a glance, but they\'re rarely sufficient for making trading decisions.',
          },
          {
            type: 'definition',
            content:
              'Bar charts (also called OHLC charts) display four data points per period using a vertical bar: the top of the bar is the high, the bottom is the low, a small horizontal line on the left marks the open, and one on the right marks the close. Bar charts show the full range of price action for each period and are popular among US-based traders.',
          },
          {
            type: 'keyConcept',
            content:
              'Candlestick charts convey the same OHLC information as bar charts but with a visual enhancement — a filled or hollow "body" between the open and close, with "wicks" (shadows) extending to the high and low. A green (or hollow) candle indicates the close is above the open (bullish), while a red (or filled) candle indicates the close is below the open (bearish). Candlestick charts are the overwhelmingly preferred chart type because the body shape makes it instantly apparent who won the battle between buyers and sellers during each period.',
          },
          {
            type: 'hierarchy',
            content: 'CANDLESTICK ANATOMY',
            hierarchyData: [
              { icon: '📊', title: 'Body', desc: 'Shows the range between open and close prices' },
              { icon: '📏', title: 'Upper Wick', desc: 'Extends from body to the session high' },
              { icon: '📐', title: 'Lower Wick', desc: 'Extends from body to the session low' },
              { icon: '🟢', title: 'Bullish (Green)', desc: 'Close is higher than open — buyers dominated' },
              { icon: '🔴', title: 'Bearish (Red)', desc: 'Close is lower than open — sellers dominated' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 2,
        title: 'Anatomy of a candlestick: OHLC',
        blocks: [
          {
            type: 'definition',
            content:
              'Every candlestick tells a story through its four components. The Open is where price started trading for that period. The Close is where it finished. The High is the maximum price reached, and the Low is the minimum. Together, these form the OHLC data that is the foundation of all technical analysis.',
          },
          {
            type: 'definition',
            content:
              'The body of the candle (between open and close) shows the net result of the period\'s trading. A large body indicates strong conviction — buyers or sellers dominated decisively. A small body indicates indecision or equilibrium between buyers and sellers. The body\'s color tells you who won: green/white (bullish close above open) or red/black (bearish close below open).',
          },
          {
            type: 'keyConcept',
            content:
              'The wicks (also called shadows or tails) reveal rejected prices. A long upper wick means buyers pushed price high but sellers drove it back down — rejection of higher prices. A long lower wick means sellers drove price down but buyers pushed it back up — rejection of lower prices. A candle with long wicks and a small body (a Doji or spinning top) shows extreme indecision. Learning to read the story each candle tells — who attacked, who defended, and who ultimately won — is the foundation of price action analysis.',
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 3,
        title: 'Timeframes: M1, M5, M15, H1, H4, D1, W1, MN',
        blocks: [
          {
            type: 'definition',
            content:
              'Timeframes determine how much time each candle or bar represents. M1 (1-minute) shows a new candle every minute — extremely granular, used by scalpers for ultra-short-term trades lasting seconds to minutes. M5 (5-minute) and M15 (15-minute) are popular for intraday trading with slightly more filtered noise. H1 (1-hour) is the workhorse timeframe for day traders, smoothing out intraday noise while still providing multiple setups per session.',
          },
          {
            type: 'definition',
            content:
              'H4 (4-hour) is favored by swing traders who want fewer, higher-quality signals and don\'t need to watch charts constantly. D1 (Daily) is considered by many professionals as the most reliable timeframe — daily candles contain the full day\'s price action and filter out most intraday noise. W1 (Weekly) and MN (Monthly) provide the big-picture view, revealing major trends and key levels that lower timeframes orbit around.',
          },
          {
            type: 'keyConcept',
            content:
              'The rule of diminishing reliability: lower timeframes contain more noise and produce more false signals. A support level on the daily chart is far more significant than one on the 5-minute chart. Conversely, higher timeframes provide stronger signals but fewer opportunities and require wider stop-losses. Your optimal timeframe depends on your trading style, time availability, and psychological comfort with different holding periods.',
          },
          {
            type: 'stats',
            content: 'TIMEFRAME QUICK REFERENCE',
            statsData: [
              { icon: '⚡', value: 'M1–M15', label: 'Scalping / Intraday', sublabel: 'High noise, many signals' },
              { icon: '📈', value: 'H1', label: 'Day Trading', sublabel: 'Workhorse timeframe' },
              { icon: '🎯', value: 'H4', label: 'Swing Trading', sublabel: 'Fewer, higher-quality setups' },
              { icon: '🏔️', value: 'D1–MN', label: 'Position / Macro', sublabel: 'Strongest levels, biggest trends' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 4,
        title: 'Top-down analysis: macro to micro timeframes',
        blocks: [
          {
            type: 'text',
            content:
              'Top-down analysis starts with the highest timeframe to establish the big picture, then works down to lower timeframes for entry precision. This approach ensures you never trade against the dominant trend and that your entries are aligned with larger market forces.',
          },
          {
            type: 'text',
            content:
              'A typical top-down sequence: Start with the Weekly chart to identify the primary trend direction and major support/resistance levels. Move to the Daily chart to confirm the trend, identify the current phase (trending, pulling back, ranging), and spot potential setups forming. Drop to the H4 chart to narrow down entry zones and refine your stop-loss placement. Finally, use the H1 or M15 chart for precise entry timing.',
          },
          {
            type: 'keyConcept',
            content:
              'The critical principle: never take a trade on a lower timeframe that contradicts the higher timeframe analysis. If the weekly trend is bearish and the daily shows strong resistance overhead, don\'t take long trades on the 15-minute chart just because you see a small bullish pattern. The higher timeframe context overrides lower timeframe signals. Top-down analysis dramatically improves win rates by ensuring you\'re always swimming with the current, not against it.',
          },
          {
            type: 'hierarchy',
            content: 'TOP-DOWN WORKFLOW',
            hierarchyData: [
              { icon: '🔭', title: 'Weekly (W1)', desc: 'Primary trend + major levels' },
              { icon: '🗺️', title: 'Daily (D1)', desc: 'Trend confirmation & market phase' },
              { icon: '🔍', title: '4-Hour (H4)', desc: 'Entry zones & stop placement' },
              { icon: '🎯', title: 'H1 / M15', desc: 'Precise entry timing' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 5,
        title: 'Multiple timeframe confluence trading',
        blocks: [
          {
            type: 'definition',
            content:
              'Multiple timeframe confluence occurs when signals on different timeframes align, creating high-probability trading opportunities. For example, if the Daily chart shows price approaching a major support level, the H4 chart shows bullish divergence on RSI, and the H1 chart forms a bullish engulfing candle at that exact level — you have triple-timeframe confluence pointing to a long trade.',
          },
          {
            type: 'text',
            content:
              'The standard approach uses three timeframes: a higher timeframe for trend and context (your "telescope"), a middle timeframe for setup identification (your "binoculars"), and a lower timeframe for entry timing (your "microscope"). Common combinations include: D1/H4/H1 for swing trading, H4/H1/M15 for day trading, and H1/M15/M5 for active intraday trading.',
          },
          {
            type: 'comparison',
            content: 'COMMON TIMEFRAME STACKS',
            comparisonData: {
              left: {
                title: 'Swing Trader',
                items: ['D1 — trend/context', 'H4 — setup', 'H1 — entry timing', 'Trades last days to weeks', 'Wider stops, larger targets'],
              },
              right: {
                title: 'Day / Intraday Trader',
                items: ['H4 — trend/context', 'H1 or M15 — setup', 'M15 or M5 — entry timing', 'Trades closed same day', 'Tighter stops, faster targets'],
              },
            },
          },
          {
            type: 'practiceTip',
            content: 'On a demo chart, mark one confluence setup per day for two weeks — HTF bias, MTF setup, LTF trigger — and log the outcome.',
          },
        ],
      },
      {
        id: 6,
        title: 'Choosing the right timeframe for your style',
        blocks: [
          {
            type: 'text',
            content:
              'Your "best" timeframe is the one that fits your life, not just the one that looks most profitable in a backtest. If you work full-time and can only check charts twice a day, trying to scalp M1 guarantees failure. If you\'re full-time at the screen, trading only D1 closes will leave you bored and overtrading out of sheer impatience. Match the timeframe to your available attention, not the other way around.',
          },
          {
            type: 'keyConcept',
            content:
              'Psychology also matters. Lower timeframes mean more trades, more decisions, and more emotional swings per day — great for traders who stay cool under rapid-fire conditions, dangerous for those prone to revenge trading. Higher timeframes require patience: you may wait days for a setup and hold through drawdowns that test your conviction. Neither is better — but mismatching timeframe and temperament is one of the most common reasons new traders fail.',
          },
          {
            type: 'hierarchy',
            content: 'PICK YOUR LANE',
            hierarchyData: [
              { icon: '⏱️', title: 'Screen Time', desc: 'More time available → lower timeframes possible' },
              { icon: '🧘', title: 'Temperament', desc: 'Patient & analytical → higher timeframes' },
              { icon: '💰', title: 'Account Size', desc: 'Smaller accounts tolerate wider HTF stops worse' },
              { icon: '🎯', title: 'Goal', desc: 'Income vs. wealth-building shapes holding period' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Trade a single timeframe stack for at least 30 demo trades before switching. Consistency reveals edge; constant switching hides it.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Candlestick charts dominate because the body/wick structure shows instantly who won each period — buyers or sellers',
      'Every candle is an OHLC story: body = conviction, wicks = rejected prices, color = winner of the session',
      'Lower timeframes have more noise and more false signals; higher timeframes produce fewer but stronger signals',
      'Top-down analysis (W1 → D1 → H4 → H1) aligns your entries with the dominant trend and dramatically improves win rate',
      'Confluence across three timeframes — context, setup, trigger — is the hallmark of high-probability trading',
      'The right timeframe is the one that fits your available screen time, temperament, and trading goal',
    ],
    studyNotes:
      'This module covers chart types and timeframe selection across 6 topics (~20 min read). After reading, open a demo chart, switch between line, bar, and candlestick views on the same pair, and identify the OHLC points on five consecutive candles. Then practice a top-down workflow on EUR/USD: note the W1 trend, the D1 phase, and an H1 setup — and log whether the confluence played out over the next session.',
  },
  '2.2': {
    topics: [
      {
        id: 1,
        title: 'Single candle patterns: Doji, Hammer, Shooting Star, Marubozu',
        blocks: [
          {
            type: 'definition',
            content:
              'The Doji is a candlestick where the open and close are virtually identical, creating a cross or plus sign shape. It signals indecision - neither buyers nor sellers could gain control. There are several Doji variants: the standard Doji (tiny body, equal wicks), the Gravestone Doji (long upper wick, no lower wick - bearish at tops), the Dragonfly Doji (long lower wick, no upper wick - bullish at bottoms), and the Long-Legged Doji (long wicks both ways - extreme indecision).',
          },
          {
            type: 'definition',
            content:
              'The Hammer appears during downtrends - a small body at the top with a long lower wick (at least 2x the body length) and little to no upper wick. It shows sellers pushed price down aggressively, but buyers fought back and closed near the open. This rejection of lower prices hints at a potential reversal. The Inverted Hammer has the opposite shape (long upper wick) but appears in the same context.',
          },
          {
            type: 'text',
            content:
              'The Shooting Star is a Hammer flipped upside down - it appears during uptrends with a small body at the bottom, long upper wick, and minimal lower wick. It shows buyers pushed price higher but were overwhelmed by sellers who drove the close back down near the open. The Marubozu is a full-bodied candle with no wicks at all, showing complete buyer dominance (bullish Marubozu) or complete seller dominance (bearish Marubozu). Marubozus signal strong conviction and often indicate trend continuation.',
          },
          {
            type: 'hierarchy',
            content: 'SUPPORT & RESISTANCE SIGNALS',
            hierarchyData: [
              { icon: '1', title: 'Support Hold', desc: 'Price bounces off level with increasing volume' },
              { icon: '2', title: 'Resistance Hold', desc: 'Price rejects level with long upper wicks' },
              { icon: '3', title: 'Role Reversal', desc: 'Broken support becomes resistance and vice versa' },
              { icon: '4', title: 'Breakout', desc: 'Price closes decisively beyond key level with volume' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 2,
        title: 'Reversal patterns: Engulfing, Harami, Piercing, Dark Cloud',
        blocks: [
          {
            type: 'definition',
            content:
              'Bullish Engulfing: A two-candle pattern where a large green candle completely engulfs (its body covers the entire body of) the prior red candle. It appears in downtrends and signals a potential reversal - buyers have overwhelmed sellers with enough force to erase the previous candle\'s losses and then some. The larger the engulfing candle relative to recent candles, the stronger the signal.',
          },
          {
            type: 'definition',
            content:
              'Bearish Engulfing: The inverse - a large red candle engulfs the prior green candle in an uptrend. Sellers have aggressively taken over, suggesting the uptrend may be exhausted.',
          },
          {
            type: 'keyConcept',
            content:
              'Harami ("pregnant" in Japanese): A small candle whose body fits entirely within the previous candle\'s body. A Bullish Harami (small green candle inside a large red candle during a downtrend) suggests selling pressure is diminishing. A Bearish Harami (small red candle inside a large green candle during an uptrend) suggests buying pressure is fading. Harami patterns indicate indecision and require confirmation from the next candle.',
          },
          {
            type: 'text',
            content:
              'Piercing Line: In a downtrend, a bearish candle is followed by a bullish candle that opens below the prior low but closes above the midpoint of the prior candle\'s body - buyers have "pierced" through selling pressure. Dark Cloud Cover is the bearish equivalent in an uptrend.',
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 3,
        title: 'Continuation patterns: Rising/Falling Three Methods',
        blocks: [
          {
            type: 'text',
            content:
              'Rising Three Methods is a bullish continuation pattern: a large green candle, followed by three (or more) small red candles that stay within the range of the first candle, followed by another large green candle that closes above the first. The small red candles represent a brief consolidation or minor pullback within the prevailing uptrend, and the final large green candle confirms the trend\'s resumption.',
          },
          {
            type: 'definition',
            content:
              'Falling Three Methods is the bearish equivalent: a large red candle, three small green candles contained within its range, then another large red candle confirming the downtrend continues.',
          },
          {
            type: 'keyConcept',
            content:
              'These patterns are valuable because they show that the counter-trend move was weak and failed to challenge the dominant trend. The containment of the pullback candles within the first candle\'s range demonstrates that the opposing side lacks the conviction to mount a meaningful reversal. When you spot these patterns, they often offer excellent trend-continuation entry points with well-defined risk (your stop-loss goes beyond the extreme of the pullback candles).',
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 4,
        title: 'Morning Star & Evening Star formations',
        blocks: [
          {
            type: 'definition',
            content:
              'The Morning Star is a powerful three-candle bullish reversal pattern. First candle: a large bearish candle confirming the downtrend. Second candle: a small-bodied candle (Doji or spinning top) that gaps down from the first - this represents indecision, a potential turning point. Third candle: a large bullish candle that closes well into (ideally above the midpoint of) the first candle\'s body, confirming buyers have taken control.',
          },
          {
            type: 'definition',
            content:
              'The Evening Star is the bearish equivalent appearing at market tops: a large bullish candle, a small indecision candle that gaps up, and a large bearish candle closing into the first candle\'s body.',
          },
          {
            type: 'keyConcept',
            content:
              'The gap between the first and second candles strengthens the pattern (though in forex, true gaps are rare except on Sunday opens). The key is the shift in power: the first candle shows strong momentum in one direction, the second shows that momentum stalling, and the third confirms the reversal. Morning and Evening Stars are considered among the most reliable reversal patterns, especially when they form at established support or resistance levels with above-average volume.',
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 5,
        title: 'Tweezer tops and bottoms',
        blocks: [
          {
            type: 'definition',
            content:
              'Tweezer Tops form when two consecutive candles have approximately the same high price, appearing at the top of an uptrend. The first candle is typically bullish and the second is bearish. The matching highs indicate a price ceiling where sellers consistently entered - a double rejection of higher prices. This resistance level often marks the beginning of a reversal.',
          },
          {
            type: 'definition',
            content:
              'Tweezer Bottoms are the opposite - two consecutive candles with matching lows at the bottom of a downtrend, the first bearish and the second bullish. The matching lows reveal a floor where buyers stepped in twice, creating a springboard for a potential rally.',
          },
          {
            type: 'keyConcept',
            content:
              'The "tweezer" name comes from the precision of the matching prices - like a pair of tweezers picking at the same point. These patterns are particularly reliable when: (1) the matching price aligns with a pre-existing support/resistance level, (2) the candles are on a meaningful timeframe (H4 or higher), and (3) there\'s confirmation from other indicators like volume increase or RSI divergence. Tweezer patterns represent the market testing a level twice and failing, which is one of the most fundamental principles in technical analysis.',
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 6,
        title: 'Contextual reading: patterns only matter at key levels',
        blocks: [
          {
            type: 'text',
            content:
              'This is perhaps the most important lesson about candlestick patterns: they are NOT standalone signals. A Hammer forming in the middle of a strong downtrend with no support nearby is just a minor bounce, not a reversal signal. The same Hammer forming at a major weekly support level with RSI divergence is a high-probability trade setup.',
          },
          {
            type: 'keyConcept',
            content:
              'Context includes: WHERE the pattern forms (at key support/resistance? At a trendline? Near a round number?), WHEN it forms (during the London-New York overlap or during dead hours?), and WHAT the surrounding price action shows (is the trend overextended? Is there divergence on indicators?).',
          },
          {
            type: 'text',
            content:
              'A practical framework: (1) Identify a key level on a higher timeframe. (2) Wait for price to reach that level. (3) THEN look for candlestick confirmation on your entry timeframe. This sequence - level first, pattern second - dramatically improves the reliability of candlestick signals.',
          },
          {
            type: 'keyConcept',
            content:
              'Avoid "pattern fishing" - scanning charts looking for patterns without context. This leads to seeing patterns everywhere and taking low-quality trades. The pattern is the confirmation of a thesis you\'ve already formed based on price structure, key levels, and market context.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Single candle patterns (Doji, Hammer, Shooting Star, Marubozu) reveal immediate market sentiment and potential reversals',
      'Engulfing patterns show strong momentum shifts; Harami patterns indicate indecision and need confirmation',
      'Three Methods patterns are continuation signals - the counter-trend move is contained within the original candle\'s range',
      'Morning/Evening Stars are three-candle reversals with a clear momentum shift pattern',
      'Tweezer tops/bottoms show double rejections at exact price levels - strong support/resistance signals',
      'Context is everything - patterns only matter when they form at key levels with supporting market structure',
    ],
    studyNotes:
      'This module covers candlestick pattern recognition across 6 topics (~25 min read). After reading, open a demo chart and spend one week identifying patterns ONLY at key support/resistance levels you\'ve marked on H4/D1. Document each pattern with a screenshot and note whether price reversed or continued. This contextual practice will transform you from pattern-spotting to pattern-trading.',
  },
  '2.4': {
    topics: [
      {
        id: 1,
        title: 'Defining trend: higher highs/lows & lower highs/lows',
        blocks: [
          {
            type: 'definition',
            content:
              'An uptrend is defined by a series of higher highs (HH) and higher lows (HL) - each peak is higher than the previous peak, and each trough is higher than the previous trough. A downtrend shows lower highs (LH) and lower lows (LL). This is the most fundamental and reliable way to identify trend direction.',
          },
          {
            type: 'definition',
            content:
              'To mark the trend structure: identify the most recent significant swing high and swing low. If the last high is higher than the prior high AND the last low is higher than the prior low, you\'re in an uptrend. A trend remains valid until this structure breaks - an uptrend ends when price makes a lower low (breaking below the most recent higher low).',
          },
          {
            type: 'stats',
            content: 'OSCILLATOR REFERENCE',
            statsData: [
              { icon: '1', value: '70/30', label: 'RSI Levels', sublabel: 'Overbought / Oversold' },
              { icon: '2', value: '80/20', label: 'Stochastic', sublabel: 'OB / OS levels' },
              { icon: '3', value: '±100', label: 'CCI Range', sublabel: 'Commodity Channel Index' },
              { icon: '4', value: '0-100', label: 'Williams %R', sublabel: 'Momentum gauge' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 2,
        title: 'Trendlines: drawing, validity, and breaks',
        blocks: [
          {
            type: 'text',
            content:
              'Trendlines are diagonal support/resistance lines drawn by connecting successive swing lows (in an uptrend) or swing highs (in a downtrend). A valid trendline requires at least two touches, with three or more confirming its significance. Connect candle body closes for more reliable trendlines.',
          },
          {
            type: 'definition',
            content:
              'The angle matters - very steep trendlines (above 45°) are unsustainable. Trendline breaks are significant signals: a decisive break (candle body closing beyond the trendline) often leads to either a trend reversal or deeper pullback. Wait for a close beyond the trendline and ideally a retest before committing to a trade based on the break.',
          },
          {
            type: 'hierarchy',
            content: 'DIVERGENCE TYPES',
            hierarchyData: [
              { icon: '1', title: 'Regular Bullish', desc: 'Price makes lower low, indicator makes higher low - reversal signal up' },
              { icon: '2', title: 'Regular Bearish', desc: 'Price makes higher high, indicator makes lower high - reversal signal down' },
              { icon: '3', title: 'Hidden Bullish', desc: 'Price makes higher low, indicator makes lower low - trend continuation' },
              { icon: '4', title: 'Hidden Bearish', desc: 'Price makes lower high, indicator makes higher high - trend continuation' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 3,
        title: 'Trend channels: parallel channels and trading within them',
        blocks: [
          {
            type: 'text',
            content:
              'Trend channels are created by drawing a parallel line alongside a trendline, forming a corridor within which price oscillates. Trade by buying at the lower boundary (support) and selling at the upper boundary (resistance). This provides clear entries, stop-loss levels, and take-profit targets.',
          },
          {
            type: 'definition',
            content:
              'Channel breaks are powerful signals - a break above the upper boundary of an uptrend channel signals acceleration, while a break below the lower boundary suggests the trend may be ending. After a channel break, price often travels a distance equal to the channel width (the measured move technique).',
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 4,
        title: 'Trend strength: ADX indicator',
        blocks: [
          {
            type: 'text',
            content:
              'The Average Directional Index (ADX) measures trend strength from 0 to 100 without indicating direction. Key readings: 0-20 = weak/no trend (ranging market), 25-50 = strong trend, 50+ = very strong trend. Use +DI and -DI crossovers for direction: +DI above -DI = bullish trend, -DI above +DI = bearish trend.',
          },
          {
            type: 'definition',
            content:
              'Use ADX as a filter: if your system generates a buy signal but ADX is below 20, conditions don\'t favor trend trades. ADX peaking and turning down doesn\'t mean reversal - it means the trend is losing momentum and may consolidate before the next move.',
          },
          {
            type: 'practiceTip',
            content: 'Add this indicator to a demo chart and observe how it behaves during trending vs ranging markets.',
          },
        ],
      },
      {
        id: 5,
        title: 'Identifying trend exhaustion',
        blocks: [
          {
            type: 'text',
            content:
              'Trend exhaustion occurs when buying or selling pressure is diminishing. Signs include: decreasing candle sizes, increasing wicks against the trend direction, divergence between price and momentum indicators (price makes new highs but RSI doesn\'t), and declining volume during extensions.',
          },
          {
            type: 'definition',
            content:
              'Climactic moves - sudden, sharp extensions with abnormally large candles - often mark the final push before exhaustion. Recognizing exhaustion helps you avoid entering late, tighten stops on existing positions, and prepare for potential reversals. However, wait for structural confirmation rather than trying to catch the exact turn.',
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 6,
        title: 'Trading with the trend vs counter-trend trades',
        blocks: [
          {
            type: 'text',
            content:
              'Trend-following strategies have a statistical edge because trends tend to persist. "The trend is your friend" is one of the oldest validated principles. Trend traders buy pullbacks in uptrends and sell rallies in downtrends, aligning positions with the dominant force.',
          },
          {
            type: 'keyConcept',
            content:
              'Counter-trend trading involves trading against the established trend to catch reversals. While potentially very profitable when correct, it has lower probability and requires exceptional timing. Recommended approach: trade WITH the trend 80% of the time and only counter-trend at major, well-defined levels with strong reversal confirmation. Counter-trend trades should use smaller position sizes and tighter stops.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Trend definition: uptrend = higher highs + higher lows; downtrend = lower highs + lower lows',
      'Valid trendlines need 2+ touches; steep angles (>45°) are unsustainable',
      'Trend channels provide clear entry/exit levels; breaks often travel the channel width',
      'ADX 0-20 = no trend, 25-50 = strong trend, 50+ = very strong trend - use as filter',
      'Trend exhaustion signs: smaller candles, opposing wicks, divergence, declining volume',
      'Trade WITH trend 80% of time; counter-trend only at major levels with confirmation',
    ],
    studyNotes:
      'This module covers trend analysis techniques across 6 topics (~25 min read). After reading, practice marking HH/HL and LH/LL structures on 5 different currency pairs across H1, H4, and D1 timeframes. Draw trendlines and channels, then track how price reacts at these boundaries. This visual practice will build your trend identification skills to the point where trend direction becomes immediately obvious.',
  },
  '2.5': {
    topics: [
      {
        id: 1,
        title: 'Reversal patterns: Head & Shoulders, Double Top/Bottom, Triple Top/Bottom',
        blocks: [
          {
            type: 'definition',
            content:
              'Head and Shoulders is the most recognized reversal pattern. In an uptrend: price makes a high (left shoulder), pulls back, makes a higher high (head), pulls back to a similar level, then makes a lower high (right shoulder). The pattern completes when price breaks below the neckline connecting the two pullback lows.',
          },
          {
            type: 'text',
            content:
              'Double Tops form when price hits the same resistance twice, creating an "M" shape. Confirms when price breaks the swing low between the tops. Double Bottoms are the bullish "W" inverse. Triple Tops/Bottoms add a third test. Profit target: distance from neckline to head (or from resistance to swing low), projected from the breakout point.',
          },
          {
            type: 'stats',
            content: 'VOLUME INDICATORS',
            statsData: [
              { icon: '1', value: 'OBV', label: 'On Balance Volume', sublabel: 'Cumulative flow' },
              { icon: '2', value: 'VWAP', label: 'Volume Weighted Avg', sublabel: 'Average price' },
              { icon: '3', value: 'MFI', label: 'Money Flow Index', sublabel: 'Volume + price' },
              { icon: '4', value: 'A/D', label: 'Accum/Distrib', sublabel: 'Smart money' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 2,
        title: 'Continuation patterns: Flags, Pennants, Wedges, Rectangles',
        blocks: [
          {
            type: 'definition',
            content:
              'Flags are short, rectangular consolidations that slope against the prevailing trend - a bull flag slopes slightly down before breaking upward. Pennants converge into a small symmetrical triangle after a sharp move. Wedges have both boundaries sloping the same direction - rising wedges (bearish) slope up, falling wedges (bullish) slope down.',
          },
          {
            type: 'text',
            content:
              'Rectangles are horizontal ranges that typically break in the prior trend direction. The profit target for all these patterns is usually the height of the "flagpole" (the sharp move preceding the pattern) projected from the breakout point.',
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 3,
        title: 'Triangle patterns: ascending, descending, symmetrical',
        blocks: [
          {
            type: 'definition',
            content:
              'Ascending triangles have flat upper resistance and rising lower trendline - typically bullish, breaking up about 70% of the time. Descending triangles have flat support with descending highs - typically bearish. Symmetrical triangles have both converging boundaries and can break either way, usually continuing the prior trend.',
          },
          {
            type: 'text',
            content:
              'Triangles represent measurable compression of volatility. A breakout becomes inevitable, and pent-up energy produces a strong move. Volume should decline during formation and expand on the breakout. Target: height of the widest part projected from the breakout point.',
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 4,
        title: 'Cup and handle, rounding bottom',
        blocks: [
          {
            type: 'text',
            content:
              'Cup and Handle: A rounded bottom (the "cup") followed by a small drift (the "handle") before a breakout above the cup\'s rim. The cup shows a gradual shift from selling to buying pressure. The handle provides one final shakeout. Target equals the cup\'s depth projected upward from the breakout.',
          },
          {
            type: 'definition',
            content:
              'Rounding Bottoms are slower, more gradual reversals forming a U-shape without a distinct handle. Both patterns require patience - they can take months to develop fully. Wait for a decisive breakout above the rim with volume confirmation.',
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 5,
        title: 'Measuring pattern targets: the measured move',
        blocks: [
          {
            type: 'text',
            content:
              'The measured move technique provides objective profit targets. Measure the height of the pattern, then project that distance from the breakout point. For Head and Shoulders: neckline to head distance. For triangles: widest part. For flags: the flagpole length.',
          },
          {
            type: 'keyConcept',
            content:
              'Measured moves work about 60-70% of the time. They\'re more reliable when the target aligns with a major support/resistance level or round number. Consider taking partial profits before the full target and trailing your stop on the remainder.',
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 6,
        title: 'False breakouts and pattern failure - trading the trap',
        blocks: [
          {
            type: 'definition',
            content:
              'False breakouts (fakeouts) occur when price breaks a pattern boundary only to reverse sharply. They happen because of stop-loss hunting - large players push through obvious levels to trigger stops, then reverse at better prices.',
          },
          {
            type: 'definition',
            content:
              'Trading the trap: when price breaks above resistance, reverses back below it, and continues lower - you have a "bull trap." Enter short with your stop above the false breakout high. These "failure patterns" often produce fast, decisive moves because trapped traders urgently exit their positions, fueling the reversal.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Head & Shoulders and Double/Tops are major reversal patterns with clear neckline break confirmations',
      'Flags, Pennants, Wedges, and Rectangles are continuation patterns - trade in the direction of the prior trend',
      'Triangles compress volatility; ascending = bullish, descending = bearish, symmetrical = continue prior trend',
      'Cup & Handle and Rounding Bottoms are gradual bullish reversals requiring patience for the breakout',
      'Measured move: pattern height projected from breakout gives objective profit targets (60-70% success rate)',
      'False breakouts create "trap" patterns - trading the failure often produces fast moves due to trapped exits',
    ],
    studyNotes:
      'This module covers chart pattern recognition across 6 topics (~25 min read). After reading, spend one week on demo charts identifying patterns ONLY when they complete (breakout confirmed). Document each pattern\'s measured move target and track whether price reached it. This teaches you to wait for confirmation rather than anticipating pattern completion.',
  },
  '2.6': {
    topics: [
      {
        id: 1,
        title: 'Moving averages: SMA, EMA, WMA - how and when',
        blocks: [
          {
            type: 'definition',
            content:
              'Simple Moving Average (SMA) gives equal weight to all periods. Exponential Moving Average (EMA) gives more weight to recent prices, making it more responsive to current price action. Weighted Moving Average (WMA) gives linearly increasing weight to recent periods. EMA is most commonly used for trading due to its responsiveness.',
          },
          {
            type: 'keyConcept',
            content:
              'Golden Cross (50 EMA crossing above 200 EMA) signals potential long-term uptrend. Death Cross (50 EMA crossing below 200 EMA) signals potential downtrend. However, these signals lag significantly - use them for trend bias, not entry timing.',
          },
          {
            type: 'text',
            content:
              'Moving averages work best as dynamic support/resistance in trending markets. In strong uptrends, price repeatedly bounces off the 20 or 50 EMA. In ranging markets, MAs generate frequent whipsaws. Rule: if price is consistently above/below a key MA, trade with the trend; if price is crossing back and forth, the market is ranging.',
          },
          {
            type: 'practiceTip',
            content: 'Test different MA periods (20, 50, 100, 200) on your demo account to see which provides the best support/resistance for your trading timeframe.',
          },
        ],
      },
      {
        id: 2,
        title: 'MACD: histogram, signal line, divergence',
        blocks: [
          {
            type: 'text',
            content:
              'MACD consists of: the MACD line (12 EMA minus 26 EMA), signal line (9 EMA of MACD), and histogram (difference between them). MACD crossing above the signal line is bullish; below is bearish. Growing histogram bars show increasing momentum.',
          },
          {
            type: 'definition',
            content:
              'Divergence is the most powerful MACD signal. Bullish divergence: price makes a lower low but MACD makes a higher low - selling momentum is weakening. Bearish divergence: price makes a higher high but MACD makes a lower high. Divergence is a leading signal but can persist through multiple swings - use it as a warning combined with price action confirmation.',
          },
          {
            type: 'comparison',
            content: 'PATTERN TYPES',
            comparisonData: {
              left: {
                title: 'Reversal Patterns',
                items: ['Head & Shoulders', 'Double Top / Bottom', 'Triple Top / Bottom', 'Rounding Bottom', 'Signal trend change'],
              },
              right: {
                title: 'Continuation Patterns',
                items: ['Flags & Pennants', 'Triangles', 'Rectangles', 'Cup & Handle', 'Signal trend resumption'],
              },
            },
          },
          {
            type: 'practiceTip',
            content: 'Add this indicator to a demo chart and observe how it behaves during trending vs ranging markets.',
          },
        ],
      },
      {
        id: 3,
        title: 'RSI: overbought/oversold, divergence, centerline crossover',
        blocks: [
          {
            type: 'text',
            content:
              'RSI oscillates between 0-100, measuring speed and magnitude of price changes. Above 70 = overbought; below 30 = oversold. However, in strong trends, RSI can remain overbought/oversold for extended periods. A more nuanced approach: in uptrends, RSI oscillates 40-80 (dips to 40-50 are buying opportunities); in downtrends, 20-60.',
          },
          {
            type: 'definition',
            content:
              'RSI divergence is often clearer than MACD divergence. The centerline crossover (RSI crossing 50) can signal trend direction changes. Most reliable RSI signals combine overbought/oversold readings WITH divergence AND a key price level - this triple confluence dramatically improves reversal probability.',
          },
          {
            type: 'practiceTip',
            content: 'Add this indicator to a demo chart and observe how it behaves during trending vs ranging markets.',
          },
        ],
      },
      {
        id: 4,
        title: 'Bollinger Bands: squeeze, expansion, mean reversion',
        blocks: [
          {
            type: 'text',
            content:
              'Bollinger Bands: 20-period SMA with upper/lower bands at 2 standard deviations. About 95% of price stays within the bands. The "squeeze" (bands contracting) indicates low volatility that precedes a breakout. When price touches the outer band, it tends to revert toward the middle band (mean reversion).',
          },
          {
            type: 'definition',
            content:
              'In strong trends, price can "ride the band" for extended periods. Band touches work best as trade triggers when combined with confirmation at key support/resistance levels. The squeeze is one of the most reliable predictive signals - low volatility always precedes high volatility.',
          },
          {
            type: 'practiceTip',
            content: 'Add this indicator to a demo chart and observe how it behaves during trending vs ranging markets.',
          },
        ],
      },
      {
        id: 5,
        title: 'Stochastic oscillator: %K and %D lines',
        blocks: [
          {
            type: 'text',
            content:
              'The Stochastic oscillator compares closing price to its range over a period (default 14), producing %K and %D lines. Above 80 = overbought; below 20 = oversold. Key signals: %K crossing above %D in oversold territory = bullish; %K crossing below %D in overbought territory = bearish.',
          },
          {
            type: 'definition',
            content:
              'Stochastic is most effective in ranging markets. In trending markets, it generates frequent false signals. Solution: combine with ADX - if ADX < 20 (ranging), use Stochastic crossovers in extreme zones; if ADX > 25 (trending), use trend-following indicators instead.',
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 6,
        title: 'Volume indicators: OBV, Volume Profile',
        blocks: [
          {
            type: 'definition',
            content:
              'On-Balance Volume (OBV) adds volume on up-candles and subtracts on down-candles. If OBV rises while price is flat, smart money is accumulating - bullish breakout may follow. Volume Profile shows volume at each price level: High-Volume Nodes (HVNs) act as magnets; Low-Volume Nodes (LVNs) are barriers price moves through quickly.',
          },
          {
            type: 'definition',
            content:
              'Volume analysis adds the crucial dimension of WHERE real interest is concentrated. The Value Area (70% of volume) defines "fair value" - price outside this zone is either exploring new value or will return.',
          },
          {
            type: 'practiceTip',
            content: 'Add this indicator to a demo chart and observe how it behaves during trending vs ranging markets.',
          },
        ],
      },
      {
        id: 7,
        title: 'Indicator stacking: confluence vs over-analysis',
        blocks: [
          {
            type: 'text',
            content:
              'Using too many indicators simultaneously leads to "analysis paralysis." The optimal approach: 2-3 complementary indicators. Combine a trend indicator (MA or ADX), a momentum indicator (RSI or MACD), and optionally a volatility indicator (Bollinger Bands or ATR).',
          },
          {
            type: 'definition',
            content:
              'Avoid redundancy: RSI and Stochastic are both momentum oscillators - using both adds nothing new. Instead, pair an MA (trend) with RSI (momentum) for two independent perspectives. The priority rule: price action ALWAYS takes precedence over indicators. If indicators say "buy" but price shows rejection at resistance, trust the price action.',
          },
          {
            type: 'practiceTip',
            content: 'Add this indicator to a demo chart and observe how it behaves during trending vs ranging markets.',
          },
        ],
      },
      {
        id: 8,
        title: 'Why indicators are lagging - the price action priority rule',
        blocks: [
          {
            type: 'text',
            content:
              'Indicators are calculated from past price data, making them inherently lagging. A moving average crossover confirms a trend change only after the turn has begun. The most useful indicators measure what price action alone cannot easily show: divergence (weakening momentum), volatility compression (Bollinger squeeze), and trend strength (ADX).',
          },
          {
            type: 'keyConcept',
            content:
              'Pure direction indicators (MA crossovers) are less valuable as primary signals because you can assess trend direction simply by looking at chart structure (higher highs/lows vs lower highs/lows). Use indicators for confirmation, not as the primary decision-maker.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'EMA is most responsive SMA variant - use 20/50/200 EMA for dynamic S/R and trend bias',
      'MACD divergence is powerful but needs price action confirmation - histogram shows momentum strength',
      'RSI 70/30 levels work best in ranging markets; in trends, use 40-80 (uptrend) or 20-60 (downtrend)',
      'Bollinger squeeze predicts breakouts; band touches suggest mean reversion but need confirmation',
      'Stochastic works in ranging markets with ADX < 20; avoid in strong trends',
      'Volume indicators (OBV, Volume Profile) reveal smart money accumulation and key price levels',
      'Stack 2-3 complementary indicators max - avoid redundancy and analysis paralysis',
      'Price action > indicators - indicators lag, use them for confirmation not primary signals',
    ],
    studyNotes:
      'This module covers technical indicators across 8 topics (~30 min read). After reading, build a 2-indicator system on your demo account: one trend indicator (MA/ADX) + one momentum indicator (RSI/MACD). Trade only when both align with price action at key levels. Document 20 trades to see how confluence improves your win rate compared to using indicators alone.',
  },
  '2.7': {
    topics: [
      {
        id: 1,
        title: 'Fibonacci retracement levels: 38.2%, 50%, 61.8%, 78.6%',
        blocks: [
          {
            type: 'definition',
            content:
              'Fibonacci retracement levels are horizontal lines drawn between a swing high and swing low to identify potential S/R within a trend. Key levels: 23.6%, 38.2%, 50%, 61.8% (the "golden ratio" - most significant), 78.6%. In an uptrend, drag from swing low to swing high; the levels show where a pullback might find support.',
          },
          {
            type: 'definition',
            content:
              'Fibonacci works because of widespread use - millions of traders watch these levels, creating self-fulfilling order flow clusters. The 38.2% represents a shallow pullback (strong trend), 50% is moderate, 61.8% is deep but often the best entry opportunity, and 78.6% is very deep (trend validity is being challenged).',
          },
          {
            type: 'hierarchy',
            content: 'MULTI-TIMEFRAME ANALYSIS',
            hierarchyData: [
              { icon: '1', title: 'Monthly/Weekly', desc: 'Overall trend direction' },
              { icon: '2', title: 'Daily', desc: 'Swing trade setups' },
              { icon: '3', title: '4H / 1H', desc: 'Entry timing zone' },
              { icon: '4', title: '15M / 5M', desc: 'Precise entry trigger' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 2,
        title: 'Fibonacci extensions for profit targets',
        blocks: [
          {
            type: 'text',
            content:
              'Fibonacci extensions project profit targets BEYOND the original swing. Key levels: 127.2%, 161.8% (most commonly reached), 200%, and 261.8%. After a pullback holds at a Fibonacci level and the trend resumes, extensions estimate how far the next leg might travel.',
          },
          {
            type: 'definition',
            content:
              'Use extensions with other confluent levels - a Fibonacci extension aligning with horizontal resistance or a round number creates a high-probability profit-taking zone. The 161.8% extension is an excellent initial target; the 200% represents an equal measured move.',
          },
          {
            type: 'hierarchy',
            content: 'TIMEFRAME RULES',
            hierarchyData: [
              { icon: '1', title: 'Top-Down Approach', desc: 'Always start from higher timeframe for context, then drill down' },
              { icon: '2', title: '3-Screen Method', desc: 'Use 3 timeframes: trend (high), signal (mid), entry (low)' },
              { icon: '3', title: 'Alignment', desc: 'Only trade when all 3 timeframes agree on direction' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Draw Fibonacci levels on 5 recent swings and note where price reacted - focus on the 61.8% and 38.2% levels.',
          },
        ],
      },
      {
        id: 3,
        title: 'Fibonacci time zones',
        blocks: [
          {
            type: 'text',
            content:
              'Fibonacci time zones project potential turning points in time using Fibonacci intervals (1, 2, 3, 5, 8, 13, 21, 34...) from a significant market event. While less reliable than price-based Fibonacci tools, they can add awareness when both a time zone and price level converge.',
          },
          {
            type: 'definition',
            content:
              'Time-based analysis in forex is less reliable because markets are driven by economic events that don\'t follow mathematical sequences. Use time zones as awareness tools rather than action triggers - they\'re a "heads up" to pay closer attention during specific periods.',
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 4,
        title: 'Pitchfork (Andrews\' Pitchfork) tool',
        blocks: [
          {
            type: 'text',
            content:
              'Andrews\' Pitchfork consists of three parallel trendlines drawn from three pivot points. The median line is drawn from the first pivot to the midpoint between pivots two and three. Price tends to gravitate toward the median line about 80% of the time once inside the channel.',
          },
          {
            type: 'definition',
            content:
              'The outer lines act as support/resistance, and breaks beyond them often produce measured moves equal to the channel width. Pitchforks are sensitive to anchor point selection - use clear, unambiguous swing points on H4 and above for the most reliable construction.',
          },
          {
            type: 'practiceTip',
            content: 'Apply this concept on a demo account. Practice until the concept feels intuitive, not memorized.',
          },
        ],
      },
      {
        id: 5,
        title: 'Gann levels and angles',
        blocks: [
          {
            type: 'definition',
            content:
              'Gann analysis uses geometric angles and time/price relationships. The most important is the 1x1 (45° angle), representing one unit of price for one unit of time. Other angles: 2x1 (steeper, bullish), 1x2 (shallower). Gann fans divide price/time into proportional segments.',
          },
          {
            type: 'definition',
            content:
              'Gann analysis is considered controversial - some traders find it effective, others view it as overly complex with no statistical edge. The challenge is standardizing the scaling between price and time axes. Treat it as a supplementary tool and verify signals with more established methods.',
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 6,
        title: 'Pivot points: standard, Camarilla, Woodie, Fibonacci',
        blocks: [
          {
            type: 'text',
            content:
              'Pivot points are mathematically calculated S/R levels based on the previous period\'s high, low, and close. Central Pivot (PP) = (H+L+C)/3. Support and resistance levels are calculated above and below. Standard pivots are most common; Camarilla pivots cluster tighter around current price; Fibonacci pivots use Fibonacci percentages.',
          },
          {
            type: 'keyConcept',
            content:
              'Pivot points are popular among day traders because they provide objective, pre-calculated levels. Above the central pivot = bullish bias; below = bearish. R1/S1 are most commonly tested. R2/S2 are secondary targets. R3/S3 are extreme levels rarely reached except during very volatile sessions.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Fibonacci retracements (38.2%, 50%, 61.8%, 78.6%) work due to mass observation - 61.8% is the golden ratio',
      'Fibonacci extensions (127.2%, 161.8%, 200%) project profit targets beyond the original swing',
      'Fibonacci time zones are less reliable in forex - use as awareness tools not primary signals',
      'Andrews\' Pitchfork creates channels with median line attraction - use clear swing points on H4+',
      'Gann analysis is controversial - treat as supplementary tool due to scaling challenges',
      'Pivot points provide objective daily S/R levels - PP determines bias, R1/S1 most commonly tested',
    ],
    studyNotes:
      'This module covers Fibonacci and advanced technical tools across 6 topics (~25 min read). After reading, practice drawing Fibonacci retracements on 10 different swings across multiple pairs. Document where price reacted at each level and calculate your success rate. Focus on the 61.8% level - it\'s the most reliable Fibonacci entry point when combined with price action confirmation.',
  },
  '3.1': {
    topics: [
      {
        id: 1,
        title: 'What is price action trading?',
        blocks: [
          {
            type: 'definition',
            content:
              'Price action trading uses raw price data - candlesticks on a clean chart - without indicator overlays. Since indicators are derived FROM price, they can never contain MORE information than price itself. By reading raw price, you access the primary data source without lag or distortion.',
          },
          {
            type: 'definition',
            content:
              'Strip your chart down to just candles. No moving averages, no RSI. Learn to read what the market tells you through shape, size, and location of each candle. Professional institutional traders use minimal or no indicators - this clean approach develops deeper market understanding.',
          },
          {
            type: 'hierarchy',
            content: 'POSITION SIZE FORMULA',
            hierarchyData: [
              { icon: '1', title: 'Risk-Based Position Sizing', desc: 'Position Size = (Account × Risk%) ÷ (Stop Loss in Pips × Pip Value)' },
              { icon: '2', title: 'Example Calculation', desc: 'With a $10,000 account risking 2% with a 50-pip stop: ($10,000 × 0.02) ÷ (50 × $10) = 0.40 lots' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Remove all indicators from a chart and practice reading price action alone for at least one full session.',
          },
        ],
      },
      {
        id: 2,
        title: 'Why trade without indicators?',
        blocks: [
          {
            type: 'definition',
            content:
              'Supply zones are areas where sellers overwhelmed buyers, causing sharp declines. They form at the origin of strong bearish moves - the consolidation before the drop. When price returns, remaining unfilled sell orders create resistance. Demand zones are where buyers launched strong rallies - unfilled buy orders absorb selling on revisits.',
          },
          {
            type: 'text',
            content:
              'To identify: look for areas where price moved explosively away. The consolidation before that move is your zone. Draw a rectangle covering candle bodies in that area. Strongest zones are fresh (untested), on higher timeframes (daily/weekly), and the move away was large and decisive.',
          },
          {
            type: 'hierarchy',
            content: 'RISK MANAGEMENT RULES',
            hierarchyData: [
              { icon: '1', title: '1-2%', desc: 'Risk Per Trade - Of total account' },
              { icon: '2', title: '1:2+', desc: 'Risk-Reward - Minimum ratio' },
              { icon: '3', title: '5-6%', desc: 'Max Daily Risk - Stop trading after' },
              { icon: '4', title: '20%', desc: 'Max Drawdown - Review strategy' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Add this indicator to a demo chart and observe how it behaves during trending vs ranging markets.',
          },
        ],
      },
      {
        id: 3,
        title: 'Reading market sentiment through candles',
        blocks: [
          {
            type: 'definition',
            content:
              'An order block is the last opposing candle before a significant move - a refined supply/demand concept. A bullish order block is the last bearish candle before a strong up-move. The theory: institutional traders build positions gradually; the last opposing candle represents final accumulation/distribution.',
          },
          {
            type: 'definition',
            content:
              'Order blocks are most effective on H4 and Daily timeframes, at key structural levels, with additional confluence. Treat them as refined supply/demand zones rather than magical levels - always require additional confirmation.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 4,
        title: 'The concept of clean charts',
        blocks: [
          {
            type: 'definition',
            content:
              'Market structure analysis tracks: swing points (clear highs/lows defining the trend), Break of Structure (BOS - price breaking beyond the recent swing point, confirming continuation), and Change of Character (CHoCH - the first opposing break, signaling potential reversal).',
          },
          {
            type: 'definition',
            content:
              'Tracking structure shifts on multiple timeframes gives nuanced insight. The daily might show strong uptrend (BOS after BOS) while H1 shows a CHoCH - suggesting short-term pullback within the larger uptrend. This multi-layered analysis forms the backbone of professional price action trading.',
          },
          {
            type: 'practiceTip',
            content: 'Open a demo chart and identify at least 5 real examples of this pattern across different timeframes.',
          },
        ],
      },
      {
        id: 5,
        title: 'Market structure: impulse vs corrective moves',
        blocks: [
          {
            type: 'definition',
            content:
              'Liquidity refers to clusters of stop-loss orders at obvious levels - above swing highs, below swing lows, at round numbers. Large players target these "pools" to fill their own orders. A sweep above a swing high triggers buy stops (providing selling liquidity for institutional shorts).',
          },
          {
            type: 'text',
            content:
              'Recognizing liquidity sweeps: (1) obvious level with likely stop clusters, (2) price pokes through briefly (the sweep), (3) aggressive reversal back inside the range, (4) continuation in the reversal direction. Instead of being the trader whose stops get hunted, enter AFTER the sweep for high-probability setups.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 6,
        title: 'Building a price action framework',
        blocks: [
          {
            type: 'text',
            content:
              'Smart money concepts (SMC) provide a framework for understanding institutional trading. Key concepts: premium/discount zones (institutions sell expensive, buy cheap), fair value gaps (imbalances where price moved so aggressively that gaps need filling), and institutional order flow.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Price action trading uses raw candlestick data without indicators - accessing primary market information without lag',
      'Supply/demand zones form at origins of strong moves - look for explosive price movement away from consolidation areas',
      'Order blocks are refined supply/demand concepts - the last opposing candle before significant institutional moves',
      'Market structure tracks BOS (continuation) and CHoCH (reversal) across multiple timeframes for nuanced analysis',
      'Liquidity sweeps target stop clusters at obvious levels - enter AFTER the sweep, not before',
      'Smart money concepts explain institutional behavior through premium/discount zones and fair value gaps',
    ],
    studyNotes:
      'This module covers price action trading fundamentals across 6 topics (~25 min read). After reading, remove all indicators from your charts for one week and practice identifying supply/demand zones, order blocks, and market structure shifts. Document how price reacts at these levels to build your price action reading skills.',
  },
  '3.2': {
    topics: [
      {
        id: 1,
        title: 'Supply zones vs resistance',
        blocks: [
          {
            type: 'definition',
            content:
              'Pin bars form when price tests a level and is sharply rejected - a long wick (2-3x the body) and small body. Bullish pin bars (long lower wick) at support signal rejection of lower prices. Bearish pin bars (long upper wick) at resistance signal rejection of higher prices.',
          },
          {
            type: 'definition',
            content:
              'Entry: break of the pin bar\'s body, stop beyond the wick tip. Highest probability pin bars reject a key level AND align with the higher-timeframe trend direction. A pin bar in the middle of nowhere means nothing - context is everything.',
          },
          {
            type: 'hierarchy',
            content: 'GDP IMPACT ON FOREX',
            hierarchyData: [
              { icon: '1', title: 'GDP Above Expected', desc: 'Currency strengthens - economy growing faster than anticipated' },
              { icon: '2', title: 'GDP Below Expected', desc: 'Currency weakens - slower growth signals potential rate cuts' },
              { icon: '3', title: 'Revision Matters', desc: 'GDP revisions can move markets as much as initial releases' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 2,
        title: 'Demand zones vs support',
        blocks: [
          {
            type: 'definition',
            content:
              'Engulfing patterns: a large candle completely engulfs the previous candle\'s body. Bullish engulfing at support shows buyers overwhelmed sellers decisively. Inside bars: a candle\'s entire range fits within the previous candle\'s range - consolidation before a breakout.',
          },
          {
            type: 'text',
            content:
              'Outside bars engulf both the high AND low of the previous candle, showing extreme volatility. Close near the high suggests bullish continuation; near the low suggests bearish. These powerful setups work best at key levels with higher-timeframe trend alignment.',
          },
          {
            type: 'hierarchy',
            content: 'KEY ECONOMIC INDICATORS',
            hierarchyData: [
              { icon: '1', title: 'NFP', desc: 'US Employment - 1st Friday monthly' },
              { icon: '2', title: 'CPI', desc: 'Inflation - Monthly release' },
              { icon: '3', title: 'PMI', desc: 'Manufacturing - >50 = expansion' },
              { icon: '4', title: 'GDP', desc: 'Growth Rate - Quarterly' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 3,
        title: 'Identifying institutional order blocks',
        blocks: [
          {
            type: 'definition',
            content:
              'Fakey setups occur when an inside bar breakout fails: inside bar forms, price breaks one side, then reverses and closes back inside or beyond the opposite side. The initial breakout traps traders - their stop-losses fuel the reversal.',
          },
          {
            type: 'definition',
            content:
              'Enter opposite to the failed breakout with stop beyond the false breakout extreme. Fakey setups are among the highest-probability patterns because they combine trapped traders exiting AND new traders entering the same direction - double fuel for clean, decisive moves.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 4,
        title: 'Fresh vs tested zones',
        blocks: [
          {
            type: 'text',
            content:
              'Advanced entry techniques: Limit order entries at the 50% retracement of a signal candle give better prices but risk missing the trade. Break-and-retest entries wait for a pullback to the broken level for confirmation. Multi-candle confirmation waits for follow-through after the initial signal.',
          },
          {
            type: 'keyConcept',
            content:
              'Each technique trades off between entry quality, fill rate, and risk-to-reward. Choose based on your trading style and the specific setup\'s strength and context.',
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 5,
        title: 'Zone scoring: strength criteria',
        blocks: [
          {
            type: 'definition',
            content:
              'Reading price "stories" means interpreting candle sequences as narratives. Large bullish candle -> Doji -> Doji -> bearish engulfing tells a story: strong buying -> indecision -> indecision -> sellers take over. Small-bodied candles clustering at a level followed by a large breakout candle: deliberation followed by institutional commitment.',
          },
          {
            type: 'definition',
            content:
              'Develop this ability through extensive screen time - study historical charts and analyze what happened at key levels. Keep a visual journal of price narratives and their outcomes. Over time, you develop intuitive pattern recognition that can\'t be reduced to formulas.',
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 6,
        title: 'Trading the zone flip',
        blocks: [
          {
            type: 'text',
            content:
              'Building a personalized price action system: select 2-3 core setups, define exact rules for each, and trade ONLY those setups. A simple system might be: (1) pin bars at daily S/R aligned with weekly trend, (2) engulfing patterns at fresh supply/demand zones, (3) fakey setups at range boundaries.',
          },
          {
            type: 'definition',
            content:
              'Consistency is key - trade the same setups the same way every time. Your edge exists over a large sample of trades, not any individual trade. Trust the process, follow your rules, and let statistics work in your favor.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Pin bars show sharp rejection - long wicks (2-3x body) with small bodies, entry on body break, stop beyond wick',
      'Engulfing patterns show decisive momentum shifts - large candles completely engulfing previous bodies',
      'Fakey setups trap traders on false breakouts - enter opposite to failed breakout for high-probability moves',
      'Advanced entry techniques balance price quality vs fill probability - limit, break-and-retest, multi-candle confirmation',
      'Zone strength depends on freshness, timeframe, and move-away characteristics - score zones systematically',
      'Build a personalized system with 2-3 core setups and trade them consistently for statistical edge',
    ],
    studyNotes:
      'This module covers supply and demand zone trading across 6 topics (~25 min read). After reading, practice identifying fresh vs tested zones on daily and 4-hour charts. Score zones based on strength criteria and track their reaction rates. Focus on high-quality zones that align with higher-timeframe trends for the best probability setups.',
  },
  '3.3': {
    topics: [
      {
        id: 1,
        title: 'Higher highs/lows and lower highs/lows',
        blocks: [
          {
            type: 'definition',
            content:
              'Sniper entries maximize precision by identifying setups on higher timeframes then dropping to lower timeframes for entry. A Daily pin bar with a 60-pip wick might require a 70-pip stop on the Daily, but an M15 engulfing at the same level might only need 20 pips - tripling your risk-to-reward ratio.',
          },
          {
            type: 'text',
            content:
              'The trade-off: not every setup provides a clean lower-timeframe entry. If the trigger doesn\'t appear, skip the trade. Missing a good trade is always better than forcing an entry with suboptimal risk.',
          },
          {
            type: 'hierarchy',
            content: 'CENTRAL BANK RATE CYCLE',
            hierarchyData: [
              { icon: '1', title: 'Dovish Signals', desc: 'Rate cuts expected' },
              { icon: '2', title: 'Rate Cut', desc: 'Currency weakens' },
              { icon: '3', title: 'Neutral Stance', desc: 'Markets stabilize' },
              { icon: '4', title: 'Hawkish Signals', desc: 'Rate hikes expected' },
              { icon: '5', title: 'Rate Hike', desc: 'Currency strengthens' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 2,
        title: 'Break of structure (BOS)',
        blocks: [
          {
            type: 'text',
            content:
              'Breakout trading captures momentum when price exits a range or pattern. True breakouts share: increasing volume, clean candle close beyond the level, and follow-through. Breakouts are most reliable during high-liquidity sessions, aligned with the higher-timeframe trend, after a compression period.',
          },
          {
            type: 'keyConcept',
            content:
              'Two entry approaches: enter on the breakout candle\'s close (faster, higher risk), or wait for a pullback to the broken level (more conservative). The retest approach provides tighter stops and confirms the level has genuinely flipped.',
          },
          {
            type: 'hierarchy',
            content: 'MAJOR CENTRAL BANKS',
            hierarchyData: [
              { icon: '1', title: 'Fed', desc: 'US Dollar - Federal Reserve' },
              { icon: '2', title: 'ECB', desc: 'Euro - European Central Bank' },
              { icon: '3', title: 'BOE', desc: 'British Pound - Bank of England' },
              { icon: '4', title: 'BOJ', desc: 'Japanese Yen - Bank of Japan' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 3,
        title: 'Change of character (CHoCH)',
        blocks: [
          {
            type: 'definition',
            content:
              'Pullback entries capitalize on temporary moves against the prevailing trend. The ideal pullback reaches a confluence zone - Fibonacci retracement aligning with horizontal support AND a rising trendline. Enter when a reversal signal appears at this confluence zone.',
          },
          {
            type: 'keyConcept',
            content:
              'Key distinction: a healthy pullback stays within trend structure (doesn\'t break the most recent swing low in an uptrend), shows decreasing momentum (smaller candles, lower volume). A reversal breaks structure and shows increasing counter-trend momentum.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 4,
        title: 'Liquidity concepts: buy-side and sell-side',
        blocks: [
          {
            type: 'text',
            content:
              'Range-bound strategies buy at support, sell at resistance, with stops beyond range boundaries. Confirm a range with at least two bounces off each boundary. Look for reversal candlestick patterns at boundaries rather than blindly entering.',
          },
          {
            type: 'definition',
            content:
              'Use oscillators (RSI, Stochastic) in range environments - they work best when price oscillates. Reduce position size in ranges compared to trend trades, as the reward potential (range width minus costs) is typically smaller. Ranges eventually break - be prepared to adapt.',
          },
          {
            type: 'practiceTip',
            content: 'Study where stop-loss clusters likely sit (above highs/below lows) and observe how price hunts those levels.',
          },
        ],
      },
      {
        id: 5,
        title: 'Order blocks and fair value gaps',
        blocks: [
          {
            type: 'text',
            content:
              'Continuation trading captures trend resumption after pauses. Key patterns: flags, ascending/descending triangles within trends, and horizontal consolidations before the next impulse. Enter on the breakout of the consolidation with stop beyond the opposite boundary.',
          },
          {
            type: 'definition',
            content:
              'Continuation trades have a statistical advantage because trends tend to persist. A consolidation within a trend is the market "taking a breath." If the consolidation breaks the wrong direction, exit immediately - don\'t hope for reversal.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 6,
        title: 'Smart money concepts introduction',
        blocks: [
          {
            type: 'text',
            content:
              'Counter-trend trading catches major turning points. Requirements: (1) well-defined reversal level (major weekly/monthly S/R), (2) exhaustion signs (divergence, climactic candles), (3) clear price action trigger, (4) structural logic (completing a pattern like H&S).',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Sniper entries use higher timeframe analysis with lower timeframe precision for optimal risk-to-reward',
      'Break of structure confirms trend continuation - look for clean closes beyond levels with volume confirmation',
      'Change of character signals potential reversal - first opposing break after series of trend-confirming breaks',
      'Liquidity concepts explain institutional behavior - stop clusters at obvious levels get hunted for order flow',
      'Order blocks and fair value gaps show institutional footprints - refined supply/demand concepts',
      'Smart money concepts track institutional behavior through premium/discount and imbalance mechanics',
    ],
    studyNotes:
      'This module covers market structure and order flow analysis across 6 topics (~25 min read). After reading, practice identifying BOS and CHoCH on multiple timeframes. Document how price reacts after these structural breaks and track the success rate of continuation vs reversal scenarios.',
  },
  '3.4': {
    topics: [
      {
        id: 1,
        title: 'Confirmation entries vs aggressive entries',
        blocks: [
          {
            type: 'definition',
            content:
              'ATR (Average True Range) measures market volatility - the average range of price movement over a period (default 14). Use ATR for dynamic stop-loss placement: set your stop at 1.5-2x ATR from entry, automatically adjusting for volatility conditions. In high-volatility environments, reduce position size to maintain the same dollar risk.',
          },
          {
            type: 'definition',
            content:
              'ATR doesn\'t indicate direction - only how much price is moving. It\'s a tool for calibrating your trade parameters to current conditions rather than using arbitrary fixed pip values.',
          },
          {
            type: 'hierarchy',
            content: 'GEOPOLITICAL RISK FACTORS',
            hierarchyData: [
              { icon: '1', title: 'Elections', desc: 'Policy uncertainty creates volatility - markets price in expected outcomes' },
              { icon: '2', title: 'Conflicts', desc: 'Wars and tensions drive safe-haven flows (USD, JPY, CHF, Gold)' },
              { icon: '3', title: 'Trade Wars', desc: 'Tariffs and sanctions directly impact currency valuations' },
              { icon: '4', title: 'Commodity Shocks', desc: 'Oil/gas disruptions affect commodity-linked currencies (CAD, AUD, NOK)' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 2,
        title: 'Pin bar and engulfing setups at key levels',
        blocks: [
          {
            type: 'definition',
            content:
              'Volatility expansion follows volatility contraction - one of the most reliable trading principles. When ATR reaches unusually low levels, a significant move is brewing. Bollinger Band squeeze, declining ATR, and narrowing ranges all signal compression that will resolve in a breakout.',
          },
          {
            type: 'keyConcept',
            content:
              'Identify the compression phase, establish range boundaries, and prepare for a breakout. Use higher-timeframe trend and fundamental context to bias the expected direction. Breakouts from compression often produce moves equal to or larger than the preceding range width.',
          },
          {
            type: 'practiceTip',
            content: 'Mark key levels on 3 different currency pairs across daily and 4-hour charts. Compare your levels with price reactions.',
          },
        ],
      },
      {
        id: 3,
        title: 'Break and retest entries',
        blocks: [
          {
            type: 'definition',
            content:
              'Different sessions have distinct volatility profiles. Asian session (Tokyo) is least volatile - suitable for range strategies. London open (7-10 AM GMT) produces the highest volatility spikes as European traders react to overnight developments. US data releases (8:30 AM EST) create predictable volatility spikes.',
          },
          {
            type: 'definition',
            content:
              'Plan around these patterns: either avoid trading during releases (safest) or use specific news strategies with wider stops and reduced positions. The London-New York overlap (1-5 PM GMT) is the highest-volume, tightest-spread window for most strategies.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 4,
        title: 'Fakeout/stop-hunt entries',
        blocks: [
          {
            type: 'definition',
            content:
              'Major news events can cause 50-200+ pip moves within minutes, blowing through stops and creating massive slippage. Three approaches: (1) Avoid - flatten positions before news, wait 15-30 minutes post-release. (2) Straddle - pending orders on both sides (risk: whipsaw triggers both). (3) Fade - trade the counter-move after the initial spike settles.',
          },
          {
            type: 'keyConcept',
            content:
              'Regardless of approach: reduce position size, widen stops, never use market orders during the release. Slippage during the first seconds can be extreme.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 5,
        title: 'Multiple entries and scaling in',
        blocks: [
          {
            type: 'text',
            content:
              'Volatility filters adjust your trading based on current conditions. When ATR > 20-period average = high-volatility regime: trend strategies work better, wider stops needed. When ATR < average = low-volatility: range strategies work better, tighter stops possible.',
          },
          {
            type: 'keyConcept',
            content:
              'A simple daily filter: compare today\'s ATR to 20-day average ATR. Above = trend mode. Below = range mode. At extremes = expect regime change soon. This prevents using the wrong strategy for current conditions.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 6,
        title: 'Entry timing: candle close vs intra-candle',
        blocks: [
          {
            type: 'text',
            content:
              'A complete volatility framework: each trading day, assess the volatility environment (ATR relative to history), check for scheduled events, identify the current session and expected liquidity. Select appropriate strategies accordingly.',
          },
          {
            type: 'keyConcept',
            content:
              'Adjust all parameters dynamically: stops expand in high volatility and contract in low volatility; position sizes decrease in high volatility; targets extend in high volatility and contract in low volatility. This ensures your trading adapts to current market conditions.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'ATR provides dynamic volatility-based stop placement - use 1.5-2x ATR for stops, adjust position size for risk',
      'Volatility expansion follows contraction - look for Bollinger squeezes and low ATR for breakout opportunities',
      'Session-specific volatility patterns - Asian (low), London open (high), US data (spikes), London-NY overlap (best)',
      'News event strategies: avoid, straddle, or fade - always reduce size and widen stops during releases',
      'Volatility filters match strategy to conditions - high ATR = trend mode, low ATR = range mode',
      'Dynamic parameter adjustment based on volatility ensures consistent risk management across market conditions',
    ],
    studyNotes:
      'This module covers entry techniques and volatility management across 6 topics (~25 min read). After reading, implement ATR-based stops on your demo account and track how they perform compared to fixed-pip stops. Practice identifying volatility compression patterns and prepare for the resulting breakouts.',
  },
  '3.6': {
    topics: [
      {
        id: 1,
        title: 'Defining your edge: what gives you an advantage?',
        blocks: [
          {
            type: 'text',
            content:
              'Risk-reward optimization involves finding the sweet spot between stop-loss distance and take-profit target that maximizes long-term profitability. Too tight a stop increases win rate losses; too wide a stop reduces the R:R ratio.',
          },
          {
            type: 'keyConcept',
            content:
              'ATR-based stops (1.5-2x ATR) adapt to current volatility and typically produce better results than fixed pip stops. Test different multiples in your backtesting to find the optimal balance for your strategy.',
          },
          {
            type: 'hierarchy',
            content: 'SENTIMENT INDICATORS',
            hierarchyData: [
              { icon: '1', title: 'COT Report', desc: 'Commitments of Traders - shows institutional positioning weekly' },
              { icon: '2', title: 'VIX Index', desc: 'Fear gauge - high VIX = market uncertainty & risk-off flows' },
              { icon: '3', title: 'Retail Positioning', desc: 'When most retail traders are long, consider fading the crowd' },
              { icon: '4', title: 'Risk On/Off', desc: 'Tracks flow between risky assets and safe havens' },
            ],
          },
          {
            type: 'practiceTip',
            content: 'Document one complete strategy with clear entry/exit rules, then backtest it on at least 50 historical setups.',
          },
        ],
      },
      {
        id: 2,
        title: 'Creating a rules-based system',
        blocks: [
          {
            type: 'definition',
            content:
              'Trade management - what you do AFTER entering a trade - often determines profitability more than entry quality. Key decisions: when to move stop to breakeven, when to take partial profits, when to trail your stop, and when to close early.',
          },
          {
            type: 'keyConcept',
            content:
              'A disciplined approach: move to breakeven after 1R of profit, take 50% off at 1.5R, trail the remainder using structure-based stops. This locks in profits while maintaining exposure to larger moves.',
          },
          {
            type: 'practiceTip',
            content: 'Document one complete strategy with clear entry/exit rules, then backtest it on at least 50 historical setups.',
          },
        ],
      },
      {
        id: 3,
        title: 'Backtesting methodology',
        blocks: [
          {
            type: 'definition',
            content:
              'Scaling strategies: Scaling in builds a position gradually - first entry at the setup level, additions on pullbacks within the developing trend. Each addition risks less than the previous. Scaling out takes partial profits at milestones while letting the remainder run.',
          },
          {
            type: 'definition',
            content:
              'Scaling in works best for trend-following (adding on confirmed pullbacks). Mean-reversion strategies are better entered at full size since the signal is at the extreme - there\'s no "better price" to wait for.',
          },
          {
            type: 'practiceTip',
            content: 'Document one complete strategy with clear entry/exit rules, then backtest it on at least 50 historical setups.',
          },
        ],
      },
      {
        id: 4,
        title: 'Forward testing on demo',
        blocks: [
          {
            type: 'text',
            content:
              'Time-based exits close positions after a predetermined holding period, regardless of price action. If your average winning trade takes 3 days, a trade still going nowhere after 5 days is probably not going to work. Time-based exits prevent capital being tied up in dead trades.',
          },
          {
            type: 'keyConcept',
            content:
              'Combine time-based exits with price-based management: if the trade hasn\'t reached 1R within your expected timeframe, close it and move on. This keeps your capital active in higher-probability opportunities.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 5,
        title: 'Adapting to different market conditions',
        blocks: [
          {
            type: 'text',
            content:
              'Multiple target strategies split the trade into segments with different exits. Example: 1/3 at 1R (lock in guaranteed profit), 1/3 at 2R (healthy profit capture), 1/3 trail to exhaustion (capture the home run). This balances the psychological need for realized profits with the mathematical benefit of letting winners run.',
          },
          {
            type: 'keyConcept',
            content:
              'The specific ratios depend on your strategy\'s characteristics. Trend-following strategies benefit from larger trailing portions (1/3 take profit, 2/3 trail). Mean-reversion strategies benefit from more fixed targets.',
          },
          {
            type: 'practiceTip',
            content: 'Create a one-page summary of this topic and explain it as if teaching a beginner.',
          },
        ],
      },
      {
        id: 6,
        title: 'Strategy documentation: the trading blueprint',
        blocks: [
          {
            type: 'definition',
            content:
              'Risk-reward analysis of your completed trades reveals optimization opportunities. Calculate the average maximum favorable excursion (MFE - how far winning trades go in your favor) and average maximum adverse excursion (MAE - how far against you before recovering). MFE shows if you\'re exiting too early; MAE shows if your stops could be tighter.',
          },
          {
            type: 'keyConcept',
            content:
              'If your average winning trade moves 80 pips in your favor but you\'re taking profit at 40 pips, you\'re leaving half the move on the table. If your average losing trade only moves 15 pips against you before hitting your 30-pip stop, your stops might be too wide. Data-driven optimization like this compounds into significant performance improvement.',
          },
        ],
      },
    ],
    keyTakeaways: [
      'Risk-reward optimization finds the sweet spot between stop distance and target - ATR-based stops adapt to volatility',
      'Trade management after entry often determines profitability - move to breakeven at 1R, take partial profits at 1.5R',
      'Scaling strategies: scale in for trends (add on pullbacks), scale out for all strategies (lock in profits)',
      'Time-based exits prevent capital being tied up in dead trades - close if no 1R within expected timeframe',
      'Multiple targets balance psychological needs with mathematical benefits - split trades into segments',
      'MFE/MAE analysis reveals optimization opportunities - use trade data to tighten stops and extend targets',
    ],
    studyNotes:
      'This module covers building a complete price action strategy across 6 topics (~25 min read). After reading, document your complete strategy with specific rules for entry, stop, targets, and trade management. Backtest on 50+ historical setups and calculate your MFE/MAE to optimize parameters.',
  },
};
