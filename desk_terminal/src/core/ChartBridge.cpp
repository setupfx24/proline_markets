#include "core/ChartBridge.h"
#include "core/ApiClient.h"
#include "core/PriceStream.h"
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>
#include <QDateTime>
#include <QMetaObject>

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

void ChartBridge::modifyBracket(const QString& positionId, const QString& kind, double level) {
    m_api->modifyBracket(positionId, kind, level);
}

void ChartBridge::closePosition(const QString& positionId) {
    m_api->closePositionById(positionId);
}

void ChartBridge::setOverlayHidden(bool hidden) {
    emit overlayHiddenChanged(hidden);
}

void ChartBridge::setTheme(const QString& theme) {
    if (theme == m_theme) return;
    m_theme = theme;
    emit themeChanged(theme);
}

void ChartBridge::setCompact(bool compact) {
    if (compact == m_compact) return;
    m_compact = compact;
    emit compactChanged(compact);
}

void ChartBridge::setCurrentSymbol(const QString& symbol) {
    if (symbol.isEmpty() || symbol == m_currentSymbol) return;
    m_currentSymbol = symbol;
    emit symbolChanged(symbol);
}

void ChartBridge::setCurrentInterval(const QString& interval) {
    if (interval.isEmpty() || interval == m_currentInterval) return;
    m_currentInterval = interval;
    emit intervalChanged(interval);
}

void ChartBridge::reportSymbol(const QString& symbol) {
    // Only tells the host. The chart is already showing it, so the equality
    // guard here is also what keeps a host-driven change from echoing back.
    if (symbol.isEmpty() || symbol == m_currentSymbol) return;
    m_currentSymbol = symbol;
    emit chartSymbolChanged(symbol);
}

void ChartBridge::reportInterval(const QString& interval) {
    if (interval.isEmpty() || interval == m_currentInterval) return;
    m_currentInterval = interval;
    emit chartIntervalChanged(interval);
}

void ChartBridge::requestBars(const QString& symbol, const QString& timeframe,
                              double /*fromSec*/, double /*toSec*/, const QString& reqId) {
    // The API returns the most-recent N bars (no from/to filter); JS filters to
    // the requested window. Ask for a generous window.
    const QString key = symbol + "|" + timeframe;

    // Answer straight from the cache when it is fresh. Queued rather than
    // emitted inline: barsReady() is what the JS datafeed listens on, and
    // firing it before requestBars() has even returned re-enters the datafeed
    // inside its own getBars() call.
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    if (m_barsCache.contains(key) && now - m_cachedAt.value(key, 0) < kBarsCacheMs) {
        const QString cached = m_barsCache.value(key);
        QMetaObject::invokeMethod(this, [this, reqId, cached]() {
            emit barsReady(reqId, cached);
        }, Qt::QueuedConnection);
        return;
    }

    m_pending.enqueue({key, reqId});
    // One fetch per key at a time. Four panes on the same instrument used to
    // fire four identical 1000-bar downloads; the extra three are now waiters
    // on the first, and all of them are answered from its response.
    if (m_inFlight.contains(key)) return;
    m_inFlight.insert(key);
    m_api->fetchBars(symbol, timeframe, 1000);
}

void ChartBridge::onBarsReceived(const QString& symbol, const QString& timeframe,
                                 const QVector<Bar>& bars) {
    const QString key = symbol + "|" + timeframe;
    m_inFlight.remove(key);

    // Collect EVERY request waiting on this (symbol,timeframe), not just the
    // oldest: with de-duplication above, one response is the answer to all of
    // them. Popping a single one used to leave the other panes' datafeed
    // requests unanswered until their 6s timeout fired and reported "no data" —
    // which is what an empty pane after a symbol or timeframe switch was.
    QStringList reqIds;
    for (int i = m_pending.size() - 1; i >= 0; --i) {
        if (m_pending[i].key == key) {
            reqIds.prepend(m_pending[i].reqId);
            m_pending.removeAt(i);
        }
    }
    if (reqIds.isEmpty()) return;   // not ours (e.g. legacy chart request)

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
    const QString json = QString::fromUtf8(QJsonDocument(arr).toJson(QJsonDocument::Compact));

    // Empty answers are not cached: a 401 or an aggregator hiccup would
    // otherwise pin an empty chart in place for the whole TTL.
    if (!bars.isEmpty()) {
        m_barsCache.insert(key, json);
        m_cachedAt.insert(key, QDateTime::currentMSecsSinceEpoch());
    }
    for (const QString& id : reqIds) emit barsReady(id, json);
}

void ChartBridge::onTick(const Quote& q) {
    // Only forward ticks for the symbol the chart is showing. The stream
    // carries all ~60 symbols (30-100 ticks/s); pushing every one across the
    // WebChannel to JS made the chart laggy. The chart needs one symbol.
    if (q.symbol != m_currentSymbol) return;
    emit tick(q.symbol, q.bid, q.ask, static_cast<double>(q.timestamp.toMSecsSinceEpoch()));
}
