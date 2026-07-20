#include "core/ApiClient.h"
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QUrl>
#include <QUrlQuery>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QHash>
#include <memory>

// This client speaks the platform's own /api/v1 surface with a JWT bearer.
// It used to target /api/algo, which on this gateway is a narrower, key/secret
// authenticated surface for external bots — it has no login, positions, orders
// or history endpoints, so the terminal could not work against it.

ApiClient::ApiClient(const Config& cfg, QObject* parent)
    : QObject(parent), m_cfg(cfg), m_net(new QNetworkAccessManager(this)) {}

QNetworkRequest ApiClient::makeRequest(const QString& path) const {
    QNetworkRequest req{QUrl(m_cfg.restBase + path)};
    if (!m_cfg.token.isEmpty())
        req.setRawHeader("Authorization", ("Bearer " + m_cfg.token).toUtf8());
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    return req;
}

// --- parsing helpers -------------------------------------------------------

// The API is inconsistent about Decimals: the accounts list, orders, positions
// and trades return JSON numbers, while instrument specs return quoted strings
// ("0.0100"). Everything numeric goes through here.
static double num(const QJsonValue& v, double def = 0.0) {
    if (v.isDouble()) return v.toDouble();
    if (v.isString()) {
        bool ok = false;
        const double d = v.toString().toDouble(&ok);
        return ok ? d : def;
    }
    return def;
}

static SymbolSpec parseSymbol(const QJsonObject& o) {
    SymbolSpec s;
    s.symbol       = o.value("symbol").toString();
    s.displayName  = o.value("display_name").toString(s.symbol);
    s.category     = o.value("segment").toString();   // /api/v1 calls it segment
    s.digits       = o.value("digits").toInt(5);
    s.minLot       = num(o.value("min_lot"), 0.01);
    s.maxLot       = num(o.value("max_lot"), 100.0);
    s.lotStep      = num(o.value("lot_step"), 0.01);
    s.contractSize = num(o.value("contract_size"), 100000.0);
    return s;
}

static Quote parseQuote(const QJsonObject& o) {
    Quote q;
    q.symbol = o.value("symbol").toString();
    q.bid    = num(o.value("bid"));
    q.ask    = num(o.value("ask"));
    q.spread = num(o.value("spread"));
    q.timestamp = QDateTime::fromString(o.value("timestamp").toString(), Qt::ISODateWithMs);
    q.valid  = !q.symbol.isEmpty();
    return q;
}

// One entry of GET /accounts -> items[]. Leverage/currency/is_demo live here
// too, so a single call fills the whole panel.
static AccountInfo parseAccount(const QJsonObject& o) {
    AccountInfo a;
    a.account     = o.value("account_number").toString();
    a.currency    = o.value("currency").toString("USD");
    a.leverage    = o.value("leverage").toInt(100);
    a.balance     = num(o.value("balance"));
    a.credit      = num(o.value("credit"));
    a.equity      = num(o.value("equity"));
    a.marginUsed  = num(o.value("margin_used"));
    a.freeMargin  = num(o.value("free_margin"));
    a.marginLevel = num(o.value("margin_level"));
    a.isDemo      = o.value("is_demo").toBool();
    a.valid       = !a.account.isEmpty();
    return a;
}

// Bars arrive TradingView-style: unix seconds, ascending.
static Bar parseBar(const QJsonObject& o) {
    Bar b;
    // No timezone argument: the instant is what matters, and the Qt::UTC
    // overload is deprecated in newer Qt 6.
    b.time   = QDateTime::fromSecsSinceEpoch(
                   static_cast<qint64>(o.value("time").toDouble()));
    b.open   = num(o.value("open"));
    b.high   = num(o.value("high"));
    b.low    = num(o.value("low"));
    b.close  = num(o.value("close"));
    b.volume = num(o.value("volume"));
    return b;
}

static OpenPosition parsePosition(const QJsonObject& o) {
    OpenPosition p;
    p.id           = o.value("id").toString();
    p.symbol       = o.value("symbol").toString();
    p.side         = o.value("side").toString();
    p.lots         = num(o.value("lots"));
    p.openPrice    = num(o.value("open_price"));
    p.currentPrice = num(o.value("current_price"));
    p.sl           = num(o.value("stop_loss"));
    p.tp           = num(o.value("take_profit"));
    p.swap         = num(o.value("swap"));
    p.commission   = num(o.value("commission"));
    p.profit       = num(o.value("profit"));
    p.openedAt     = o.value("created_at").toString();
    p.comment      = o.value("comment").toString();
    return p;
}

