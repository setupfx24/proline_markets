#include "ui/MainWindow.h"
#include "ui/WatchlistWidget.h"
#include "ui/WebChartWidget.h"
#include "ui/ChartArea.h"
#include "ui/OrderTicket.h"
#include "ui/AccountPanel.h"
#include "ui/PositionsPanel.h"
#include "ui/ClosePositionDialog.h"
#include "ui/ModifyBracketsDialog.h"
#include "ui/OrderDialog.h"
#include "ui/EditOrderDialog.h"
#include "ui/LoginDialog.h"
#include "ui/WalletDialog.h"
#include "core/ApiClient.h"
#include "core/PriceStream.h"

#include <QSplitter>
#include <QStatusBar>
#include <QMenuBar>
#include <QMenu>
#include <QAction>
#include <QActionGroup>
#include <QLabel>
#include <QTimer>
#include <QMessageBox>
#include <QApplication>
#include <QPushButton>
#include <QDesktopServices>
#include <QDir>
#include <QFileInfo>
#include <QProcess>
#include <QSettings>
#include <QUrlQuery>
#include <QUrl>
#include <QClipboard>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QFrame>
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>
#include <QFile>
#include "ui/Theme.h"
#include "ui/Toast.h"

static const char* MASK = "••••••";

MainWindow::MainWindow(const Config& cfg, QWidget* parent)
    : QMainWindow(parent), m_cfg(cfg) {
    setWindowTitle(tr("Proline Markets Terminal"));
    setMinimumSize(980, 600);
    resize(1360, 840);

    m_api    = new ApiClient(m_cfg, this);
    m_stream = new PriceStream(m_cfg, this);

    // --- widgets ---
    m_watch     = new WatchlistWidget;
    // Restored before the symbol list arrives: setSymbols() paints the star in
    // as it builds each row, so the widget has to know the list by then.
    m_watch->setFavourites(m_cfg.favourites);
    m_charts    = new ChartArea(m_api, m_stream);        // 1/2/4 TradingView panes
    m_ticket    = new OrderTicket;
    m_account   = new AccountPanel;
    m_positions = new PositionsPanel;

    m_account->setPrivacy(m_cfg.privacy);
    m_positions->setPrivacy(m_cfg.privacy);

    // The one-click strip floats in the chart's toolbar band, in the gap
    // between TradingView's Indicators/undo controls and its icon cluster.
    m_charts->setOverlayWidget(m_ticket);

    // ── blotter + the account line beneath it ──
    auto* bottom = new QWidget;
    auto* bl = new QVBoxLayout(bottom);
    bl->setContentsMargins(0, 0, 0, 0);
    bl->setSpacing(0);
    bl->addWidget(m_positions, 1);
    bl->addWidget(m_account);

    // ── centre column: chart over blotter ──
    m_centerSplit = new QSplitter(Qt::Vertical);
    m_centerSplit->addWidget(m_charts);
    m_centerSplit->addWidget(bottom);
    // Without explicit floors the web view reports a very large minimum width,
    // the outer splitter can no longer shrink this column, and the market watch
    // gets squeezed off the left edge.
    m_charts->setMinimumWidth(320);
    bottom->setMinimumWidth(320);
    // A floor, not a preference: the first sizing pass runs before the window
    // has a real height, and without this the blotter was handed 0px and the
    // chart simply swallowed the whole column.
    bottom->setMinimumHeight(150);
    m_charts->setMinimumHeight(200);
    m_centerSplit->setMinimumWidth(320);
    m_centerSplit->setStretchFactor(0, 1);   // chart takes the extra space
    m_centerSplit->setStretchFactor(1, 0);
    m_centerSplit->setCollapsible(0, false);
    m_centerSplit->setCollapsible(1, false);

    // ── main split: market watch | centre column ──
    m_watch->setMinimumWidth(210);
    auto* body = new QSplitter(Qt::Horizontal);
    body->addWidget(m_watch);
    body->addWidget(m_centerSplit);
    body->setStretchFactor(0, 0);
    body->setStretchFactor(1, 1);
    body->setCollapsible(0, false);
    body->setCollapsible(1, false);
    // 300, not 330. The watch's three fixed columns take 232 of it and Spread
    // stretches into what is left, so trimming the panel is what narrows the
    // Spread column — and the 30px goes to the chart, which is the thing a
    // trader is actually looking at.
    body->setSizes({300, 1030});
    setCentralWidget(body);

    // Give the blotter a sensible starting height once the window is really
    // sized. Guard the height: on the first pass it can still be 0, and
    // {0-200, 200} is not a meaningful split.
    QTimer::singleShot(0, this, [this]() {
        const int h = m_centerSplit->height();
        if (h > 400) m_centerSplit->setSizes({h - 200, 200});
    });

    buildMenuBar();

    // --- status bar ---
    // Transient messages only (trade results, errors, connection trouble). The
    // permanent stream-status label that used to sit bottom-left is gone.
    m_message = new QLabel;
    statusBar()->addPermanentWidget(m_message);

    connectServices();
    applyTheme();
    connect(Theme::notifier(), &Theme::Notifier::changed, this, &MainWindow::applyTheme);

    // Kick off: symbols + account, then start the live stream.
    refreshAll();
    m_api->fetchSymbols();
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

    // Keep the access token alive. It lasts ~45 minutes and every /api/v1 call
    // — per-position close, SL/TP, the whole wallet — dies with it, so this
    // runs well inside that window rather than waiting for a trader to meet
    // "Invalid token" halfway through closing a position.
    //
    // Also fired once now: a terminal reopened the next morning starts with a
    // token that expired overnight, and nothing would have noticed until the
    // first action failed.
    m_sessionTimer = new QTimer(this);
    m_sessionTimer->setInterval(30 * 60 * 1000);
    connect(m_sessionTimer, &QTimer::timeout, this, [this]() { m_api->refreshSession(); });
    applySessionRenewal();
    if (!m_cfg.refreshToken.trimmed().isEmpty()) m_api->refreshSession();
}

// --- menu bar ---------------------------------------------------------------

