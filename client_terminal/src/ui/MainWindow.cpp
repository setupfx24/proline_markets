#include "ui/MainWindow.h"
#include "ui/WatchlistWidget.h"
#include "ui/WebChartWidget.h"
#include "ui/OrderTicket.h"
#include "ui/AccountPanel.h"
#include "ui/PositionsPanel.h"
#include "ui/LoginDialog.h"
#include "ui/WalletDialog.h"
#include "core/ApiClient.h"
#include "core/PriceStream.h"

#include <QDockWidget>
#include <QSplitter>
#include <QStatusBar>
#include <QToolBar>
#include <QLabel>
#include <QTimer>
#include <QMessageBox>
#include <QApplication>
#include <QHBoxLayout>
#include <QPushButton>
#include <QScrollArea>
#include <QFrame>
#include <QComboBox>
#include <QMenu>
#include <QPoint>
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>
#include "ui/Theme.h"

// A single account chip: small muted caption over a value.
static QWidget* makeChip(const QString& caption, QLabel*& valueOut) {
    auto* w = new QWidget;
    auto* v = new QVBoxLayout(w);
    v->setContentsMargins(14, 6, 14, 6);
    v->setSpacing(0);
    auto* cap = new QLabel(caption);
    cap->setStyleSheet("color:#6b7280; font-size:9px; font-weight:700; letter-spacing:1px;");
    valueOut = new QLabel("—");
    valueOut->setStyleSheet("color:#e6e9ee; font-size:14px; font-weight:700;");
    v->addWidget(cap);
    v->addWidget(valueOut);
    return w;
}

QWidget* MainWindow::buildHeader() {
    auto* bar = new QWidget;
    bar->setFixedHeight(56);
    bar->setStyleSheet("background:#101216; border-bottom:1px solid #24272e;");
    auto* lay = new QHBoxLayout(bar);
    lay->setContentsMargins(16, 0, 16, 0);
    lay->setSpacing(0);

    auto* brand = new QLabel("◆  Proline <span style='color:#6b7280;font-weight:500;'>Terminal</span>");
    brand->setTextFormat(Qt::RichText);
    brand->setStyleSheet("color:#3b82f6; font-size:16px; font-weight:800; letter-spacing:0.5px;");
    lay->addWidget(brand);
    lay->addSpacing(22);

    const QString navBtn =
        "QPushButton{background:transparent;color:#b7bcc4;border:1px solid #2f3a4d;"
        "border-radius:8px;padding:7px 14px;font-weight:600;font-size:12px;}"
        "QPushButton:hover{background:#1e2a44;color:#fff;border-color:#3b82f6;}";

    // ── Trading Accounts — switch between the user's accounts ──
    auto* accountsBtn = new QPushButton(tr("⚏  Trading Accounts  ▾"));
    accountsBtn->setCursor(Qt::PointingHandCursor);
    accountsBtn->setStyleSheet(navBtn);
    connect(accountsBtn, &QPushButton::clicked, this, [this, accountsBtn]() {
        QMenu menu(this);
        menu.setStyleSheet("QMenu{background:#16181d;border:1px solid #2a2e36;border-radius:10px;padding:6px;}"
                           "QMenu::item{padding:9px 22px;border-radius:6px;color:#d6d9de;font-size:12px;}"
                           "QMenu::item:selected{background:#1e2a44;color:#fff;}");
        const QJsonArray accts = QJsonDocument::fromJson(m_cfg.accountsJson.toUtf8()).array();
        if (accts.isEmpty()) {
            connect(menu.addAction(tr("Sign in to switch accounts…")),
                    &QAction::triggered, this, &MainWindow::openSettings);
        } else {
            for (const QJsonValue& v : accts) {
                const QJsonObject o = v.toObject();
                const QString id = o.value("account_id").toString();
                QString label = QString("%1  ·  %2").arg(o.value("account_number").toString(),
                                    o.value("is_demo").toBool() ? tr("DEMO") : tr("LIVE"));
                if (id == m_cfg.accountId) label = "✓  " + label;
                connect(menu.addAction(label), &QAction::triggered, this,
                        [this, id]() { switchAccount(id); });
            }
        }
        menu.exec(accountsBtn->mapToGlobal(QPoint(0, accountsBtn->height() + 4)));
    });
    lay->addWidget(accountsBtn);

    // ── Wallet — fund a trading account from the main wallet ──
    auto* walletBtn = new QPushButton(tr("💰  Wallet"));
    walletBtn->setCursor(Qt::PointingHandCursor);
    walletBtn->setStyleSheet(navBtn);
    connect(walletBtn, &QPushButton::clicked, this, [this]() {
        WalletDialog dlg(m_cfg, this);
        connect(&dlg, &WalletDialog::transferred, this, [this]() { m_api->fetchAccount(); });
        dlg.exec();
    });
    lay->addWidget(walletBtn);
    lay->addStretch();

    lay->addWidget(makeChip(tr("ACCOUNT"), m_hdrAccount));
    lay->addWidget(makeChip(tr("BALANCE"), m_hdrBalance));
    lay->addWidget(makeChip(tr("EQUITY"),  m_hdrEquity));

    m_hdrConn = new QLabel("●  Connecting");
    m_hdrConn->setStyleSheet("color:#f59e0b; font-size:11px; font-weight:600; padding-left:8px;");
    lay->addWidget(m_hdrConn);
    return bar;
}

