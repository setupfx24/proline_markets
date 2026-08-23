#pragma once
#include <QWidget>
#include <QHash>
#include <QPoint>
#include <QStringList>
#include "core/Models.h"

class QLineEdit;
class QPushButton;
class QLabel;
class QTableWidget;
class QTimer;

// MetaTrader-style Market Watch: a dense table of Symbol | Bid | Ask | Spread
// with a live clock in its header, one row per instrument. The arrow in the
// symbol column and the bid/ask colours follow the last tick's direction, which
// is how MT5 signals movement without a separate change column.
//
// Search + market-group filter sit above the table; both hide rows rather than
// rebuilding it, so scroll position and selection survive filtering.
class WatchlistWidget : public QWidget {
    Q_OBJECT
public:
    explicit WatchlistWidget(QWidget* parent = nullptr);

    void setSymbols(const QVector<SymbolSpec>& symbols);
    QString currentSymbol() const { return m_selected; }
    void selectSymbol(const QString& symbol);

public slots:
    void updateQuote(const Quote& q);
    void applyTheme();

    // Starred instruments, restored from Config on start. Order is preserved:
    // it is the order they were starred in, which is the order the Favourites
    // filter lists them in.
    void setFavourites(const QStringList& symbols);
    QStringList favourites() const { return m_favourites; }

signals:
    // A star was toggled — MainWindow persists the list to Config.
    void favouritesChanged(const QStringList& symbols);
    void symbolActivated(const QString& symbol);
    // Double-click is the MT5 gesture for "trade this one" — it opens the
    // order window. Kept separate from symbolActivated, which also fires on a
    // plain selection change and must not pop a dialog on every arrow key.
    void symbolDoubleClicked(const QString& symbol);

private:
    struct Row {
        int     row      = -1;
        int     digits   = 5;
        double  lastBid  = 0.0;
        int     dir      = 0;     // last tick direction: -1 down, 0 flat, +1 up
        bool    hasPrice = false; // a quote has arrived; until then the row hides
        QString group;
    };

    void openMarketMenu();
    void applyFilter();
    // Right-click on a row: star / unstar it.
    void openRowMenu(const QPoint& pos);
    void toggleFavourite(const QString& symbol);
    bool isFavourite(const QString& symbol) const { return m_favourites.contains(symbol); }
    // Repaint one row's symbol cell (star + direction arrow + name).
    void refreshSymbolCell(const QString& symbol);
    void setMarket(const QString& group);
    void onSelectionChanged();
    static QString marketGroup(const QString& category);

    QLineEdit*    m_search;
    QPushButton*  m_marketBtn;
    QLabel*       m_title;
    QTableWidget* m_table;
    QTimer*       m_clock;

    QVector<SymbolSpec>  m_all;
    QString              m_activeGroup;   // "" = all, kFavGroup = starred only
    QStringList          m_favourites;
    // Sentinel for the Favourites entry in the market filter. Not a real
    // segment name, and starts with a character no segment can.
    static const QString kFavGroup;
    QString              m_selected;
    QHash<QString, Row>  m_rows;
    bool                 m_selecting = false;   // guards programmatic selection
};