void MainWindow::buildMenuBar() {
    QMenuBar* bar = menuBar();

#ifdef Q_OS_MACOS
    // Keep the menu bar inside the window on macOS rather than promoting it to
    // the system bar at the top of the screen. Apple's global menu bar cannot
    // host corner widgets, and the identity line ("Name | Account number") is
    // exactly that — a TopLeftCorner widget — so going native would silently
    // delete it. It also keeps the terminal reading identically on both
    // platforms, which matters when a trader sends a support screenshot.
    bar->setNativeMenuBar(false);
#endif

    // ── File ──
    QMenu* file = bar->addMenu(tr("&File"));
    connect(file->addAction(tr("&Settings…")), &QAction::triggered,
            this, &MainWindow::openSettings);
    connect(file->addAction(tr("&Refresh")), &QAction::triggered,
            this, &MainWindow::refreshAll);
    file->addSeparator();
    connect(file->addAction(tr("&Log out")), &QAction::triggered,
            this, &MainWindow::logout);
    connect(file->addAction(tr("E&xit")), &QAction::triggered,
            qApp, &QApplication::quit);

    // ── Trade ──
    QMenu* trade = bar->addMenu(tr("&Trade"));
    QAction* order = trade->addAction(tr("&New order…"));
    // F9 is the order-window key in MT4/MT5; traders coming from either reach
    // for it before they look at the menu bar. Ctrl+P stays as the shortcut
    // that used to open the pending-only dialog, so existing muscle memory
    // still lands somewhere sensible.
    order->setShortcuts({QKeySequence(Qt::Key_F9),
                         QKeySequence(QStringLiteral("Ctrl+P"))});
    connect(order, &QAction::triggered, this, &MainWindow::openOrderWindow);

    // ── Accounts — rebuilt each time it opens, so a fresh sign-in shows up ──
    m_accountsMenu = bar->addMenu(tr("&Accounts"));
    connect(m_accountsMenu, &QMenu::aboutToShow, this, &MainWindow::rebuildAccountsMenu);

    // ── View ──
    QMenu* view = bar->addMenu(tr("&View"));
    m_darkAction = view->addAction(tr("&Dark theme"));
    m_darkAction->setCheckable(true);
    m_darkAction->setChecked(Theme::isDark());
    connect(m_darkAction, &QAction::triggered, this, &MainWindow::toggleTheme);

    m_privacyAction = view->addAction(tr("&Hide balances"));
    m_privacyAction->setCheckable(true);
    m_privacyAction->setChecked(m_cfg.privacy);
    connect(m_privacyAction, &QAction::triggered, this, &MainWindow::togglePrivacy);

    // ── chart layout: 1 / 2 / 4 panes ──
    view->addSeparator();
    QMenu* layout = view->addMenu(tr("&Chart layout"));
    m_layoutGroup = new QActionGroup(this);
    m_layoutGroup->setExclusive(true);
    struct { const char* text; int count; } modes[] = {
        {QT_TR_NOOP("&1 chart"),           1},
        {QT_TR_NOOP("&2 charts (side by side)"), 2},
        {QT_TR_NOOP("&4 charts (2 x 2)"),  4},
    };
    for (const auto& m : modes) {
        QAction* a = layout->addAction(tr(m.text));
        a->setCheckable(true);
        a->setChecked(m.count == 1);
        a->setData(m.count);
        m_layoutGroup->addAction(a);
        connect(a, &QAction::triggered, this, [this, c = m.count]() {
            m_charts->setChartCount(c);
            // Extra panes are useless in a sliver of height; give the charts
            // room back from the blotter when the grid grows.
            if (c > 1 && m_centerSplit->height() > 500)
                m_centerSplit->setSizes({m_centerSplit->height() - 170, 170});
        });
    }

    // Closing a pane with its ✕ changes the count behind the menu's back, so
    // mirror it here. A close out of 2x2 lands on 3, which no menu entry
    // represents — in that case leave the whole group unchecked rather than
    // showing a count the user is not actually on. QActionGroup refuses to
    // clear an exclusive group, hence the temporary toggle.
    connect(m_charts, &ChartArea::chartCountChanged, this, [this](int count) {
        if (!m_layoutGroup) return;
        m_layoutGroup->setExclusive(false);
        for (QAction* a : m_layoutGroup->actions())
            a->setChecked(a->data().toInt() == count);
        m_layoutGroup->setExclusive(true);
    });

    view->addSeparator();
    m_bloterAction = view->addAction(tr("Show &trade panel"));
    m_bloterAction->setCheckable(true);
    m_bloterAction->setChecked(true);
    connect(m_bloterAction, &QAction::triggered, this, [this](bool on) {
        m_positions->setCollapsed(!on);
        const int h = m_centerSplit->height();
        m_centerSplit->setSizes(on ? QList<int>{h - 200, 200} : QList<int>{h, 1});
    });

    // ── "Web Terminal" in the empty stretch of the menu row ──
    // It rides in the TopRightCorner slot. Inline placement right after "View"
    // was tried first, via a QWidgetAction: QMenuBar accepts one, but under the
    // global style sheet it lays the item out with no width at all, so the row
    // showed the item's divider and nothing else. A corner widget is the slot
    // this menu bar actually honours — the identity block on the left proves it.
    m_chipBox = new QWidget;
    auto* cw = new QHBoxLayout(m_chipBox);
    cw->setContentsMargins(8, 2, 10, 2);
    cw->setSpacing(8);

    m_webChip = new QPushButton(tr("Web Terminal"));
    m_webChip->setCursor(Qt::PointingHandCursor);
    m_webChip->setFocusPolicy(Qt::NoFocus);   // a menu-row control, not a form field
    connect(m_webChip, &QPushButton::clicked, this, &MainWindow::openWebTerminal);
    cw->addWidget(m_webChip);

    bar->setCornerWidget(m_chipBox, Qt::TopRightCorner);
    updateMenuChips();   // also sizes the box — see the note there

    // ── who you are trading as, at the far left of the menu row ──
    // A TopLeftCorner widget is laid out before the menu items, so this reads
    // "Name | Type | Account   File  Accounts  View". The brand mark already
    // sits in the window title bar, so it is not repeated here.
    auto* leftBlock = new QWidget;
    auto* lb = new QHBoxLayout(leftBlock);
    lb->setContentsMargins(10, 0, 12, 0);
    lb->setSpacing(0);
    m_identity = new QLabel;
    lb->addWidget(m_identity);

    // Matching hairline between the identity and the first menu entry. A QFrame
    // is used rather than a border on leftBlock because a plain container
    // styled through the global sheet does not reliably paint its own border.
    m_identityDivider = new QFrame;
    m_identityDivider->setFrameShape(QFrame::VLine);
    // Text-height, not row-height: it should read like the "|" already sitting
    // between the name and the account number, not like a table rule.
    m_identityDivider->setFixedSize(1, 14);
    lb->addWidget(m_identityDivider, 0, Qt::AlignVCenter);

    bar->setCornerWidget(leftBlock, Qt::TopLeftCorner);

    // No sign-out button in the menu row — signing out lives in File -> Log out.
}

