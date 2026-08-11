#pragma once
#include <QObject>
#include <QString>
#include <QQueue>
#include <QHash>
#include <QSet>
#include "core/Models.h"

class ApiClient;
class PriceStream;

// Bridge object exposed to the TradingView web layer over QWebChannel as `sc`.
// The JS datafeed calls requestBars() and listens to barsReady()/tick();
// the native side pushes symbol metadata and selection changes down.
class ChartBridge : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString symbolsJson    READ symbolsJson    NOTIFY symbolsChanged)
    Q_PROPERTY(QString currentSymbol  READ currentSymbol  NOTIFY symbolChanged)
    // The pane's timeframe ("5", "60", "1D", …). Read by the web layer when it
    // builds the widget, so a restored pane opens on the interval it was left
    // on instead of the library's default.
    Q_PROPERTY(QString currentInterval READ currentInterval NOTIFY intervalChanged)
    Q_PROPERTY(QString positionsJson  READ positionsJson  NOTIFY positionsChanged)
    Q_PROPERTY(QString theme          READ theme          NOTIFY themeChanged)
    // True while this pane is one of several. The web layer drops the drawing
    // toolbar and the bottom date-range bar in that state — in a quarter-sized
    // pane they cost more room than they earn.
    Q_PROPERTY(bool    compact        READ compact        NOTIFY compactChanged)
public:
    ChartBridge(ApiClient* api, PriceStream* stream, QObject* parent = nullptr);

    QString symbolsJson()    const { return m_symbolsJson; }
    QString currentSymbol()  const { return m_currentSymbol; }
    QString currentInterval() const { return m_currentInterval; }
    QString positionsJson()  const { return m_positionsJson; }
    QString theme()          const { return m_theme; }
    bool    compact()        const { return m_compact; }

    void setTheme(const QString& theme);   // "dark" | "light"
    // Rebuilds the chart with a reduced chrome set. Costly (the widget is torn
    // down and recreated), so it is only called when the value actually flips.
    void setCompact(bool compact);

    void setSymbols(const QVector<SymbolSpec>& symbols);  // called by MainWindow
    void setCurrentSymbol(const QString& symbol);          // watchlist selection
    // Host -> chart timeframe, used when a saved layout is restored. Before the
    // page has booted this only records the value; the web layer reads it off
    // the property when it builds the widget, so an early call is not lost.
    void setCurrentInterval(const QString& interval);
    void setPositions(const QVector<OpenPosition>& positions);  // account poll

    // Chart -> host. The trader can change a pane's symbol from the chart's own
    // header and its timeframe from the toolbar, neither of which goes through
    // the host. Without these the saved layout would be whatever the watchlist
    // last set, not what is actually on screen.
    Q_INVOKABLE void reportSymbol(const QString& symbol);
    Q_INVOKABLE void reportInterval(const QString& interval);

    // JS -> C++: ask for history. Answered asynchronously via barsReady().
    Q_INVOKABLE void requestBars(const QString& symbol, const QString& timeframe,
                                 double fromSec, double toSec, const QString& reqId);

    // JS (chart overlay) -> C++: set one bracket ("sl" | "tp") on a live
    // position, or close it. level <= 0 asks to remove. Answered via positionOp().
    Q_INVOKABLE void modifyBracket(const QString& positionId, const QString& kind, double level);
    Q_INVOKABLE void closePosition(const QString& positionId);

    // JS -> C++: a TradingView dialog (Indicators, settings, …) opened or
    // closed. Those render INSIDE the chart iframe, so the native one-click
    // strip floating over the web view would otherwise cover them permanently.
    Q_INVOKABLE void setOverlayHidden(bool hidden);

signals:
    void symbolsChanged();
    void symbolChanged(const QString& symbol);
    void intervalChanged(const QString& interval);
    // What the chart itself is now showing, after the trader changed it there.
    // Separate from symbolChanged/intervalChanged, which travel host -> chart:
    // re-emitting those here would push the value straight back at the chart
    // that just reported it.
    void chartSymbolChanged(const QString& symbol);
    void chartIntervalChanged(const QString& interval);
    void positionsChanged();
    void themeChanged(const QString& theme);
    void compactChanged(bool compact);
    void barsReady(const QString& reqId, const QString& barsJson);
    void tick(const QString& symbol, double bid, double ask, double tsMs);
    // Result of a modifyBrackets()/closePosition() call, back to the broker adapter.
    void positionOp(const QString& positionId, const QString& op, bool ok, const QString& message);
    // Raised when a chart dialog opens/closes, so the host can hide the strip.
    void overlayHiddenChanged(bool hidden);

private slots:
    void onBarsReceived(const QString& symbol, const QString& timeframe, const QVector<Bar>& bars);
    void onTick(const Quote& q);

private:
    ApiClient*   m_api;
    PriceStream* m_stream;
    QString      m_symbolsJson = "[]";
    QString      m_positionsJson = "[]";
    QString      m_currentSymbol;
    QString      m_currentInterval;
    bool         m_compact = false;
    QString      m_theme = "dark";

    // Correlate async /bars responses (which carry only symbol+tf) back to the
    // JS reqId that asked, FIFO per (symbol,timeframe).
    struct Pending { QString key; QString reqId; };
    QQueue<Pending> m_pending;

    // ── /bars de-duplication and short-lived cache ──
    //
    // Four panes on the same instrument used to mean four separate 1000-bar
    // downloads, fired within milliseconds of each other at exactly the moment
    // the terminal is busiest — sign-in. TradingView also re-asks for history
    // on every timeframe switch and every scroll into the past, so flipping
    // 5m -> 1m -> 5m re-downloaded ground already covered.
    //
    // Now: one request per (symbol,timeframe) in flight at a time, its answer
    // fanned out to everyone waiting, and the payload kept for a few seconds so
    // a switch back is instant. Only HISTORY is cached — the forming candle is
    // built from live ticks in the datafeed and is not affected by this.
    QSet<QString>            m_inFlight;   // keys currently awaiting a response
    QHash<QString, QString>  m_barsCache;  // key -> bars JSON
    QHash<QString, qint64>   m_cachedAt;   // key -> ms since epoch
    static constexpr qint64  kBarsCacheMs = 15000;
};
