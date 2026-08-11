#pragma once
#include <QWidget>
#include <QDate>
#include "core/Models.h"

class QTabWidget;
class QTableWidget;
class QComboBox;
class QDateEdit;
class QPushButton;
class QLabel;
class NewsPanel;

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

    // Live headlines for the instrument in focus — see NewsPanel.
    void setNewsSymbol(const QString& symbol);

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
    // Mint a public share card for this trade and hand the trader the link.
    void sharePosition(const OpenPosition& position);
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

private slots:
    void onBracketEdited(class QTableWidgetItem* item);

private:
    // Time filter, one per tab. Which timestamp it tests depends on the tab:
    // open time for Trade/Pending, close time for History.
    enum Range { RangeToday = 0, RangeWeek, RangeAll, RangeDay };

    // Tests an API timestamp against tab `tab`'s filter. Rows whose timestamp
    // cannot be parsed always pass: hiding a real trade because of an
    // unexpected date format is far worse than showing one the filter should
    // have excluded.
    bool passes(int tab, const QString& iso) const;
    QWidget* buildFilterBar(int tab);
    QWidget* wrapTable(int tab, QTableWidget* table);
    // Totals under the History table, over the rows the filter is showing.
    void updateHistoryTotals(const QVector<HistoryTrade>& shown);
    // Enable/disable the three bulk-close buttons for the current position set.
    void updateCloseButtons(const QVector<OpenPosition>& shown);

    QTabWidget*   m_tabs;
    NewsPanel*    m_news = nullptr;
    QTableWidget* m_posTable;
    QTableWidget* m_orderTable;
    QTableWidget* m_histTable;
    QTableWidget* m_txnTable;
    // One slot per FILTERED tab: 0 Trade, 1 Pending, 2 History,
    // 3 Transactions. News has no filter and no slot.
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
    QVector<OpenPosition> m_lastPositions;
    QVector<PendingOrder> m_lastOrders;
    QVector<HistoryTrade> m_lastHistory;
    QVector<Transaction>  m_lastTxns;

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

    // ── History totals ──
    // A footer under the table rather than a last row in it: a row scrolls out
    // of sight in a blotter this short, and the total is the thing a trader
    // looks for after picking a period.
    QLabel* m_histTotals = nullptr;

    // ── Bulk close (Trade tab) ──
    QPushButton* m_closeAll    = nullptr;
    QPushButton* m_closeProfit = nullptr;
    QPushButton* m_closeLoss   = nullptr;

    // Structure of the rows currently drawn in the Trade table: ids and bracket
    // levels, i.e. everything except the numbers that move with the market.
    // While it is unchanged, a poll only rewrites the three live cells instead
    // of rebuilding every row — see setPositions(). Cleared by anything that
    // changes how a row is PAINTED (theme, privacy) to force a full redraw.
    QString m_posSig;
    static QString rowsSignature(const QVector<OpenPosition>& v);
};