static PendingOrder parseOrder(const QJsonObject& o) {
    PendingOrder p;
    p.id        = o.value("id").toString();
    p.symbol    = o.value("symbol").toString();
    p.type      = o.value("order_type").toString();
    p.side      = o.value("side").toString();
    p.lots      = num(o.value("lots"));
    p.price     = num(o.value("price"));
    p.sl        = num(o.value("stop_loss"));
    p.tp        = num(o.value("take_profit"));
    p.createdAt = o.value("created_at").toString();
    p.comment   = o.value("comment").toString();
    return p;
}

// /portfolio/trades names two fields differently from the positions payload:
// realised P/L is `pnl`, and the close timestamp is `close_time`.
static HistoryTrade parseHistory(const QJsonObject& o) {
    HistoryTrade h;
    h.id          = o.value("id").toString();
    h.symbol      = o.value("symbol").toString();
    h.side        = o.value("side").toString();
    h.lots        = num(o.value("lots"));
    h.openPrice   = num(o.value("open_price"));
    h.closePrice  = num(o.value("close_price"));
    h.profit      = num(o.value("pnl"));
    h.swap        = num(o.value("swap"));
    h.commission  = num(o.value("commission"));
    h.openedAt    = o.value("opened_at").toString();
    h.closedAt    = o.value("close_time").toString();
    h.closeReason = o.value("close_reason").toString();
    return h;
}

// The chart sends TradingView resolutions already; older callers may still use
// "5m"/"1h" style, so both are accepted.
static QString toResolution(const QString& tf) {
    static const QHash<QString, QString> map{
        {"1m", "1"}, {"5m", "5"}, {"15m", "15"}, {"30m", "30"},
        {"1h", "60"}, {"4h", "240"}, {"1d", "D"}, {"1D", "D"},
    };
    const auto it = map.constFind(tf);
    return it != map.constEnd() ? it.value() : tf;
}

// --- requests --------------------------------------------------------------

void ApiClient::fetchSymbols() {
    QNetworkReply* r = m_net->get(makeRequest("/instruments/"));
    handleReply(r, "symbols", tr("Loading symbols"));
}

void ApiClient::fetchAccount() {
    // No trailing slash here — /accounts/ 307-redirects.
    QNetworkReply* r = m_net->get(makeRequest("/accounts"));
    handleReply(r, "account", tr("Loading account"));
}

void ApiClient::fetchPrices(const QStringList& symbols) {
    // The endpoint has no filter; callers that pass symbols get them filtered
    // out of the full snapshot below.
    QNetworkReply* r = m_net->get(makeRequest("/instruments/prices/all"));
    handleReply(r, "prices", tr("Loading prices"), symbols.join(','));
}

void ApiClient::fetchBars(const QString& symbol, const QString& timeframe, int limit) {
    Q_UNUSED(limit);   // server caps at 1000; there is no limit parameter
    QUrlQuery q;
    q.addQueryItem("resolution", toResolution(timeframe));
    QNetworkReply* r = m_net->get(
        makeRequest(QString("/instruments/%1/bars?%2").arg(symbol, q.toString())));
    handleReply(r, "bars", tr("Loading chart for %1").arg(symbol), symbol, timeframe);
}

void ApiClient::fetchPositions() {
    QUrlQuery q;
    q.addQueryItem("account_id", m_cfg.accountId);
    q.addQueryItem("status", "open");
    QNetworkReply* r = m_net->get(makeRequest("/positions/?" + q.toString()));
    handleReply(r, "positions", tr("Loading positions"));
}

void ApiClient::fetchOrders() {
    QUrlQuery q;
    q.addQueryItem("account_id", m_cfg.accountId);
    q.addQueryItem("status", "pending");
    QNetworkReply* r = m_net->get(makeRequest("/orders/?" + q.toString()));
    handleReply(r, "orders", tr("Loading orders"));
}

void ApiClient::fetchHistory(int limit) {
    QUrlQuery q;
    q.addQueryItem("account_id", m_cfg.accountId);
    q.addQueryItem("page", "1");
    q.addQueryItem("per_page", QString::number(qBound(1, limit, 200)));
    QNetworkReply* r = m_net->get(makeRequest("/portfolio/trades?" + q.toString()));
    handleReply(r, "history", tr("Loading history"));
}