void MainWindow::rebuildAccountsMenu() {
    m_accountsMenu->clear();
    const QJsonArray accts = QJsonDocument::fromJson(m_cfg.accountsJson.toUtf8()).array();
    if (accts.isEmpty()) {
        connect(m_accountsMenu->addAction(tr("Sign in to switch accounts…")),
                &QAction::triggered, this, &MainWindow::openSettings);
    } else {
        for (const QJsonValue& v : accts) {
            const QJsonObject o = v.toObject();
            const QString id  = o.value("account_id").toString();
            const QString num = m_cfg.privacy ? QString::fromUtf8(MASK)
                                              : o.value("account_number").toString();
            QAction* a = m_accountsMenu->addAction(
                QString("%1  ·  %2").arg(num, o.value("is_demo").toBool() ? tr("DEMO")
                                                                          : tr("LIVE")));
            a->setCheckable(true);
            a->setChecked(id == m_cfg.accountId);
            connect(a, &QAction::triggered, this, [this, id]() { switchAccount(id); });
        }
    }
    m_accountsMenu->addSeparator();
    connect(m_accountsMenu->addAction(tr("&Wallet…")), &QAction::triggered, this, [this]() {
        WalletDialog dlg(m_cfg, this);
        // The dialog raises its own toast while it is open. Repeat the result
        // here once it closes: the balances on screen have just jumped and the
        // trader needs to see why, with the line left in the status bar as the
        // record after the toast fades.
        QString done;
        connect(&dlg, &WalletDialog::transferred, this,
                [this, &done](bool toWallet, double amount, const QString& account) {
            const QString money = QString("$%L1").arg(amount, 0, 'f', 2);
            done = toWallet
                ? tr("%1 moved from %2 to your main wallet").arg(money, account)
                : tr("%1 moved from your main wallet to %2").arg(money, account);
            m_api->fetchAccount();
        });
        dlg.exec();
        if (!done.isEmpty()) {
            setStatus(tr("✓ %1").arg(done), false);
            Toast::success(this, tr("Transfer complete"), done);
        }
    });
}

// --- theme / privacy --------------------------------------------------------

void MainWindow::applyTheme() {
    updateIdentity();
    updateMenuChips();
    setStatus(m_message->text(), false);
    if (m_darkAction) m_darkAction->setChecked(Theme::isDark());
    if (m_identityDivider)
        m_identityDivider->setStyleSheet(
            QString("background:%1; border:none;").arg(Theme::p().border));
}

void MainWindow::toggleTheme() {
    Theme::setMode(Theme::isDark() ? Theme::Mode::Light : Theme::Mode::Dark);
    m_cfg.theme = Theme::name();
    m_cfg.save();
    m_charts->setTheme(Theme::name());    // TradingView + the position overlay
}

void MainWindow::togglePrivacy() {
    m_cfg.privacy = !m_cfg.privacy;
    m_cfg.save();
    if (m_privacyAction) m_privacyAction->setChecked(m_cfg.privacy);
    m_account->setPrivacy(m_cfg.privacy);
    m_positions->setPrivacy(m_cfg.privacy);
    updateIdentity();
    setStatus(m_cfg.privacy ? tr("Balances hidden") : tr("Balances visible"));
}

QString MainWindow::money(double v, const QString& currency) const {
    if (m_cfg.privacy) return QString::fromUtf8(MASK);
    QString s = QString("%L1").arg(v, 0, 'f', 2);
    if (!currency.isEmpty()) s += " " + currency;
    return s;
}

// "Name | Type | Account number", shown beside the logo at the left of the
// menu row. The account number is masked in privacy mode; the name is not,
// since it is not a credential.
void MainWindow::updateMenuChips() {
    if (!m_webChip) return;
    const auto& c = Theme::p();

    m_webChip->setToolTip(tr("Open this account in the browser terminal"));
    m_webChip->setStyleSheet(QString(
        "QPushButton { background:%1; color:#ffffff; border:1px solid %1;"
        " border-radius:4px; font-size:11px; font-weight:600; }"
        "QPushButton:hover { background:%2; border-color:%2; }")
        .arg(c.accent, c.accentHover));

    // Sized by hand, for the same reason the identity label is: a menu-bar
    // corner widget is given exactly its size hint, and the hint a styled button
    // reports before the bar is shown is not trustworthy.
    const int h = 22;
    const int webW = m_webChip->fontMetrics().horizontalAdvance(m_webChip->text()) + 28;
    m_webChip->setFixedSize(webW, h);
    const QMargins m = m_chipBox->layout()->contentsMargins();
    m_chipBox->setFixedSize(m.left() + webW + m.right(), h + m.top() + m.bottom());
}