MainWindow::MainWindow(const Config& cfg, QWidget* parent)
    : QMainWindow(parent), m_cfg(cfg) {
    setWindowTitle(tr("Proline Terminal"));
    setMinimumSize(1000, 620);   // stays usable on smaller desktops
    resize(1360, 840);

    m_api    = new ApiClient(m_cfg, this);
    m_stream = new PriceStream(m_cfg, this);

    // --- widgets ---
    m_watch     = new WatchlistWidget;
    m_chart     = new WebChartWidget(m_api, m_stream);   // TradingView via WebEngine
    m_ticket    = new OrderTicket;
    m_account   = new AccountPanel;
    m_positions = new PositionsPanel;

    // ── Central column: chart on top, TRADES panel directly below it ──
    auto* tradesHeader = new QWidget;
    tradesHeader->setStyleSheet("background:#16181d; border-top:1px solid #24272e; border-bottom:1px solid #24272e;");
    auto* thl = new QHBoxLayout(tradesHeader);
    thl->setContentsMargins(12, 5, 8, 5);
    auto* tlab = new QLabel(tr("TRADES"));
    tlab->setStyleSheet("color:#7c828c; font-weight:700; font-size:10px; letter-spacing:1.5px;");
    auto* toggle = new QPushButton(QStringLiteral("▾  Hide"));
    toggle->setCursor(Qt::PointingHandCursor);
    toggle->setStyleSheet(
        "QPushButton{background:#22262e; color:#cbd5e1; border:1px solid #333a45;"
        "border-radius:6px; padding:3px 14px; font-size:11px; font-weight:700;}"
        "QPushButton:hover{background:#2a2f39; color:#fff; border-color:#3b82f6;}");
    thl->addWidget(tlab);
    thl->addStretch();
    thl->addWidget(toggle);

    auto* tradesWrap = new QWidget;
    auto* twl = new QVBoxLayout(tradesWrap);
    twl->setContentsMargins(0, 0, 0, 0);
    twl->setSpacing(0);
    twl->addWidget(tradesHeader);
    twl->addWidget(m_positions);

    auto* centerSplit = new QSplitter(Qt::Vertical);
    centerSplit->addWidget(m_chart);
    centerSplit->addWidget(tradesWrap);
    centerSplit->setStretchFactor(0, 1);   // chart takes the extra space
    centerSplit->setStretchFactor(1, 0);
    centerSplit->setCollapsible(0, false);
    centerSplit->setCollapsible(1, false);
    setCentralWidget(centerSplit);

    connect(toggle, &QPushButton::clicked, this, [this, centerSplit, toggle]() {
        const bool collapse = !m_positions->isCollapsed();
        m_positions->setCollapsed(collapse);
        const int h = centerSplit->height();
        centerSplit->setSizes(collapse ? QList<int>{h, 1} : QList<int>{h - 220, 220});
        toggle->setText(collapse ? QStringLiteral("▴  Show") : QStringLiteral("▾  Hide"));
    });
    // Give the trades panel a sensible starting height once the window is sized.
    QTimer::singleShot(0, this, [centerSplit]() {
        const int h = centerSplit->height();
        centerSplit->setSizes({ h - 220, 220 });
    });

    // Left dock = watchlist
    auto* leftDock = new QDockWidget(tr("Market"), this);
    leftDock->setWidget(m_watch);
    leftDock->setFeatures(QDockWidget::DockWidgetMovable | QDockWidget::DockWidgetFloatable);
    addDockWidget(Qt::LeftDockWidgetArea, leftDock);
    resizeDocks({leftDock}, {260}, Qt::Horizontal);

    // Right dock = order ticket + account, wrapped in a scroll area so nothing
    // (BUY/SELL, account rows) is ever clipped on shorter screens — it scrolls.
    auto* rightContent = new QWidget;
    auto* rcl = new QVBoxLayout(rightContent);
    rcl->setContentsMargins(0, 0, 0, 0);
    rcl->setSpacing(0);
    rcl->addWidget(m_ticket);
    rcl->addWidget(m_account);
    rcl->addStretch();

    auto* rightScroll = new QScrollArea;
    rightScroll->setWidgetResizable(true);
    rightScroll->setFrameShape(QFrame::NoFrame);
    rightScroll->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    rightScroll->setWidget(rightContent);

    auto* rightDock = new QDockWidget(tr("Trade"), this);
    rightDock->setWidget(rightScroll);
    rightDock->setFeatures(QDockWidget::DockWidgetMovable | QDockWidget::DockWidgetFloatable);
    rightDock->setMinimumWidth(280);
    addDockWidget(Qt::RightDockWidgetArea, rightDock);
    resizeDocks({rightDock}, {310}, Qt::Horizontal);

    // --- toolbar ---
    setMenuWidget(buildHeader());

    auto* tb = addToolBar(tr("Main"));
    tb->setMovable(false);
    tb->addAction(tr("Settings"), this, &MainWindow::openSettings);
    tb->addAction(tr("Refresh account"), this, [this]() { m_api->fetchAccount(); });

    // --- status bar ---
    m_streamStatus = new QLabel(tr("Idle"));
    m_message = new QLabel;
    statusBar()->addWidget(m_streamStatus);
    statusBar()->addPermanentWidget(m_message);

    connectServices();

    // Kick off: symbols + account, then start the live stream.
    m_api->fetchSymbols();
    m_api->fetchAccount();
    m_api->fetchPositions();
    m_api->fetchOrders();
    m_api->fetchHistory();
    m_stream->start();

    // Periodic refresh — account + open positions/orders carry live P/L and move
    // with the market; history changes only on a close so it isn't polled here.
    m_accountTimer = new QTimer(this);
    m_accountTimer->setInterval(4000);
    connect(m_accountTimer, &QTimer::timeout, this, [this]() {
        m_api->fetchAccount();
        m_api->fetchPositions();
        m_api->fetchOrders();
    });
    m_accountTimer->start();
}

