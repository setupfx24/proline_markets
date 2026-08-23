#pragma once
#include <QMainWindow>
#include <QHash>
#include "core/Config.h"
#include "core/Models.h"

class ApiClient;
class PriceStream;
class WatchlistWidget;
class ChartArea;
class OrderTicket;
class AccountPanel;
class PositionsPanel;
class QLabel;
class QTimer;
class QMenu;
class QAction;
class QActionGroup;
class QSplitter;
class QFrame;
class QPushButton;

// MetaTrader-style shell:
//
//   ┌─ menu bar ─────────────────────────── account · connection ─┐
//   │ Market Watch │ chart (+ one-click strip floating on it)     │
//   │  Sym Bid Ask ├──────────────────────────────────────────────┤
//   │              │ Trade / Pending / History blotter            │
//   │              │ Balance: … Equity: … Margin: …               │
//   └─ status bar ────────────────────────────────────────────────┘
//
// The menu carries only actions this terminal actually has (no File/Insert/
// Charts stubs). Services stay off the UI: MainWindow owns ApiClient and
// PriceStream and connects their signals to the widgets.
class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(const Config& cfg, QWidget* parent = nullptr);

private slots:
    void onSymbolsReceived(const QVector<SymbolSpec>& symbols);
    void onSymbolActivated(const QString& symbol);
    void onTradeResult(const TradeResult& r);
    void onApiError(const QString& context, const QString& message, int httpStatus);
    void openSettings();
    void openOrderWindow();    // Market + Pending order ticket (F9)
    void onActiveChartChanged(int index);  // strip follows the active pane
    void persistChartLayout();             // grid + per-pane symbols -> Config
    void logout();              // clear the session and return to the sign-in card
    void applyTheme();          // restyle the bits that carry inline style sheets
    void openWebTerminal();     // this account, in the browser terminal

private:
    void connectServices();
    void buildMenuBar();
    void rebuildAccountsMenu();
    void setStatus(const QString& text, bool error = false);
    void toggleTheme();
    void togglePrivacy();
    void refreshAll();
    // Starts/stops the JWT renewal timer from whatever is in m_cfg. Every
    // sign-in path has to call this: the access token dies after ~45 minutes,
    // and a session that never renews takes the wallet and per-position close
    // down with it.
    void applySessionRenewal();
    // True when this session holds a JWT. Everything on /api/v1 — per-position
    // close, S/L and T/P, pending orders, the wallet — needs one, and a session
    // signed in with a pasted API key never has it. Says so once, here, instead
    // of each call site firing a request that 401s with a message no trader can
    // act on. `what` names the action in the message.
    bool requireSession(const QString& what);
    void updateIdentity();      // the "name | type | account no." line by the logo
    void updateMenuChips();     // the Web Terminal button in the menu row
    // Money as text, or a mask when privacy mode is on.
    QString money(double v, const QString& currency = QString()) const;
    void switchAccount(const QString& accountId);

    Config       m_cfg;
    ApiClient*   m_api;
    PriceStream* m_stream;

    WatchlistWidget* m_watch;
    ChartArea*       m_charts;   // 1 / 2 / 4 chart panes; the watchlist drives the active one
    OrderTicket*     m_ticket;
    AccountPanel*    m_account;
    PositionsPanel*  m_positions;

    QLabel*  m_message;
    QTimer*  m_accountTimer;
    QTimer*  m_sessionTimer = nullptr;   // renews the JWT before it lapses
    // One recovery attempt per failure episode. Without it an expired token
    // would loop: the poll 401s, that triggers a refresh, the refresh answers
    // and the next poll 401s again a second later.
    bool     m_authRecoveryTried = false;
    // One market-data key renewal per failure episode, cleared by the next good
    // stream authentication. Without it a revoked account would mint a key,
    // fail, mint another, and so on for as long as the terminal is open.
    bool     m_keyRenewTried = false;
    QWidget*     m_chipBox = nullptr;   // menu row, right: holder for the button
    QPushButton* m_webChip = nullptr;   // menu row: open the browser terminal
    QLabel*  m_identity = nullptr;     // menu-bar left: name | type | account no.
    QMenu*   m_accountsMenu = nullptr;
    QAction* m_darkAction   = nullptr;
    QAction* m_privacyAction = nullptr;
    QAction* m_bloterAction = nullptr;  // show/hide the trade blotter
    QActionGroup* m_layoutGroup = nullptr;  // 1 / 2 / 4 chart panes
    // The saved grid is restored once, from the first symbols payload — panes
    // cannot be pointed at an instrument before its metadata exists. Symbols
    // can be re-fetched mid-session, hence the latch.
    bool m_chartLayoutRestored = false;
    QFrame*  m_identityDivider = nullptr;  // hairline before the first menu
    QSplitter* m_centerSplit = nullptr;

    QHash<QString, SymbolSpec> m_specs;
    // Last tick per symbol, so the pending-order dialog can seed its price
    // and state the rule without waiting for a fresh quote.
    QHash<QString, Quote> m_lastQuotes;
    QString     m_currentSymbol;
    AccountInfo m_lastAccount;          // re-rendered when privacy/theme flips
    bool        m_streamLive = false;
};
