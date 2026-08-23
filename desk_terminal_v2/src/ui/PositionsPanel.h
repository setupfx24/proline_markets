#pragma once
#include <QWidget>
#include <QDate>
#include <QHash>
#include "core/Models.h"

class QTabWidget;
class QTableWidget;
class QComboBox;
class QDateEdit;
class QPushButton;
class QLabel;
class NewsPanel;
class CalendarPanel;

// MT5's bottom blotter. Three tabs — Trade (open positions with live P/L),
// Pending orders, and closed-trade History — using MT5's column set:
// Symbol | Ticket | Time | Type | Volume | Price | S/L | T/P | Price | Profit.
//
// MT5's third tab is Journal; there is no log store behind this terminal, so
// that tab is deliberately absent rather than faked. Data is pushed in by
// MainWindow, which polls the REST endpoints.
//
// The ✕ on a row closes THAT position and nothing else. It used to emit a
// symbol and close every position for it, which meant a trader with two BTCUSD
// lots open lost both when they meant to close one.
class PositionsPanel : public QWidget {
    Q_OBJECT
public:
    explicit PositionsPanel(QWidget* parent = nullptr);

public slots:
    void setPositions(const QVector<OpenPosition>& positions);
    void setOrders(const QVector<PendingOrder>& orders);
    void setHistory(const QVector<HistoryTrade>& history);
    void setTransactions(const QVector<Transaction>& txns);

    // Only the balance and currency are used, for the History summary's
    // closing figure. Everything else about the account is the account
    // panel's business.
    void setAccount(const AccountInfo& account);

    // Live headlines for the instrument in focus — see NewsPanel.
    void setNewsSymbol(const QString& symbol);
    // Macro releases for the economies behind that instrument — see
    // CalendarPanel. Separate setter because the calendar only reacts when its
    // country filter is following the symbol.
    void setCalendarSymbol(const QString& symbol);

    // Price precision per instrument, fed from the symbol table. The blotter
    // has no other way to know it: OpenPosition / PendingOrder carry prices
    // but not the digits they should be shown at.
    void setSymbolDigits(const QHash<QString, int>& digits);

    void setCollapsed(bool collapsed);
    bool isCollapsed() const { return m_collapsed; }
    void setPrivacy(bool on);                    // mask the money columns
    void applyTheme();

signals:
    // One specific position. The whole row is carried, not just its id: the
    // close dialog shows side, size and P/L, and re-deriving those from a
    // later poll could describe a position that has already moved.
    void closePosition(const OpenPosition& position);
    // Edit this position's stop loss / take profit.
    void modifyBrackets(const OpenPosition& position);
    // Cancel a listed pending order.
    void cancelOrder(const PendingOrder& order);
    // Amend a listed pending order (price / volume / brackets).
    void modifyOrder(const PendingOrder& order);
    // An S/L or T/P cell was edited in place. level 0 removes that bracket.
    void bracketEdited(const QString& positionId, const QString& kind, double level);
    // Close every position in `batch` at market. `what` names the set for the
    // confirmation ("all 6 positions" / "4 positions in profit") — the panel
    // knows which button was pressed, MainWindow only has to confirm and send.
    void closeBatch(const QVector<OpenPosition>& batch, const QString& what);
    // Publish this closed-or-open trade as a public share card.
    void sharePosition(const OpenPosition& position);

private slots:
    void onBracketEdited(class QTableWidgetItem* item);

private:
    // Time filter, one per tab. Which timestamp it tests depends on the tab:
    // open time for Trade/Pending, close time for History.
    enum Range { RangeToday = 0, RangeWeek, RangeAll, RangeDay };

    // Enable/disable the three bulk-close buttons for the current position set.
    void updateCloseButtons(const QVector<OpenPosition>& shown);
    // Structure of the rows currently drawn in the Trade table: ids and bracket
    // levels, i.e. everything except the numbers that move with the market.
    // While it is unchanged, a poll only rewrites the three live cells instead
    // of rebuilding every row — see setPositions(). Cleared by anything that
    // changes how a row is PAINTED (theme, privacy) to force a full redraw.
    static QString rowsSignature(const QVector<OpenPosition>& v);