void MainWindow::connectServices() {
    // REST responses
    connect(m_api, &ApiClient::symbolsReceived, this, &MainWindow::onSymbolsReceived);
    connect(m_api, &ApiClient::accountReceived, m_account, &AccountPanel::setAccount);
    connect(m_api, &ApiClient::accountReceived, this, [this](const AccountInfo& a) {
        if (!a.valid) return;
        setStatus(QString());   // a good poll clears any stale transient error
        m_hdrAccount->setText(QString("#%1 %2").arg(a.account, a.isDemo ? "DEMO" : "LIVE"));
        m_hdrBalance->setText(QString("%L1 %2").arg(a.balance, 0, 'f', 2).arg(a.currency));
        m_hdrEquity->setText(QString("%L1 %2").arg(a.equity, 0, 'f', 2).arg(a.currency));
        m_hdrEquity->setStyleSheet(QString("font-size:14px; font-weight:700; color:%1;")
            .arg(a.equity > a.balance ? "#26a269" : a.equity < a.balance ? "#e01b24" : "#e6e9ee"));
    });
    connect(m_api, &ApiClient::tradeResult,     this,      &MainWindow::onTradeResult);
    connect(m_api, &ApiClient::errorOccurred,   this,      &MainWindow::onApiError);
    connect(m_api, &ApiClient::pricesReceived,  this, [this](const QVector<Quote>& qs) {
        for (const Quote& q : qs) m_watch->updateQuote(q);
    });

    // Watchlist selection
    connect(m_watch, &WatchlistWidget::symbolActivated, this, &MainWindow::onSymbolActivated);

    // The chart (TradingView) pulls bars + ticks itself via the ChartBridge,
    // so no bars/tick wiring is needed here for it.

    // Order ticket -> trade endpoints
    connect(m_ticket, &OrderTicket::buy, this,
            [this](const QString& s, double v, double sl, double tp) {
        m_api->placeOrder("BUY", s, v, sl, tp, "terminal");
    });
    connect(m_ticket, &OrderTicket::sell, this,
            [this](const QString& s, double v, double sl, double tp) {
        m_api->placeOrder("SELL", s, v, sl, tp, "terminal");
    });
    connect(m_ticket, &OrderTicket::closeAll, this, [this](const QString& s) {
        if (QMessageBox::question(this, tr("Close positions"),
                tr("Close ALL open %1 positions?").arg(s)) == QMessageBox::Yes)
            m_api->closePositions(s);
    });

    // Account panel refresh button
    connect(m_account, &AccountPanel::refreshRequested, this, [this]() { m_api->fetchAccount(); });

    // Trades panel (positions / pending / history)
    connect(m_api, &ApiClient::positionsReceived, m_positions, &PositionsPanel::setPositions);
    connect(m_api, &ApiClient::positionsReceived, m_chart,     &WebChartWidget::setPositions);
    connect(m_api, &ApiClient::ordersReceived,    m_positions, &PositionsPanel::setOrders);
    connect(m_api, &ApiClient::historyReceived,   m_positions, &PositionsPanel::setHistory);
    connect(m_positions, &PositionsPanel::closeSymbol, this, [this](const QString& s) {
        if (QMessageBox::question(this, tr("Close positions"),
                tr("Close ALL open %1 positions?").arg(s)) == QMessageBox::Yes)
            m_api->closePositions(s);
    });

    // Live stream fan-out
    connect(m_stream, &PriceStream::tickReceived, m_watch,  &WatchlistWidget::updateQuote);
    connect(m_stream, &PriceStream::tickReceived, m_ticket, &OrderTicket::updateQuote);
    connect(m_stream, &PriceStream::statusChanged, this, [this](const QString& s) {
        m_streamStatus->setText(s);
        const bool live = s.startsWith("Live");
        m_hdrConn->setText(QString("●  %1").arg(live ? tr("Live") : s.section(QChar(0x2014), 0, 0).trimmed()));
        m_hdrConn->setStyleSheet(QString("font-size:11px; font-weight:600; padding-left:8px; color:%1;")
            .arg(live ? "#26a269" : "#f59e0b"));
    });
}

