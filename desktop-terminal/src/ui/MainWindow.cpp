#include "ui/MainWindow.h"
#include "ui/MarketWatch.h"
#include "ui/OrderPanel.h"
#include "ui/PositionsTable.h"
#include "ui/OrdersTable.h"
#include "ui/ChartView.h"
#include "core/Session.h"
#include "net/Api.h"
#include "net/PriceSocket.h"
#include "net/TradeSocket.h"

#include <QComboBox>
#include <QLabel>
#include <QAction>
#include <QToolBar>
#include <QStatusBar>
#include <QDockWidget>
#include <QTabWidget>
#include <QWidget>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QFrame>
#include <QTimer>
#include <QLocale>

#ifndef PROLINE_APP_VERSION
#define PROLINE_APP_VERSION "dev"
#endif

MainWindow::MainWindow(Api *api, Session *session, QWidget *parent)
    : QMainWindow(parent)
    , m_api(api)
    , m_session(session)
{
    setWindowTitle(tr("Proline Terminal  v%1").arg(QStringLiteral(PROLINE_APP_VERSION)));
    resize(1280, 800);
    setDockNestingEnabled(true);

    buildSummaryBar();
    buildDocks();

    // --- sockets ---
    m_priceSocket = new PriceSocket(m_session, this);
    m_tradeSocket = new TradeSocket(m_session, this);
    connect(m_priceSocket, &PriceSocket::tick, m_marketWatch, &MarketWatch::onTick);
    connect(m_priceSocket, &PriceSocket::tick, m_orderPanel, &OrderPanel::onTick);
    connect(m_priceSocket, &PriceSocket::tick, m_chart, &ChartView::onTick);
    connect(m_priceSocket, &PriceSocket::connectionChanged,
            this, &MainWindow::onPriceConnectionChanged);
    connect(m_tradeSocket, &TradeSocket::tradeEvent, this,
            [this](const QString &type, const QJsonObject &) {
        flash(tr("Trade update: %1").arg(type));
        refreshAccountData();
    });

    // Market Watch selection drives the order ticket and the chart.
    connect(m_marketWatch, &MarketWatch::symbolSelected,
            m_orderPanel, &OrderPanel::setSymbol);
    connect(m_marketWatch, &MarketWatch::symbolSelected,
            m_chart, &ChartView::setSymbol);

    // Panel actions -> refresh + status line.
    connect(m_orderPanel, &OrderPanel::orderSubmitted, this,
            [this](bool ok, const QString &msg) {
        flash(msg);
        if (ok) refreshAccountData();
    });
    connect(m_positionsTable, &PositionsTable::refreshRequested,
            this, &MainWindow::refreshAccountData);
    connect(m_positionsTable, &PositionsTable::actionResult, this,
            [this](bool, const QString &m) { flash(m); });
    connect(m_ordersTable, &OrdersTable::refreshRequested,
            this, &MainWindow::refreshAccountData);
    connect(m_ordersTable, &OrdersTable::actionResult, this,
            [this](bool, const QString &m) { flash(m); });

    // --- periodic refresh of the active account (equity/positions/orders) ---
    m_pollTimer = new QTimer(this);
    m_pollTimer->setInterval(1500);
    connect(m_pollTimer, &QTimer::timeout, this, &MainWindow::refreshAccountData);

    reloadAccounts();
    reloadInstruments();
    m_priceSocket->start();
    m_pollTimer->start();
}

void MainWindow::buildSummaryBar()
{
    // Account switcher toolbar.
    auto *tb = addToolBar(tr("Account"));
    tb->setMovable(false);
    tb->addWidget(new QLabel(tr("  Account:  ")));
    m_accountBox = new QComboBox;
    m_accountBox->setMinimumWidth(260);
    tb->addWidget(m_accountBox);
    tb->addSeparator();
    QAction *reload = tb->addAction(tr("Reload accounts"));
    connect(reload, &QAction::triggered, this, &MainWindow::reloadAccounts);
    connect(m_accountBox, &QComboBox::currentIndexChanged,
            this, &MainWindow::onAccountSelected);

    // Metrics bar (added as a second toolbar row).
    addToolBarBreak();
    auto *metrics = addToolBar(tr("Summary"));
    metrics->setMovable(false);
    auto *bar = new QFrame;
    auto *h = new QHBoxLayout(bar);
    h->setContentsMargins(6, 2, 6, 2);
    h->setSpacing(2);
    auto addMetric = [&](const QString &cap, QLabel **out) {
        auto *cell = new QWidget;
        auto *v = new QVBoxLayout(cell);
        v->setContentsMargins(12, 2, 12, 2);
        v->setSpacing(0);
        auto *c = new QLabel(cap);
        c->setStyleSheet(QStringLiteral("color:#8a93a6;font-size:11px;"));
        auto *val = new QLabel(QStringLiteral("—"));
        val->setStyleSheet(QStringLiteral("font-size:15px;font-weight:600;"));
        v->addWidget(c);
        v->addWidget(val);
        *out = val;
        h->addWidget(cell);
    };
    addMetric(tr("Balance"), &m_balance);
    addMetric(tr("Equity"), &m_equity);
    addMetric(tr("Margin"), &m_margin);
    addMetric(tr("Free margin"), &m_freeMargin);
    addMetric(tr("Margin level"), &m_marginLevel);
    addMetric(tr("Floating PnL"), &m_pnl);
    addMetric(tr("Leverage"), &m_leverage);
    h->addStretch();
    metrics->addWidget(bar);

    m_connState = new QLabel(tr("● price feed: connecting…"));
    m_connState->setStyleSheet(QStringLiteral("color:#8a93a6;"));
    statusBar()->addPermanentWidget(m_connState);
    statusBar()->showMessage(tr("Connected to %1").arg(m_session->apiBase()));
}