    // Tests an API timestamp against tab `tab`'s filter. Rows whose timestamp
    // cannot be parsed always pass: hiding a real trade because of an
    // unexpected date format is far worse than showing one the filter should
    // have excluded.
    bool passes(int tab, const QString& iso) const;
    QWidget* buildFilterBar(int tab);
    QWidget* wrapTable(int tab, QTableWidget* table);
    // Which slice of the ledger the Transactions tab shows. Funding is money
    // in and out of the account; trading is what the account did with it.
    enum TxnKind { KindAll = 0, KindFunding, KindTrading };

    QWidget* buildHistorySummary();
    void     refreshHistorySummary();

    QTabWidget*   m_tabs;
    NewsPanel*    m_news = nullptr;
    CalendarPanel* m_calendar = nullptr;
    // Tab positions, captured from addTab() instead of written as literals.
    // The counts in the captions used to be set with hardcoded indices, so
    // inserting the Calendar tab silently retitled it "Transactions (0)" and
    // left the real Transactions tab with a stale caption. Storing what
    // addTab() returns makes the order a detail of one place again.
    int m_tabTrade = 0, m_tabPending = 1, m_tabHistory = 2, m_tabTxn = 4;
    QTableWidget* m_posTable;
    QTableWidget* m_orderTable;
    QTableWidget* m_histTable;
    QTableWidget* m_txnTable;
    // One slot per FILTERED tab: 0 Trade, 1 Pending, 2 History,
    // 3 Transactions. News and Calendar have no slot — News has no filter at
    // all, and the Calendar owns its own (impact + countries), which filter a
    // third-party embed rather than one of these tables.
    QComboBox*    m_range[4] = {nullptr, nullptr, nullptr, nullptr};
    QDateEdit*    m_date[4]  = {nullptr, nullptr, nullptr, nullptr};
    // True while a table is being filled. itemChanged() cannot tell a repaint
    // from a real edit on its own, and setPositions() runs every four seconds.
    bool m_populating = false;
    bool m_collapsed = false;
    bool m_privacy = false;

    // Last snapshots, so a privacy/theme/filter change can re-render without a
    // poll. These always hold the UNFILTERED server data — filtering happens on
    // the way into the table, so widening the range never needs a refetch.
    QPushButton* m_closeAll    = nullptr;
    QPushButton* m_closeProfit = nullptr;
    QPushButton* m_closeLoss   = nullptr;
    QString      m_posSig;

    QVector<OpenPosition> m_lastPositions;
    QVector<PendingOrder> m_lastOrders;
    QVector<HistoryTrade> m_lastHistory;
    QVector<Transaction>  m_lastTxns;
    AccountInfo           m_lastAccount;

    // History summary — the closing figures MT5 puts under its History tab,
    // and the ones the desk asked for by name.
    QComboBox* m_txnKind    = nullptr;
    QWidget* m_histSummary  = nullptr;
    QLabel* m_sumProfit     = nullptr;
    QLabel* m_sumDeposit    = nullptr;
    QLabel* m_sumWithdrawal = nullptr;
    QLabel* m_sumBalance    = nullptr;

    // symbol -> decimals. Defaults to 5 for anything not listed, which is the
    // right guess for an FX pair and the old behaviour for everything else.
    QHash<QString, int> m_digits;
    int digitsFor(const QString& symbol) const { return m_digits.value(symbol, 5); }

    // ── Transactions pagination ──
    // The ledger is the one tab that can run to hundreds of rows in a blotter
    // only ~200px tall, so it pages rather than scrolls. 0-based; clamped in
    // setTransactions() because the filter can shrink the list under the page
    // the user is currently on.
    int          m_txnPage = 0;
    QComboBox*   m_txnPageSize = nullptr;
    QPushButton* m_txnPrev = nullptr;
    QPushButton* m_txnNext = nullptr;
    QLabel*      m_txnPageLbl = nullptr;
    int          txnPageSize() const;
};