void MainWindow::switchAccount(const QString& accountId) {
    if (accountId.isEmpty() || accountId == m_cfg.accountId) return;
    m_cfg.accountId = accountId;
    m_cfg.save();
    m_api->setAccountId(accountId);
    // Reload everything for the newly selected account.
    m_api->fetchAccount();
    m_api->fetchPositions();
    m_api->fetchOrders();
    m_api->fetchHistory();
    setStatus(tr("Switched trading account"));
}

void MainWindow::onSymbolsReceived(const QVector<SymbolSpec>& symbols) {
    m_specs.clear();
    for (const SymbolSpec& s : symbols)
        m_specs.insert(s.symbol, s);

    m_watch->setSymbols(symbols);
    m_chart->setSymbols(symbols);   // feed symbol metadata to the TradingView datafeed
    // Snapshot prices immediately (before first ticks arrive).
    m_api->fetchPrices({});

    setStatus(tr("%1 instruments loaded").arg(symbols.size()));

    // Auto-select a liquid, likely-active symbol so the chart isn't empty on
    // startup (the alphabetical first, e.g. AAPL, is often a closed market).
    if (!symbols.isEmpty()) {
        QString pick = symbols.front().symbol;
        for (const QString& pref : {"EURUSD", "BTCUSD", "XAUUSD", "GBPUSD", "ETHUSD"}) {
            if (m_specs.contains(pref)) { pick = pref; break; }
        }
        m_watch->selectSymbol(pick);   // moves selection -> triggers onSymbolActivated
        onSymbolActivated(pick);
    }
}

