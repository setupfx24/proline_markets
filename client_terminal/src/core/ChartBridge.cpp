#include "core/ChartBridge.h"
#include "core/ApiClient.h"
#include "core/PriceStream.h"
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>

ChartBridge::ChartBridge(ApiClient* api, PriceStream* stream, QObject* parent)
    : QObject(parent), m_api(api), m_stream(stream) {
    connect(m_api,    &ApiClient::barsReceived,   this, &ChartBridge::onBarsReceived);
    connect(m_stream, &PriceStream::tickReceived, this, &ChartBridge::onTick);
    // Relay per-position modify/close outcomes to the broker adapter.
    connect(m_api, &ApiClient::positionOpResult, this,
            [this](const QString& id, const QString& op, bool ok, const QString& msg) {
                emit positionOp(id, op, ok, msg);
            });
}

void ChartBridge::setSymbols(const QVector<SymbolSpec>& symbols) {
    QJsonArray arr;
    for (const SymbolSpec& s : symbols) {
        QJsonObject o;
        o["symbol"]       = s.symbol;
        o["display_name"] = s.displayName;
        o["category"]     = s.category;
        o["digits"]       = s.digits;
        // Lets the chart preview the money value of an SL/TP level before the
        // user commits it (profit = (level - open) * dir * lots * contract).
        o["contract_size"] = s.contractSize;
        arr.append(o);
    }
    m_symbolsJson = QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact));
    emit symbolsChanged();
}

void ChartBridge::setPositions(const QVector<OpenPosition>& positions) {
    QJsonArray arr;
    for (const OpenPosition& p : positions) {
        QJsonObject o;
        o["id"]            = p.id;
        o["symbol"]        = p.symbol;
        o["side"]          = p.side;          // "buy" | "sell"
        o["lots"]          = p.lots;
        o["open_price"]    = p.openPrice;
        o["current_price"] = p.currentPrice;
        o["sl"]            = p.sl;
        o["tp"]            = p.tp;
        o["profit"]        = p.profit;
        arr.append(o);
    }
    QString next = QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact));
    if (next == m_positionsJson) return;   // nothing changed; don't churn the chart
    m_positionsJson = next;
    emit positionsChanged();
}

void ChartBridge::modifyBrackets(const QString& positionId, double sl, double tp) {
    m_api->modifyPosition(positionId, sl, tp);
}

void ChartBridge::closePosition(const QString& positionId) {
    m_api->closePositionById(positionId);
}

void ChartBridge::setCurrentSymbol(const QString& symbol) {
    if (symbol.isEmpty() || symbol == m_currentSymbol) return;
    m_currentSymbol = symbol;
    emit symbolChanged(symbol);
}

void ChartBridge::requestBars(const QString& symbol, const QString& timeframe,
                              double /*fromSec*/, double /*toSec*/, const QString& reqId) {
    // The API returns the most-recent N bars (no from/to filter); JS filters to
    // the requested window. Ask for a generous window.
    m_pending.enqueue({symbol + "|" + timeframe, reqId});
    m_api->fetchBars(symbol, timeframe, 1000);
}

void ChartBridge::onBarsReceived(const QString& symbol, const QString& timeframe,
                                 const QVector<Bar>& bars) {
    const QString key = symbol + "|" + timeframe;

    // Find the oldest pending request for this (symbol,timeframe).
    QString reqId;
    for (int i = 0; i < m_pending.size(); ++i) {
        if (m_pending[i].key == key) {
            reqId = m_pending[i].reqId;
            m_pending.removeAt(i);
            break;
        }
    }
    if (reqId.isEmpty()) return;   // not ours (e.g. legacy chart request)

    QJsonArray arr;
    for (const Bar& b : bars) {
        QJsonObject o;
        o["time"]   = b.time.toString(Qt::ISODateWithMs);
        o["open"]   = b.open;
        o["high"]   = b.high;
        o["low"]    = b.low;
        o["close"]  = b.close;
        o["volume"] = b.volume;
        arr.append(o);
    }
    emit barsReady(reqId, QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact)));
}

void ChartBridge::onTick(const Quote& q) {
    // Only forward ticks for the symbol the chart is showing. The stream
    // carries all ~60 symbols (30-100 ticks/s); pushing every one across the
    // WebChannel to JS made the chart laggy. The chart needs one symbol.
    if (q.symbol != m_currentSymbol) return;
    emit tick(q.symbol, q.bid, q.ask, static_cast<double>(q.timestamp.toMSecsSinceEpoch()));
}
