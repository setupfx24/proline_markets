#pragma once
#include <QWidget>
#include <QString>

class QWebEngineView;
class QLabel;

// Live news for whichever instrument the terminal is on, shown as a tab beside
// Trade / Pending / History.
//
// The feed is TradingView's public timeline widget, embedded the same way the
// web terminal embeds it (frontend/trader/src/components/charts/
// TradingViewNewsTimeline.tsx). There is no Proline Markets news endpoint to call —
// the gateway serves prices and trading, not headlines — so rather than invent
// one, both clients point at the same free widget and stay consistent.
//
// Consequences worth knowing:
//   * It needs internet reachability to tradingview-widget.com. The rest of the
//     terminal talks only to the Proline Markets API, so this is the one panel that can
//     be blank on a network that allows the former but not the latter. It fails
//     to a message rather than an empty white box.
//   * Symbols are TradingView's, not ours: XAUUSD is OANDA:XAUUSD, BTCUSD is
//     BINANCE:BTCUSDT. See toTradingViewSymbol().
class NewsPanel : public QWidget {
    Q_OBJECT
public:
    explicit NewsPanel(QWidget* parent = nullptr);

public slots:
    // Follows the active chart / Market Watch selection.
    void setSymbol(const QString& symbol);
    void applyTheme();

private:
    void reload();

    // Proline Markets ticker -> TradingView's exchange-qualified symbol.
    static QString toTradingViewSymbol(const QString& symbol);

    QWebEngineView* m_view = nullptr;
    QLabel*         m_status = nullptr;
    QString         m_symbol;
    // The embed is only built once the tab is first shown. A QWebEngineView
    // costs a renderer process (~150 MB); a trader who never opens News should
    // not pay for one, and four chart panes already carry that cost each.
    bool            m_loaded = false;

protected:
    void showEvent(QShowEvent* e) override;
};