void MainWindow::buildDocks()
{
    m_marketWatch = new MarketWatch;
    m_orderPanel = new OrderPanel(m_api, m_session);
    m_positionsTable = new PositionsTable(m_api);
    m_ordersTable = new OrdersTable(m_api);

    auto makeDock = [this](const QString &title, QWidget *w,
                           Qt::DockWidgetArea area) {
        auto *dock = new QDockWidget(title, this);
        dock->setWidget(w);
        dock->setFeatures(QDockWidget::DockWidgetMovable |
                          QDockWidget::DockWidgetFloatable);
        addDockWidget(area, dock);
        return dock;
    };

    makeDock(tr("Market Watch"), m_marketWatch, Qt::LeftDockWidgetArea);
    makeDock(tr("Order"), m_orderPanel, Qt::RightDockWidgetArea);
    auto *posDock = makeDock(tr("Positions"), m_positionsTable, Qt::BottomDockWidgetArea);
    auto *ordDock = makeDock(tr("Pending orders"), m_ordersTable, Qt::BottomDockWidgetArea);
    tabifyDockWidget(posDock, ordDock);
    posDock->raise();

    // Central area: candlestick chart for the active symbol.
    m_chart = new ChartView(m_api);
    setCentralWidget(m_chart);
}

void MainWindow::reloadAccounts()
{
    m_api->fetchAccounts([this](bool ok, const QList<Account> &accounts,
                                const QString &error) {
        if (!ok) {
            flash(tr("Failed to load accounts: %1").arg(error));
            return;
        }
        m_accounts = accounts;
        m_accountBox->blockSignals(true);
        m_accountBox->clear();
        for (const Account &a : m_accounts)
            m_accountBox->addItem(a.label(), a.id);
        m_accountBox->blockSignals(false);
        if (!m_accounts.isEmpty()) {
            m_accountBox->setCurrentIndex(0);
            onAccountSelected(0);
        }
        statusBar()->showMessage(
            tr("Connected to %1  ·  %2 account(s)")
                .arg(m_session->apiBase()).arg(m_accounts.size()));
    });
}

void MainWindow::reloadInstruments()
{
    m_api->fetchInstruments([this](bool ok, const QList<Instrument> &instruments,
                                   const QString &error) {
        if (!ok) {
            flash(tr("Failed to load instruments: %1").arg(error));
            return;
        }
        m_marketWatch->setInstruments(instruments);
        m_orderPanel->setInstruments(instruments);
    });
}

void MainWindow::onAccountSelected(int index)
{
    if (index < 0 || index >= m_accounts.size())
        return;
    const Account &a = m_accounts.at(index);
    m_currency = a.currency;
    m_leverageVal = a.leverage;
    m_leverage->setText(QStringLiteral("1:%1").arg(a.leverage));
    m_session->setAccountId(a.id);
    m_tradeSocket->bind(a.id);
    refreshAccountData();
}

void MainWindow::refreshAccountData()
{
    const QString id = m_session->accountId();
    if (id.isEmpty())
        return;

    m_api->fetchAccountSummary(id, [this](bool ok, const AccountSummary &s,
                                          const QString &) {
        if (ok) updateSummary(s);
    });
    m_api->fetchPositions(id, [this](bool ok, const QList<Position> &positions,
                                     const QString &) {
        if (ok) m_positionsTable->setPositions(positions);
    });
    m_api->fetchPendingOrders(id, [this](bool ok, const QList<Order> &orders,
                                         const QString &) {
        if (ok) m_ordersTable->setOrders(orders);
    });
}

void MainWindow::updateSummary(const AccountSummary &s)
{
    const QLocale loc;
    auto money = [&](double v) {
        return loc.toString(v, 'f', 2) + QLatin1Char(' ') + m_currency;
    };
    m_balance->setText(money(s.balance));
    m_equity->setText(money(s.equity));
    m_margin->setText(money(s.marginUsed));
    m_freeMargin->setText(money(s.freeMargin));
    m_marginLevel->setText(s.marginUsed > 0
                               ? loc.toString(s.marginLevel, 'f', 1) + QStringLiteral("%")
                               : QStringLiteral("—"));
    m_pnl->setText(money(s.unrealizedPnl));
    m_pnl->setStyleSheet(s.unrealizedPnl >= 0
        ? QStringLiteral("font-size:15px;font-weight:600;color:#2ea043;")
        : QStringLiteral("font-size:15px;font-weight:600;color:#e5484d;"));
}

void MainWindow::onPriceConnectionChanged(bool connected)
{
    if (!m_connState)
        return;
    m_connState->setText(connected ? tr("● price feed: live")
                                   : tr("● price feed: reconnecting…"));
    m_connState->setStyleSheet(connected ? QStringLiteral("color:#2ea043;")
                                         : QStringLiteral("color:#e5484d;"));
}

void MainWindow::flash(const QString &message)
{
    statusBar()->showMessage(message, 6000);
}