void ApiClient::placeOrder(const QString& action, const QString& symbol, double volume,
                           double sl, double tp, const QString& comment) {
    QJsonObject body;
    body["account_id"] = m_cfg.accountId;
    body["symbol"]     = symbol;
    body["order_type"] = "market";
    body["side"]       = action.toLower();     // API expects buy|sell
    body["lots"]       = volume;
    if (sl > 0.0) body["stop_loss"]   = sl;
    if (tp > 0.0) body["take_profit"] = tp;
    if (!comment.isEmpty()) body["comment"] = comment;

    QNetworkReply* r = m_net->post(makeRequest("/orders/"),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    handleReply(r, "trade", tr("Placing %1 %2").arg(action, symbol), action.toUpper(), symbol);
}

// There is no bulk close endpoint, so this reads the open positions for the
// symbol and closes them one by one, reporting a single aggregate result.
void ApiClient::closePositions(const QString& symbol) {
    QUrlQuery q;
    q.addQueryItem("account_id", m_cfg.accountId);
    q.addQueryItem("status", "open");
    QNetworkReply* list = m_net->get(makeRequest("/positions/?" + q.toString()));

    connect(list, &QNetworkReply::finished, this, [this, list, symbol]() {
        list->deleteLater();
        const int http = list->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonDocument doc = QJsonDocument::fromJson(list->readAll());

        if (list->error() != QNetworkReply::NoError || http >= 400) {
            TradeResult t;
            t.status = "error";
            t.message = doc.object().value("detail").toString(list->errorString());
            emit tradeResult(t);
            emit errorOccurred(tr("Closing %1").arg(symbol), t.message);
            return;
        }

        QStringList ids;
        for (const QJsonValue& v : doc.array()) {
            const QJsonObject o = v.toObject();
            if (o.value("symbol").toString().compare(symbol, Qt::CaseInsensitive) == 0)
                ids << o.value("id").toString();
        }

        if (ids.isEmpty()) {
            TradeResult t;
            t.ok = true;
            t.status = "no_positions";
            t.symbol = symbol;
            t.action = "CLOSE";
            t.message = tr("No open positions on %1").arg(symbol);
            emit tradeResult(t);
            return;
        }

        // Shared tally so one result is emitted after the last close returns.
        auto done   = std::make_shared<int>(0);
        auto closed = std::make_shared<int>(0);
        auto profit = std::make_shared<double>(0.0);
        auto failed = std::make_shared<QString>();
        const int total = ids.size();

        for (const QString& id : ids) {
            QNetworkReply* r = m_net->post(makeRequest("/positions/" + id + "/close"),
                                           QByteArray("{}"));
            connect(r, &QNetworkReply::finished, this,
                    [this, r, symbol, total, done, closed, profit, failed]() {
                r->deleteLater();
                const int code = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
                const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
                if (r->error() == QNetworkReply::NoError && code < 400) {
                    ++*closed;
                    *profit += o.value("profit").toDouble();
                } else if (failed->isEmpty()) {
                    *failed = o.value("detail").toString(r->errorString());
                }

                if (++*done < total) return;

                TradeResult t;
                t.ok          = (*closed > 0);
                t.status      = t.ok ? "closed" : "error";
                t.symbol      = symbol;
                t.action      = "CLOSE";
                t.closedCount = *closed;
                t.totalProfit = *profit;
                t.message     = failed->isEmpty()
                    ? tr("Closed %1 position(s) on %2").arg(*closed).arg(symbol)
                    : *failed;
                emit tradeResult(t);
                if (!failed->isEmpty()) emit errorOccurred(tr("Closing %1").arg(symbol), *failed);
            });
        }
    });
}

// Emits positionOpResult when the reply arrives; parses FastAPI's {detail} on
// failure so the chart can restore the line and show why.
static void handlePositionOp(ApiClient* self, QNetworkReply* reply,
                             const QString& positionId, const QString& op) {
    QObject::connect(reply, &QNetworkReply::finished, self,
        [self, reply, positionId, op]() {
            reply->deleteLater();
            const QByteArray data = reply->readAll();
            const QJsonObject obj = QJsonDocument::fromJson(data).object();
            const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
            const bool ok = (reply->error() == QNetworkReply::NoError && http < 400);
            QString msg;
            if (ok) {
                msg = obj.value("message").toString(op == "close" ? "Position closed" : "Updated");
            } else {
                msg = obj.value("detail").toString();
                if (msg.isEmpty()) msg = reply->errorString();
            }
            emit self->positionOpResult(positionId, op, ok, msg);
        });
}

void ApiClient::modifyPosition(const QString& positionId, double sl, double tp) {
    // Note: the API cannot clear an existing SL/TP — it ignores nulls and only
    // applies values it is given. Sending 0/null here is a no-op, not a reset.
    QJsonObject body;
    if (sl > 0.0) body["stop_loss"]   = sl;
    if (tp > 0.0) body["take_profit"] = tp;
    QNetworkReply* r = m_net->put(makeRequest("/positions/" + positionId),
                                  QJsonDocument(body).toJson(QJsonDocument::Compact));
    handlePositionOp(this, r, positionId, "modify");
}

void ApiClient::closePositionById(const QString& positionId) {
    QNetworkReply* r = m_net->post(makeRequest("/positions/" + positionId + "/close"),
                                   QByteArray("{}"));
    handlePositionOp(this, r, positionId, "close");
}

// --- reply dispatch --------------------------------------------------------

void ApiClient::handleReply(QNetworkReply* reply, const QString& kind, const QString& context,
                            const QString& a, const QString& b) {
    connect(reply, &QNetworkReply::finished, this, [this, reply, kind, context, a, b]() {
        reply->deleteLater();
        const QByteArray data = reply->readAll();
        const QJsonDocument doc = QJsonDocument::fromJson(data);
        const QJsonObject obj = doc.object();

        const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();

        if (reply->error() != QNetworkReply::NoError || (http >= 400)) {
            QString detail = obj.value("detail").toString();
            if (detail.isEmpty()) detail = reply->errorString();
            if (kind == "trade") {
                // Surface trade failures both as a result and an error.
                TradeResult tr_;
                tr_.ok = false;
                tr_.status = "error";
                tr_.message = detail;
                emit tradeResult(tr_);
            }
            emit errorOccurred(context, detail);
            return;
        }

        if (kind == "symbols") {
            // Bare array, not wrapped.
            QVector<SymbolSpec> out;
            for (const QJsonValue& v : doc.array())
                out.push_back(parseSymbol(v.toObject()));
            emit symbolsReceived(out);

        } else if (kind == "account") {
            // {"items":[...]} — pick the account this session is trading.
            AccountInfo acct;
            for (const QJsonValue& v : obj.value("items").toArray()) {
                const QJsonObject o = v.toObject();
                if (o.value("id").toString() == m_cfg.accountId) { acct = parseAccount(o); break; }
            }
            acct.openPositions = m_openPositions;
            emit accountReceived(acct);

        } else if (kind == "prices") {
            const QStringList wanted = a.isEmpty() ? QStringList() : a.split(',');
            QVector<Quote> out;
            for (const QJsonValue& v : doc.array()) {
                const Quote q = parseQuote(v.toObject());
                if (wanted.isEmpty() || wanted.contains(q.symbol)) out.push_back(q);
            }
            emit pricesReceived(out);

        } else if (kind == "bars") {
            QVector<Bar> out;
            for (const QJsonValue& v : obj.value("bars").toArray())
                out.push_back(parseBar(v.toObject()));
            emit barsReceived(a, b, out);   // response doesn't echo them back

        } else if (kind == "positions") {
            QVector<OpenPosition> out;
            for (const QJsonValue& v : doc.array())
                out.push_back(parsePosition(v.toObject()));
            m_openPositions = out.size();
            emit positionsReceived(out);

        } else if (kind == "orders") {
            QVector<PendingOrder> out;
            for (const QJsonValue& v : doc.array())
                out.push_back(parseOrder(v.toObject()));
            emit ordersReceived(out);

        } else if (kind == "history") {
            QVector<HistoryTrade> out;
            for (const QJsonValue& v : obj.value("items").toArray())
                out.push_back(parseHistory(v.toObject()));
            emit historyReceived(out);

        } else if (kind == "trade") {
            // POST /orders/ echoes the created order.
            TradeResult t;
            t.status      = obj.value("status").toString();
            t.ok          = (t.status == "filled" || t.status == "pending");
            t.symbol      = obj.value("symbol").toString(b);
            t.action      = a;
            t.lots        = num(obj.value("lots"));
            t.price       = num(obj.value("filled_price"));
            t.orderId     = obj.value("id").toString();
            t.message     = t.ok ? tr("%1 %2 %3 lots @ %4")
                                       .arg(t.action, t.symbol)
                                       .arg(t.lots).arg(t.price)
                                 : obj.value("detail").toString();
            emit tradeResult(t);
        }
    });
}