void MainWindow::onSymbolActivated(const QString& symbol) {
    if (symbol.isEmpty() || symbol == m_currentSymbol) {
        if (symbol == m_currentSymbol) return;
    }
    m_currentSymbol = symbol;
    if (m_specs.contains(symbol))
        m_ticket->setSymbolSpec(m_specs.value(symbol));
    m_chart->showSymbol(symbol);
}

void MainWindow::onTradeResult(const TradeResult& r) {
    if (r.ok) {
        QString msg;
        if (r.status == "filled")
            msg = tr("✓ %1 %2 %3 lots @ %4")
                    .arg(r.action, r.symbol).arg(r.lots).arg(r.price);
        else if (r.status == "closed")
            msg = tr("✓ Closed %1 %2 position(s), P/L %3")
                    .arg(r.closedCount).arg(r.symbol).arg(r.totalProfit);
        else if (r.status == "no_positions")
            msg = tr("No open %1 positions to close").arg(r.symbol);
        setStatus(msg);
        // Reflect the new state everywhere.
        m_api->fetchAccount();
        m_api->fetchPositions();
        m_api->fetchOrders();
        m_api->fetchHistory();
    } else {
        setStatus(tr("Trade failed: %1").arg(r.message), true);
    }
}

void MainWindow::onApiError(const QString& context, const QString& message) {
    // Auth failure (token expired / invalid) — always surface so the user
    // knows to sign in again, instead of silently showing stale data.
    if (message.contains("expired", Qt::CaseInsensitive)
        || message.contains("Invalid token", Qt::CaseInsensitive)
        || message.contains("Invalid API credentials", Qt::CaseInsensitive)
        || message.contains("Not authenticated", Qt::CaseInsensitive)) {
        setStatus(tr("Session expired — open Settings and sign in again"), true);
        return;
    }
    // The account / trades lists poll every few seconds — a transient network
    // or DNS blip on one poll shouldn't flash a scary error, the next poll
    // recovers. Only surface errors from user-initiated actions (trades).
    if (context.startsWith(tr("Loading positions"))
        || context.startsWith(tr("Loading orders"))
        || context.startsWith(tr("Loading history"))
        || context.startsWith(tr("Loading account"))
        || context.startsWith(tr("Loading prices"))
        || context.startsWith(tr("Loading symbols")))
        return;
    setStatus(tr("%1 — %2").arg(context, message), true);
}

void MainWindow::setStatus(const QString& text, bool error) {
    m_message->setText(text);
    m_message->setStyleSheet(error ? "color:#e01b24;" : "color:#8a8f98;");
}

void MainWindow::openSettings() {
    LoginDialog dlg(m_cfg, this);
    if (dlg.exec() != QDialog::Accepted)
        return;
    m_cfg = dlg.config();
    m_api->setConfig(m_cfg);
    m_stream->setConfig(m_cfg);
    m_stream->stop();
    m_stream->start();
    m_api->fetchSymbols();
    m_api->fetchAccount();
    setStatus(tr("Reconnected with updated settings"));
}
