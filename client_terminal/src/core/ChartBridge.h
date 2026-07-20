#pragma once
#include <QObject>
#include <QString>
#include <QQueue>
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
    Q_PROPERTY(QString positionsJson  READ positionsJson  NOTIFY positionsChanged)
public:
    ChartBridge(ApiClient* api, PriceStream* stream, QObject* parent = nullptr);

    QString symbolsJson()   const { return m_symbolsJson; }
    QString currentSymbol() const { return m_currentSymbol; }
    QString positionsJson() const { return m_positionsJson; }

    void setSymbols(const QVector<SymbolSpec>& symbols);  // called by MainWindow
    void setCurrentSymbol(const QString& symbol);          // watchlist selection
    void setPositions(const QVector<OpenPosition>& positions);  // account poll

    // JS -> C++: ask for history. Answered asynchronously via barsReady().
    Q_INVOKABLE void requestBars(const QString& symbol, const QString& timeframe,
                                 double fromSec, double toSec, const QString& reqId);

    // JS (broker adapter) -> C++: modify a live position's SL/TP or close it.
    // sl/tp <= 0 clears that bracket. Answered via positionOp().
    Q_INVOKABLE void modifyBrackets(const QString& positionId, double sl, double tp);
    Q_INVOKABLE void closePosition(const QString& positionId);

signals:
    void symbolsChanged();
    void symbolChanged(const QString& symbol);
    void positionsChanged();
    void barsReady(const QString& reqId, const QString& barsJson);
    void tick(const QString& symbol, double bid, double ask, double tsMs);
    // Result of a modifyBrackets()/closePosition() call, back to the broker adapter.
    void positionOp(const QString& positionId, const QString& op, bool ok, const QString& message);

private slots:
    void onBarsReceived(const QString& symbol, const QString& timeframe, const QVector<Bar>& bars);
    void onTick(const Quote& q);

private:
    ApiClient*   m_api;
    PriceStream* m_stream;
    QString      m_symbolsJson = "[]";
    QString      m_positionsJson = "[]";
    QString      m_currentSymbol;

    // Correlate async /bars responses (which carry only symbol+tf) back to the
    // JS reqId that asked, FIFO per (symbol,timeframe).
    struct Pending { QString key; QString reqId; };
    QQueue<Pending> m_pending;
};