// Hand the trader over to the browser terminal, on the account this window is
// already trading — and signed in, without asking for the password again.
//
// The desktop's JWT is not a browser cookie, so /auth/desktop trades it for a
// real web session on arrival. The token rides in the URL FRAGMENT, never the
// query string: a fragment is not sent to the server, so it cannot land in an
// access log or a Referer header, and the page strips it from the address bar
// before its first await. With no token there is nothing to hand over, so the
// plain terminal URL is used and the web login page does its job.
void MainWindow::openWebTerminal() {
    QString base = m_cfg.webBase.trimmed();
    if (base.isEmpty()) base = QStringLiteral("https://trade.prolinemarket.com");
    while (base.endsWith('/')) base.chop(1);

    const QString acct  = m_cfg.accountId.trimmed();
    const QString token = m_cfg.token.trimmed();

    QUrl url;
    if (!token.isEmpty()) {
        QString frag = "token=" + token;
        if (!acct.isEmpty()) frag += "&account=" + acct;
        url = QUrl(base + "/auth/desktop");
        url.setFragment(frag);
    } else {
        url = QUrl(base + (acct.isEmpty() ? "/trading" : "/trading/terminal"));
        if (!acct.isEmpty()) {
            QUrlQuery q;
            q.addQueryItem("account", acct);
            url.setQuery(q);
        }
    }

#ifdef Q_OS_WIN
    // Chrome by preference. The web terminal is built and tested against it,
    // and the handoff below relies on the browser keeping the URL fragment
    // through a client-side redirect — behaviour that is not uniform across
    // browsers. This is a preference, not a requirement: if Chrome is not
    // installed the system default still gets the link, because failing to
    // open anything would be worse than opening it somewhere untested.
    QString chrome = QSettings(
        QStringLiteral("HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe"),
        QSettings::NativeFormat).value(QStringLiteral(".")).toString();
    if (chrome.isEmpty() || !QFileInfo::exists(chrome)) {
        for (const QString& candidate : {
                 QStringLiteral("C:/Program Files/Google/Chrome/Application/chrome.exe"),
                 QStringLiteral("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
                 QDir::homePath() + "/AppData/Local/Google/Chrome/Application/chrome.exe" }) {
            if (QFileInfo::exists(candidate)) { chrome = candidate; break; }
        }
    }
    if (!chrome.isEmpty() && QFileInfo::exists(chrome)
        && QProcess::startDetached(chrome, {url.toString(QUrl::FullyEncoded)})) {
        setStatus(tr("Opened the web terminal in Chrome"));
        return;
    }
#endif

    if (QDesktopServices::openUrl(url))
        setStatus(tr("Opened the web terminal in your browser"));
    else
        setStatus(tr("Could not open the web terminal"), true);
}

void MainWindow::updateIdentity() {
    if (!m_identity) return;
    const auto& c = Theme::p();

    // userName is the display name from the login response; fall back to the
    // address signed in with. An API-key sign-in has neither, so the account
    // number stands alone rather than being labelled "Not signed in".
    QString name = m_cfg.userName.trimmed();
    if (name.isEmpty()) name = m_cfg.email.trimmed();

    const QString acct = m_lastAccount.valid
        ? (m_cfg.privacy ? QString::fromUtf8(MASK) : m_lastAccount.account)
        : tr("—");

    const QString sep = QString("<span style='color:%1;'> &nbsp;|&nbsp; </span>").arg(c.dim);
    if (name.isEmpty())
        m_identity->setText(QString("<span style='color:%1;font-weight:600;'>%2</span>")
                            .arg(c.textStrong, acct));
    else
        m_identity->setText(QString("<span style='color:%1;font-weight:600;'>%2</span>%3"
                                    "<span style='color:%4;'>%5</span>")
                            .arg(c.textStrong, name, sep, c.text, acct));
    m_identity->setStyleSheet("background:transparent; font-size:11px;");
    // A menu-bar corner widget gets exactly its sizeHint, and a QLabel's hint
    // for rich text is unreliable right after setText, so the line used to get
    // clipped. Size it from the plain equivalent's font metrics, with real
    // headroom — the bold segment renders wider than those metrics suggest.
    const QString plain = name.isEmpty() ? acct : QString("%1  |  %2").arg(name, acct);
    m_identity->setFixedWidth(m_identity->fontMetrics().horizontalAdvance(plain) + 52);
}

// --- wiring -----------------------------------------------------------------

void MainWindow::refreshAll() {
    m_api->fetchAccount();
    m_api->fetchPositions();
    m_api->fetchOrders();
    m_api->fetchHistory();
    m_api->fetchTransactions();
}

void MainWindow::connectServices() {
    // REST responses
    connect(m_api, &ApiClient::symbolsReceived, this, &MainWindow::onSymbolsReceived);
    connect(m_api, &ApiClient::accountReceived, m_account, &AccountPanel::setAccount);
    // The blotter takes it too, for the closing balance in the History summary.
    connect(m_api, &ApiClient::accountReceived, m_positions, &PositionsPanel::setAccount);
    connect(m_api, &ApiClient::accountReceived, this, [this](const AccountInfo& a) {
        if (!a.valid) return;
        setStatus(QString());   // a good poll clears any stale transient error
        m_lastAccount = a;
        updateIdentity();
    });
    connect(m_api, &ApiClient::tradeResult,     this, &MainWindow::onTradeResult);
    connect(m_api, &ApiClient::errorOccurred,   this, &MainWindow::onApiError);
    connect(m_api, &ApiClient::pricesReceived,  this, [this](const QVector<Quote>& qs) {
        // The REST snapshot must reach the strip too, not just the watch list.
        // Without it the SELL/BUY tiles sat on "—" until the symbol happened to
        // tick — which on a quiet or closed market could be a long wait.
        for (const Quote& q : qs) {
            m_watch->updateQuote(q);
            m_ticket->updateQuote(q);
        }
    });

    // Market watch selection
    connect(m_watch, &WatchlistWidget::symbolActivated, this, &MainWindow::onSymbolActivated);
    // Clicking a chart pane makes it active — the strip and the order window
    // must follow it, not stay on whatever Market Watch last selected.
    connect(m_charts, &ChartArea::activeChartChanged, this, &MainWindow::onActiveChartChanged);
    // Grid changed (menu or a pane's ✕) — remember it for the next launch.
    connect(m_charts, &ChartArea::chartCountChanged, this,
            [this](int) { persistChartLayout(); });
    // Double-click a symbol -> order window on that symbol. onSymbolActivated
    // has already run from the selection change, so m_currentSymbol is the
    // row that was double-clicked by the time this fires.
    // Starred instruments are a local view preference, so they are saved the
    // moment they change rather than only on a clean exit — the terminal is
    // routinely killed with the window ✕.
    connect(m_watch, &WatchlistWidget::favouritesChanged, this,
            [this](const QStringList& favs) {
        m_cfg.favourites = favs;
        m_cfg.save();
    });
    connect(m_watch, &WatchlistWidget::symbolDoubleClicked, this,
            [this](const QString& s) { onSymbolActivated(s); openOrderWindow(); });

    // The chart (TradingView) pulls bars + ticks itself via the ChartBridge,
    // so no bars/tick wiring is needed here for it.

    // One-click strip -> trade endpoints
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

    // Account line refresh button
    connect(m_account, &AccountPanel::refreshRequested, this, [this]() { m_api->fetchAccount(); });

    // Blotter (positions / pending / history)
    // A refresh hands back BOTH a new access token and a replacement refresh
    // cookie, and the old refresh token is dead the moment it does. Persist
    // immediately: losing the replacement means the next refresh 401s and the
    // session quietly expires anyway.
    connect(m_api, &ApiClient::sessionRefreshed, this,
            [this](const QString& access, const QString& refresh) {
        m_cfg.token = access;
        if (!refresh.isEmpty()) m_cfg.refreshToken = refresh;
        m_cfg.save();
        m_api->setConfig(m_cfg);
        if (m_authRecoveryTried) {
            m_authRecoveryTried = false;
            setStatus(QString());
            refreshAll();
        }
    });
    connect(m_api, &ApiClient::sessionRefreshFailed, this, [this](const QString& msg) {
        // Not fatal on its own — trading runs on the algo key, which does not
        // expire. Only the /api/v1 surface is affected, so say what is lost
        // rather than throwing the user back to the sign-in card.
        m_cfg.refreshToken.clear();
        m_cfg.save();
        m_sessionTimer->stop();
        setStatus(tr("Session could not be renewed (%1). Sign in again to close "
                     "positions or use the wallet.").arg(msg), true);
    });

    // Floating P/L is summed from the same snapshot the blotter draws rather
    // than derived from equity-minus-balance: those two come from different
    // reads and drift apart between polls, which shows up as a status strip
    // disagreeing with the Profit column right above it.
    connect(m_api, &ApiClient::positionsReceived, this,
            [this](const QVector<OpenPosition>& ps) {
        double pl = 0.0;
        for (const OpenPosition& p : ps) pl += p.profit;
        m_account->setFloatingPL(pl, ps.size());
    });
    connect(m_api, &ApiClient::positionsReceived, m_positions, &PositionsPanel::setPositions);
    connect(m_api, &ApiClient::positionsReceived, m_charts,    &ChartArea::setPositions);
    connect(m_api, &ApiClient::ordersReceived,    m_positions, &PositionsPanel::setOrders);
    connect(m_api, &ApiClient::historyReceived,   m_positions, &PositionsPanel::setHistory);
    connect(m_api, &ApiClient::transactionsReceived, m_positions, &PositionsPanel::setTransactions);
    // One row's ✕ closes THAT position. The symbol-wide close lives on the
    // one-click strip above, and is the only thing that should ever close more
    // than the trader pointed at.
    connect(m_positions, &PositionsPanel::closePosition, this,
            [this](const OpenPosition& pos) {
        const QString sym = pos.symbol;
        // Never silently falls back to the symbol-wide close — that was the
        // bug this replaced.
        if (!requireSession(tr("Closing a single position"))) return;
        // Lot step / minimum come from the instrument spec so the dialog cannot
        // offer a slice the venue would reject.
        const SymbolSpec spec = m_specs.value(sym);
        ClosePositionDialog dlg(pos, spec.lotStep, spec.minLot, this);
        if (dlg.exec() != QDialog::Accepted) return;
        // A full close sends no lots at all — see ApiClient::closePositionById.
        m_api->closePositionById(pos.id, dlg.isFullClose() ? 0.0 : dlg.lotsToClose());
    });

    // Share a trade: mint the public card, then put the link on the clipboard.
    // The clipboard IS the feature — a dialog that only displays a URL makes
    // the user select and copy it by hand, which on a 40-character link is
    // exactly where it gets truncated.
    connect(m_positions, &PositionsPanel::sharePosition, this,
            [this](const OpenPosition& pos) {
        if (!requireSession(tr("Sharing a trade"))) return;
        setStatus(tr("Preparing share link…"));
        m_api->shareTrade(pos.id);
    });
    connect(m_api, &ApiClient::shareLinkReady, this,
            [this](const QString&, bool ok, const QString& code, const QString& message) {
        if (!ok) {
            setStatus(tr("Could not create the share link: %1").arg(message), true);
            return;
        }
        QString base = m_cfg.webBase.trimmed();
        if (base.isEmpty()) base = QStringLiteral("https://trade.prolinemarket.com");
        while (base.endsWith('/')) base.chop(1);
        const QString url = base + "/s/" + code;

        QApplication::clipboard()->setText(url);
        setStatus(tr("Share link copied"));

        QMessageBox box(this);
        box.setIcon(QMessageBox::Information);
        box.setWindowTitle(tr("Share trade"));
        box.setText(tr("The link is on your clipboard."));
        box.setInformativeText(url);
        box.setStandardButtons(QMessageBox::Ok);
        auto* open = box.addButton(tr("Open in browser"), QMessageBox::ActionRole);
        box.exec();
        if (box.clickedButton() == open) QDesktopServices::openUrl(QUrl(url));
    });

    // Close all / close the winners / close the losers. Every one of these can
    // shut a whole book in one click, so it always confirms and always names
    // the exact set and its combined P/L — "Close all" with no number in front
    // of it is how someone closes six positions meaning to close one.
    connect(m_positions, &PositionsPanel::closeBatch, this,
            [this](const QVector<OpenPosition>& batch, const QString& what) {
        if (batch.isEmpty()) return;
        if (!requireSession(tr("Closing positions"))) return;

        double pnl = 0;
        for (const OpenPosition& p : batch) pnl += p.profit;
        const QString sign = pnl >= 0 ? "+" : "";

        QMessageBox box(this);
        box.setIcon(QMessageBox::Question);
        box.setWindowTitle(tr("Close positions"));
        box.setText(tr("Close %1 at market?").arg(what));
        box.setInformativeText(tr("Combined P/L right now is %1%2. Each position closes at "
                                  "the price available when its order lands, so the realised "
                                  "figure will differ.")
                               .arg(sign, money(pnl, m_lastAccount.currency)));
        box.setStandardButtons(QMessageBox::Yes | QMessageBox::Cancel);
        box.setDefaultButton(QMessageBox::Cancel);   // never the destructive one
        if (box.exec() != QMessageBox::Yes) return;

        // Full close each — no lots argument. Sent as separate requests because
        // that is the only close endpoint there is; they are independent, so one
        // rejection does not strand the rest.
        for (const OpenPosition& p : batch) m_api->closePositionById(p.id, 0.0);
        setStatus(tr("Closing %1…").arg(what));
    });

    // S/L and T/P were display-only in the blotter: the columns showed the
    // levels and only a chart-line drag could change them, which is what the
    // "S/L and T/P not changing" report was about.
    connect(m_positions, &PositionsPanel::modifyBrackets, this,
            [this](const OpenPosition& pos) {
        if (!requireSession(tr("Modifying stop loss / take profit"))) return;
        const SymbolSpec spec = m_specs.value(pos.symbol);
        ModifyBracketsDialog dlg(pos, spec.digits > 0 ? spec.digits : 5, this);
        if (dlg.exec() != QDialog::Accepted) return;
        // One call per leg, and only for legs the user touched — the endpoint
        // patches, so sending an untouched level from a 4s-old snapshot could
        // overwrite one the server has already moved.
        if (dlg.slChanged()) m_api->modifyBracket(pos.id, "sl", dlg.stopLoss());
        if (dlg.tpChanged()) m_api->modifyBracket(pos.id, "tp", dlg.takeProfit());
    });

    // Typed straight into the S/L or T/P cell — the client asked for this over
    // the dialog, and it is one call for the one leg that changed.
    connect(m_positions, &PositionsPanel::bracketEdited, this,
            [this](const QString& id, const QString& kind, double level) {
        if (!requireSession(tr("Modifying stop loss / take profit"))) {
            m_api->fetchPositions();   // put the cell back to the server's value
            return;
        }
        m_api->modifyBracket(id, kind, level);
    });

    // The server's answer is what the cell should end up showing: a rejected
    // level must not be left sitting in the table as though it took.
    connect(m_api, &ApiClient::positionOpResult, this,
            [this](const QString&, const QString& op, bool ok, const QString& msg) {
        if (op != "modify") return;
        setStatus(ok ? tr("S/L — T/P updated") : msg, !ok);
        m_api->fetchPositions();
    });

    connect(m_positions, &PositionsPanel::cancelOrder, this,
            [this](const PendingOrder& o) {
        if (!requireSession(tr("Cancelling a pending order"))) return;
        if (QMessageBox::question(this, tr("Cancel order"),
                tr("Cancel this pending %1 order (%2 lots at %3)?")
                    .arg(o.symbol, QString::number(o.lots, 'f', 2),
                         QString::number(o.price, 'f', m_specs.value(o.symbol).digits))) != QMessageBox::Yes)
            return;
        m_api->cancelOrder(o.id);
    });

    connect(m_positions, &PositionsPanel::modifyOrder, this,
            [this](const PendingOrder& o) {
        if (!requireSession(tr("Modifying a pending order"))) return;
        const SymbolSpec spec = m_specs.value(o.symbol);
        const Quote q = m_lastQuotes.value(o.symbol);
        EditOrderDialog dlg(o, spec, q.bid, q.ask, this);
        if (dlg.exec() != QDialog::Accepted) return;
        // -1 for anything untouched: the endpoint leaves an omitted field
        // alone, and 0 already means "remove the bracket", so the sentinel has
        // to sit outside both.
        m_api->modifyPendingOrder(
            o.id,
            dlg.priceChanged() ? dlg.price()      : -1.0,
            dlg.lotsChanged()  ? dlg.lots()       : -1.0,
            dlg.slChanged()    ? dlg.stopLoss()   : -1.0,
            dlg.tpChanged()    ? dlg.takeProfit() : -1.0);
    });

    // Both order operations end by refetching rather than patching the table:
    // a cancel races the fill engine, and the server's answer is the only
    // truthful one.
    connect(m_api, &ApiClient::orderOpResult, this,
            [this](const QString&, bool ok, const QString& msg) {
        setStatus(msg, !ok);
        m_api->fetchOrders();
        m_api->fetchPositions();
    });

    // A close moves a row from Trade to History, but the 4s poll only refreshes
    // positions and orders — History is otherwise fetched once at startup, so
    // the trade just closed would not appear there until the next restart.
    connect(m_api, &ApiClient::positionOpResult, this,
            [this](const QString&, const QString& op, bool ok, const QString& msg) {
        if (op != "close") return;
        if (!ok) { setStatus(msg, true); return; }
        m_api->fetchPositions();
        m_api->fetchHistory();
    m_api->fetchTransactions();
        m_api->fetchAccount();
    });

    // Live stream fan-out
    connect(m_stream, &PriceStream::tickReceived, m_watch,  &WatchlistWidget::updateQuote);
    connect(m_stream, &PriceStream::tickReceived, m_ticket, &OrderTicket::updateQuote);
    connect(m_stream, &PriceStream::tickReceived, this,
            [this](const Quote& q) { if (q.valid) m_lastQuotes.insert(q.symbol, q); });
    connect(m_stream, &PriceStream::statusChanged, this, [this](const QString& s) {
        const bool live = s.startsWith("Live");
        // Only a live->live repeat is dropped. The old guard compared liveness
        // and returned whenever it had not CHANGED, which meant the first
        // trouble message stuck for the whole outage: a trader kept reading
        // the original socket error while the stream had already moved on to
        // "Reconnecting…". Every non-live update now reaches the status bar.
        if (live && m_streamLive) return;
        m_streamLive = live;
        // The permanent status label is gone, but a dropped feed still has to be
        // visible — stale prices that look live are the one thing a trading UI
        // must not do. Surface only the trouble states, and clear on recovery.
        setStatus(live ? QString() : s, !live);
    });

    // The tick stream's key pair was refused. Not a network blip, and
    // reconnecting cannot fix it: /algo/generate revokes the account's previous
    // key, so signing in on another machine (or re-signing in here) kills the
    // pair this session holds, and the stream then failed every four seconds
    // forever — the "Disconnected — retrying…" that never clears.
    //
    // Mint a replacement with the JWT and restart. Once per episode: the latch
    // clears on the next good authentication, so a genuinely revoked account
    // does not turn into a mint loop.
    connect(m_stream, &PriceStream::credentialsRejected, this, [this](const QString& why) {
        if (m_keyRenewTried) {
            setStatus(tr("%1 Sign out and back in to restore market data.").arg(why), true);
            return;
        }
        m_keyRenewTried = true;
        m_api->renewAlgoKey();
    });
    connect(m_api, &ApiClient::algoKeyRenewed, this,
            [this](bool ok, const QString& key, const QString& secret, const QString& message) {
        if (!ok) {
            setStatus(tr("Market data could not be restored: %1").arg(message), true);
            return;
        }
        m_cfg.apiKey    = key;
        m_cfg.apiSecret = secret;
        m_cfg.save();          // the secret is returned once — losing it costs a re-login
        m_api->setConfig(m_cfg);
        m_stream->setConfig(m_cfg);
        m_stream->start();
        // The instrument list, prices and bars sign with the SAME pair, so they
        // came up empty too — a "reconnected" terminal staring at an empty
        // Market Watch. Re-fetch them on the new key.
        m_api->fetchSymbols();
        refreshAll();
        setStatus(tr("Market data reconnected"));
    });
    // A good authentication means the current pair works, so the next failure
    // is allowed its own renewal attempt.
    connect(m_stream, &PriceStream::authenticated, this,
            [this](const QString&) { m_keyRenewTried = false; });
}

void MainWindow::switchAccount(const QString& accountId) {
    if (accountId.isEmpty() || accountId == m_cfg.accountId) return;
    m_cfg.accountId = accountId;
    m_cfg.save();
    m_api->setAccountId(accountId);
    refreshAll();   // reload everything for the newly selected account
    setStatus(tr("Switched trading account"));
}

void MainWindow::onSymbolsReceived(const QVector<SymbolSpec>& symbols) {
    m_specs.clear();
    for (const SymbolSpec& s : symbols)
        m_specs.insert(s.symbol, s);

    // Charts first, then the RESTORE, and only then the watchlist.
    //
    // Order matters: WatchlistWidget::setSymbols() ends by selecting the first
    // instrument, which fires symbolActivated -> onSymbolActivated ->
    // persistChartLayout. Run that before the grid has been restored and it
    // saves the 1-chart default over the layout still sitting on disk.
    // persistChartLayout() also refuses to write until m_chartLayoutRestored,
    // so this is belt and braces — but the belt is what makes the restore see
    // the real saved values.
    m_charts->setSymbols(symbols);  // feed symbol metadata to every pane's datafeed
    // The blotter formats prices at each instrument's own precision — gold to
    // 2, US30 to 1, EURUSD to 5 — instead of a flat 5 everywhere.
    {
        QHash<QString, int> digits;
        for (const SymbolSpec& sp : symbols) digits.insert(sp.symbol, sp.digits);
        m_positions->setSymbolDigits(digits);
    }
    // Restore the saved grid. This runs HERE, not in the constructor, because
    // a pane can only be pointed at a symbol once the metadata for it has
    // arrived — before that every restored pane would fall back to the default.
    // Guarded so it happens once per launch and never stamps over a layout the
    // trader has since changed (symbols can be re-fetched mid-session).
    if (!m_chartLayoutRestored) {
        // Snapshot BEFORE touching the grid. setChartCount() emits
        // chartCountChanged, which lands in persistChartLayout() and rewrites
        // m_cfg.chartSymbols from the panes as they are right now — all empty,
        // because none has been pointed at an instrument yet. The loop below
        // then read those empties and restored nothing. The flag is also only
        // raised at the END of this block, so persistChartLayout() stays a
        // no-op for the whole restore rather than saving each half-built step.
        const int       wantCount = m_cfg.chartCount;
        const QStringList wantSyms = m_cfg.chartSymbols;

        if (wantCount > 1)
            m_charts->setChartCount(wantCount);
        // Pane 0 is deliberately skipped: the terminal always opens on the
        // startup instrument (XAUUSD, see below), so restoring the saved symbol
        // there would immediately be overwritten anyway. Panes 1..n keep what
        // they were showing, so a 2x2 comes back with its other three
        // instruments intact.
        for (int i = 1; i < wantSyms.size() && i < m_charts->chartCount(); ++i) {
            const QString s = wantSyms.at(i);
            if (s.isEmpty() || !m_specs.contains(s)) continue;
            m_charts->setActivePane(i);
            m_charts->showSymbol(s);
        }
        m_charts->setActivePane(0);
        m_chartLayoutRestored = true;
    }

    m_watch->setSymbols(symbols);
    // Snapshot prices immediately (before first ticks arrive).
    m_api->fetchPrices({});
    // "loaded", not "available": this is the platform's whole instrument list,
    // and Market Watch lists only the ones the price feed actually carries. The
    // two numbers differ, and a client comparing this line against the panel
    // read the difference as missing symbols.
    setStatus(tr("%1 instruments loaded — quotes arriving").arg(symbols.size()));

    // Open on XAUUSD — the platform's headline instrument — rather than on the
    // alphabetical first, which is usually a share with a closed market and an
    // empty chart. The rest of the list is fallback for a deployment that does
    // not carry gold.
    //
    // This wins over whatever pane 0 was showing last session — every launch
    // starts on gold. The grid (1/2/4) and the OTHER panes' instruments are
    // still restored above, so a 2x2 comes back as it was apart from the pane
    // in focus.
    if (!symbols.isEmpty()) {
        QString pick = symbols.front().symbol;
        for (const QString& pref : {"XAUUSD", "EURUSD", "BTCUSD", "GBPUSD", "ETHUSD"}) {
            if (m_specs.contains(pref)) { pick = pref; break; }
        }
        m_watch->selectSymbol(pick);   // moves selection -> triggers onSymbolActivated
        onSymbolActivated(pick);
    }
}

void MainWindow::onSymbolActivated(const QString& symbol) {
    if (symbol.isEmpty() || symbol == m_currentSymbol) return;
    m_currentSymbol = symbol;
    if (m_specs.contains(symbol))
        m_ticket->setSymbolSpec(m_specs.value(symbol));
    // Seed the strip from the last known quote so it is not showing "—" (or
    // worse, the previous instrument's price) until the next tick lands.
    if (m_lastQuotes.contains(symbol))
        m_ticket->updateQuote(m_lastQuotes.value(symbol));
    m_charts->showSymbol(symbol);   // active pane only
    m_positions->setNewsSymbol(symbol);
    m_positions->setCalendarSymbol(symbol);
    persistChartLayout();
}

void MainWindow::onActiveChartChanged(int) {
    // Clicking between panes has to move the quote with it. ChartArea already
    // emitted this, but nothing listened, so the one-click strip kept whatever
    // Market Watch last selected: sitting on the XAUUSD pane (gold, ~4259) the
    // strip offered SELL/BUY at 61.81 — the XAGUSD price. One click from
    // trading silver at gold's chart.
    const QString sym = m_charts->activeSymbol();
    if (sym.isEmpty() || sym == m_currentSymbol) return;
    m_currentSymbol = sym;
    if (m_specs.contains(sym))
        m_ticket->setSymbolSpec(m_specs.value(sym));
    if (m_lastQuotes.contains(sym))
        m_ticket->updateQuote(m_lastQuotes.value(sym));
    // Keep Market Watch in step. This re-enters onSymbolActivated, which
    // early-returns because m_currentSymbol already equals sym — that guard is
    // what stops the two from bouncing off each other.
    m_watch->selectSymbol(sym);
    m_positions->setNewsSymbol(sym);
    m_positions->setCalendarSymbol(sym);
    persistChartLayout();
}

void MainWindow::persistChartLayout() {
    // Nothing is saved until the saved layout has been APPLIED.
    //
    // Without this the startup order destroyed it: m_watch->setSymbols() ends
    // by auto-selecting the first instrument, that fires onSymbolActivated,
    // and this ran with the grid still at its 1-chart default — writing
    // "1 [AAPL]" over the "4 [XAUUSD|EURUSD|BTCUSD|GBPUSD]" that had just been
    // read off disk. The restore block then looked at m_cfg, saw 1, and
    // correctly did nothing. Four charts became one on every launch.
    if (!m_chartLayoutRestored) return;

    // Remember the grid AND what each pane was showing. Restoring four panes
    // that all default to one symbol is not "as I left it".
    const int count = m_charts->chartCount();
    const QStringList syms = m_charts->visibleSymbols();
    if (m_cfg.chartCount == count && m_cfg.chartSymbols == syms) return;
    m_cfg.chartCount   = count;
    m_cfg.chartSymbols = syms;
    m_cfg.save();
}

void MainWindow::onTradeResult(const TradeResult& r) {
    if (r.ok) {
        QString msg;
        if (r.status == "filled")
            msg = tr("✓ %1 %2 %3 lots @ %4")
                    .arg(r.action, r.symbol).arg(r.lots).arg(r.price);
        else if (r.status == "closed")
            msg = tr("✓ Closed %1 %2 position(s), P/L %3")
                    .arg(r.closedCount).arg(r.symbol).arg(money(r.totalProfit));
        else if (r.status == "no_positions")
            msg = tr("No open %1 positions to close").arg(r.symbol);
        setStatus(msg);
        refreshAll();   // reflect the new state everywhere
    } else {
        setStatus(tr("Trade failed: %1").arg(r.message), true);
    }
}

void MainWindow::onApiError(const QString& context, const QString& message, int httpStatus) {
    // Auth failure (token expired / invalid) — always surface so the user
    // knows to sign in again, instead of silently showing stale data.
    //
    // 401/403 is the authoritative signal and is checked first. This used to
    // rest entirely on the four phrase matches below, and any 401 worded
    // differently fell through to the silent branch further down — which is how
    // a dead session appeared as an empty blotter: Trade (0), Pending (0),
    // History (0), no error anywhere, while Balance and Margin kept updating
    // because those ride the algo key, which never expires. The blotter is the
    // only part that needs the JWT, so it is the only part that goes blank.
    //
    // The phrase checks are kept for any error path that reports no status.
    if (httpStatus == 401 || httpStatus == 403
        || message.contains("expired", Qt::CaseInsensitive)
        || message.contains("Invalid token", Qt::CaseInsensitive)
        || message.contains("Invalid API credentials", Qt::CaseInsensitive)
        || message.contains("Not authenticated", Qt::CaseInsensitive)) {
        // Try to recover before declaring the session dead. The /api/algo polls
        // normally ride the key + secret, which never expire — reaching here
        // means they are falling back to the JWT (the key was never minted, or
        // it was revoked), and that lapses after ~45 minutes. A silent renewal
        // turns what the client saw as "the desktop is down" into a blip.
        if (!m_authRecoveryTried && !m_cfg.refreshToken.trimmed().isEmpty()) {
            m_authRecoveryTried = true;
            setStatus(tr("Session expired — renewing…"), false);
            m_api->refreshSession();
            return;
        }
        setStatus(tr("Session expired — open Settings and sign in again"), true);
        return;
    }
    // The account / trades lists poll every few seconds, so a blip on one poll
    // shouldn't flash a scary error — the next poll recovers.
    //
    // But "transient" has to mean transient. This used to stay quiet for ANY
    // failure on these polls, which hid the permanent ones too. A configured
    // account id that does not belong to the signed-in user answers 404
    // "Account not found" on every single poll, forever, and the trader was
    // shown an empty blotter — Trade (0), Pending (0), History (0) — with no
    // hint anything was wrong, while Balance and Margin kept ticking because
    // those come from the algo key's own account, a different one entirely.
    // That reads as "my positions vanished", which is the worst thing a
    // trading screen can say when it is not true.
    //
    // So: keep quiet only for things that genuinely pass on their own — no
    // response at all (status 0: DNS, timeout, refused), a server-side fault
    // (5xx), or rate limiting (429). Every other 4xx is a standing problem
    // that will never resolve by waiting, and has to be visible.
    // The selected account is not one this login owns. Every blotter poll will
    // 404 until the account is changed, so say what to do rather than echoing
    // the API's "Account not found", which tells a trader nothing.
    if (httpStatus == 404 && message.contains("Account not found", Qt::CaseInsensitive)) {
        setStatus(tr("This account is not available on the signed-in login — "
                     "pick another from the Accounts menu."), true);
        return;
    }

    const bool transient = httpStatus == 0 || httpStatus == 429 || httpStatus >= 500;
    if (transient
        && (context.startsWith(tr("Loading positions"))
            || context.startsWith(tr("Loading orders"))
            || context.startsWith(tr("Loading history"))
            || context.startsWith(tr("Loading account"))
            || context.startsWith(tr("Loading prices"))
            || context.startsWith(tr("Loading symbols"))))
        return;
    setStatus(tr("%1 — %2").arg(context, message), true);
}

void MainWindow::setStatus(const QString& text, bool error) {
    m_message->setText(text);
    m_message->setStyleSheet(QString("background:transparent; color:%1;")
                             .arg(error ? Theme::p().down : Theme::p().muted));
}

// Ends the session and shows the sign-in card again. Credentials are wiped from
// disk; endpoints and UI preferences (theme, privacy) survive, and the email is
// kept so the form prefills. Cancelling the sign-in closes the terminal — there
// is no signed-out state worth showing, only stale numbers.
bool MainWindow::requireSession(const QString& what) {
    if (!m_cfg.token.trimmed().isEmpty()) return true;
    QMessageBox::information(this, what,
        tr("%1 needs an email/password sign-in. This session is authenticated "
           "with an API key, which can place and close market orders but cannot "
           "reach the account endpoints. Sign in from File > Settings to use it.")
            .arg(what));
    return false;
}

void MainWindow::applySessionRenewal() {
    if (!m_sessionTimer) return;
    if (m_cfg.refreshToken.trimmed().isEmpty()) m_sessionTimer->stop();
    else                                        m_sessionTimer->start();
}

void MainWindow::logout() {
    if (QMessageBox::question(this, tr("Log out"),
            tr("Sign out of this terminal?")) != QMessageBox::Yes)
        return;

    // Stop everything that talks to the server before the token goes away, so
    // no in-flight poll comes back and repaints a signed-out screen.
    m_accountTimer->stop();
    m_stream->stop();

    m_cfg.token.clear();
    m_cfg.accountId.clear();
    m_cfg.userName.clear();
    m_cfg.accountsJson = "[]";
    m_cfg.apiKey.clear();
    m_cfg.apiSecret.clear();
    m_cfg.refreshToken.clear();   // a live refresh token would outlive the log out
    if (m_sessionTimer) m_sessionTimer->stop();
    m_cfg.save();   // the config file is the only store a token lives in
    m_api->setConfig(m_cfg);

    // Clear anything on screen that belonged to the account.
    m_lastAccount = AccountInfo{};
    m_account->clear();
    m_positions->setPositions({});
    m_positions->setOrders({});
    m_positions->setHistory({});
    updateIdentity();
    setStatus(QString());

    LoginDialog dlg(m_cfg, this);
    if (dlg.exec() != QDialog::Accepted) {
        close();
        return;
    }

    m_cfg = dlg.config();
    m_api->setConfig(m_cfg);
    m_stream->setConfig(m_cfg);
    m_stream->start();
    m_accountTimer->start();
    applySessionRenewal();   // a fresh sign-in brings a fresh refresh token
    m_api->fetchSymbols();
    refreshAll();
    updateIdentity();
    setStatus(tr("Signed in"));
}

void MainWindow::openOrderWindow() {
    // One home for order entry, Market and Pending both. Before this, market
    // orders lived only on the one-click strip floating over the chart — which
    // "View > Show trade panel" can hide — and pending orders were a menu item
    // people did not find. The blotter listed pending orders the UI had no
    // obvious way to create; "we can't find the pending order window" was
    // literally true.
    if (!requireSession(tr("Placing an order"))) return;
    if (m_currentSymbol.isEmpty()) {
        setStatus(tr("Pick a symbol in Market Watch first."), true);
        return;
    }
    // The whole symbol table goes in: the instrument is switchable from inside
    // the window, so it needs every spec and the last quote for each.
    OrderDialog dlg(m_specs, m_lastQuotes, m_currentSymbol,
                    m_lastAccount.leverage, m_lastAccount.freeMargin, this);
    // Keep it live: a market order confirmed against the quote the dialog
    // opened with is a fill at a price the trader never saw.
    connect(m_stream, &PriceStream::tickReceived, &dlg, &OrderDialog::updateQuote);
    if (dlg.exec() != QDialog::Accepted) return;

    // dlg.symbol(), not m_currentSymbol — the picker inside the window may have
    // moved to a different instrument since it opened.
    const QString sym = dlg.symbol();
    if (dlg.mode() == "market") {
        m_api->placeOrder(dlg.side().toUpper(), sym, dlg.lots(),
                          dlg.stopLoss(), dlg.takeProfit(), "terminal");
    } else {
        m_api->placePendingOrder(sym, dlg.side(), dlg.orderType(),
                                 dlg.lots(), dlg.price(), dlg.stopLoss(), dlg.takeProfit());
    }
}

void MainWindow::openSettings() {
    LoginDialog dlg(m_cfg, this);
    if (dlg.exec() != QDialog::Accepted)
        return;
    m_cfg = dlg.config();
    m_api->setConfig(m_cfg);
    applySessionRenewal();
    m_stream->setConfig(m_cfg);
    m_stream->stop();
    m_stream->start();
    m_api->fetchSymbols();
    m_api->fetchAccount();
    setStatus(tr("Reconnected with updated settings"));
}
