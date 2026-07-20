#include "core/ApiClient.h"
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QUrl>
#include <QUrlQuery>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>

ApiClient::ApiClient(const Config& cfg, QObject* parent)
    : QObject(parent), m_cfg(cfg), m_net(new QNetworkAccessManager(this)) {}

QNetworkRequest ApiClient::makeRequest(const QString& path) const {
    QNetworkRequest req{QUrl(m_cfg.restBase + path)};
    if (!m_cfg.token.isEmpty()) {
        req.setRawHeader("Authorization", ("Bearer " + m_cfg.token).toUtf8());
        req.setRawHeader("X-Account-Id",  m_cfg.accountId.toUtf8());
    } else {
        req.setRawHeader("X-Api-Key",    m_cfg.apiKey.toUtf8());
        req.setRawHeader("X-Api-Secret", m_cfg.apiSecret.toUtf8());
    }
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    return req;
}

QNetworkRequest ApiClient::v1Request(const QString& path) const {
    // The per-position modify/close endpoints live under /api/v1/positions and
    // authenticate the platform user via the JWT (ownership is derived from the
    // position). Reuse the algo REST base, swapping /api/algo -> /api/v1.
    QString base = m_cfg.restBase;
    base.replace("/api/algo", "/api/v1");
    QNetworkRequest req{QUrl(base + path)};
    if (!m_cfg.token.isEmpty())
        req.setRawHeader("Authorization", ("Bearer " + m_cfg.token).toUtf8());
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    return req;
}

// --- parsing helpers -------------------------------------------------------

static SymbolSpec parseSymbol(const QJsonObject& o) {
    SymbolSpec s;
    s.symbol       = o.value("symbol").toString();
    s.displayName  = o.value("display_name").toString(s.symbol);
    s.category     = o.value("category").toString();
    s.digits       = o.value("digits").toInt(5);
    s.minLot       = o.value("min_lot").toDouble(0.01);
    s.maxLot       = o.value("max_lot").toDouble(100.0);
    s.lotStep      = o.value("lot_step").toDouble(0.01);
    s.contractSize = o.value("contract_size").toDouble(100000.0);
    return s;
}

static Quote parseQuote(const QJsonObject& o) {
    Quote q;
    q.symbol = o.value("symbol").toString();
    q.bid    = o.value("bid").toDouble();
    q.ask    = o.value("ask").toDouble();
    q.spread = o.value("spread").toDouble();
    q.timestamp = QDateTime::fromString(o.value("timestamp").toString(), Qt::ISODateWithMs);
    q.valid  = !q.symbol.isEmpty();
    return q;
}

static AccountInfo parseAccount(const QJsonObject& o) {
    AccountInfo a;
    a.account       = o.value("account").toString();
    a.currency      = o.value("currency").toString("USD");
    a.leverage      = o.value("leverage").toInt(100);
    a.balance       = o.value("balance").toDouble();
    a.credit        = o.value("credit").toDouble();
    a.equity        = o.value("equity").toDouble();
    a.marginUsed    = o.value("margin_used").toDouble();
    a.freeMargin    = o.value("free_margin").toDouble();
    a.marginLevel   = o.value("margin_level").toDouble();
    a.isDemo        = o.value("is_demo").toBool();
    a.openPositions = o.value("open_positions").toInt();
    a.valid         = !a.account.isEmpty();
    return a;
}

static Bar parseBar(const QJsonObject& o) {
    Bar b;
    b.time   = QDateTime::fromString(o.value("time").toString(), Qt::ISODateWithMs);
    b.open   = o.value("open").toDouble();
    b.high   = o.value("high").toDouble();
    b.low    = o.value("low").toDouble();
    b.close  = o.value("close").toDouble();
    b.volume = o.value("volume").toDouble();
    return b;
}

static OpenPosition parsePosition(const QJsonObject& o) {
    OpenPosition p;
    p.id           = o.value("id").toString();
    p.symbol       = o.value("symbol").toString();
    p.side         = o.value("side").toString();
    p.lots         = o.value("lots").toDouble();
    p.openPrice    = o.value("open_price").toDouble();
    p.currentPrice = o.value("current_price").toDouble();
    p.sl           = o.value("sl").toDouble();
    p.tp           = o.value("tp").toDouble();
    p.swap         = o.value("swap").toDouble();
    p.commission   = o.value("commission").toDouble();
    p.profit       = o.value("profit").toDouble();
    p.openedAt     = o.value("opened_at").toString();
    p.comment      = o.value("comment").toString();
    return p;
}

static PendingOrder parseOrder(const QJsonObject& o) {
    PendingOrder p;
    p.id        = o.value("id").toString();
    p.symbol    = o.value("symbol").toString();
    p.type      = o.value("type").toString();
    p.side      = o.value("side").toString();
    p.lots      = o.value("lots").toDouble();
    p.price     = o.value("price").toDouble();
    p.sl        = o.value("sl").toDouble();
    p.tp        = o.value("tp").toDouble();
    p.createdAt = o.value("created_at").toString();
    p.comment   = o.value("comment").toString();
    return p;
}

static HistoryTrade parseHistory(const QJsonObject& o) {
    HistoryTrade h;
    h.id          = o.value("id").toString();
    h.symbol      = o.value("symbol").toString();
    h.side        = o.value("side").toString();
    h.lots        = o.value("lots").toDouble();
    h.openPrice   = o.value("open_price").toDouble();
    h.closePrice  = o.value("close_price").toDouble();
    h.profit      = o.value("profit").toDouble();
    h.swap        = o.value("swap").toDouble();
    h.commission  = o.value("commission").toDouble();
    h.openedAt    = o.value("opened_at").toString();
    h.closedAt    = o.value("closed_at").toString();
    h.closeReason = o.value("close_reason").toString();
    return h;
}

// --- requests --------------------------------------------------------------

void ApiClient::fetchSymbols() {
    QNetworkReply* r = m_net->get(makeRequest("/symbols"));
    handleReply(r, "symbols", tr("Loading symbols"));
}

void ApiClient::fetchAccount() {
    QNetworkReply* r = m_net->get(makeRequest("/account"));
    handleReply(r, "account", tr("Loading account"));
}

void ApiClient::fetchPrices(const QStringList& symbols) {
    QString path = "/prices";
    if (!symbols.isEmpty()) {
        QUrlQuery q;
        q.addQueryItem("symbols", symbols.join(','));
        path += "?" + q.toString();
    }
    QNetworkReply* r = m_net->get(makeRequest(path));
    handleReply(r, "prices", tr("Loading prices"));
}

void ApiClient::fetchBars(const QString& symbol, const QString& timeframe, int limit) {
    QUrlQuery q;
    q.addQueryItem("symbol", symbol);
    q.addQueryItem("timeframe", timeframe);
    q.addQueryItem("limit", QString::number(limit));
    QNetworkReply* r = m_net->get(makeRequest("/bars?" + q.toString()));
    handleReply(r, "bars", tr("Loading chart for %1").arg(symbol));
}

void ApiClient::fetchPositions() {
    QNetworkReply* r = m_net->get(makeRequest("/positions"));
    handleReply(r, "positions", tr("Loading positions"));
}

void ApiClient::fetchOrders() {
    QNetworkReply* r = m_net->get(makeRequest("/orders"));
    handleReply(r, "orders", tr("Loading orders"));
}

void ApiClient::fetchHistory(int limit) {
    QNetworkReply* r = m_net->get(makeRequest(QString("/history?limit=%1").arg(limit)));
    handleReply(r, "history", tr("Loading history"));
}

void ApiClient::placeOrder(const QString& action, const QString& symbol, double volume,
                           double sl, double tp, const QString& comment) {
    QJsonObject body;
    body["action"] = action.toUpper();
    body["symbol"] = symbol;
    body["volume"] = volume;
    if (sl > 0.0) body["sl"] = sl;
    if (tp > 0.0) body["tp"] = tp;
    if (!comment.isEmpty()) body["comment"] = comment;

    QNetworkReply* r = m_net->post(makeRequest("/trade"),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    handleReply(r, "trade", tr("Placing %1 %2").arg(action, symbol));
}

void ApiClient::closePositions(const QString& symbol) {
    QJsonObject body;
    body["action"] = "CLOSE";
    body["symbol"] = symbol;
    QNetworkReply* r = m_net->post(makeRequest("/trade"),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    handleReply(r, "trade", tr("Closing %1").arg(symbol));
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
    QJsonObject body;
    body["stop_loss"]   = sl > 0.0 ? QJsonValue(sl) : QJsonValue(QJsonValue::Null);
    body["take_profit"] = tp > 0.0 ? QJsonValue(tp) : QJsonValue(QJsonValue::Null);
    QNetworkReply* r = m_net->put(v1Request("/positions/" + positionId),
                                  QJsonDocument(body).toJson(QJsonDocument::Compact));
    handlePositionOp(this, r, positionId, "modify");
}

void ApiClient::closePositionById(const QString& positionId) {
    QNetworkReply* r = m_net->post(v1Request("/positions/" + positionId + "/close"),
                                   QByteArray("{}"));
    handlePositionOp(this, r, positionId, "close");
}

// --- reply dispatch --------------------------------------------------------

void ApiClient::handleReply(QNetworkReply* reply, const QString& kind, const QString& context) {
    connect(reply, &QNetworkReply::finished, this, [this, reply, kind, context]() {
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
            QVector<SymbolSpec> out;
            for (const QJsonValue& v : obj.value("symbols").toArray())
                out.push_back(parseSymbol(v.toObject()));
            emit symbolsReceived(out);
        } else if (kind == "account") {
            emit accountReceived(parseAccount(obj));
        } else if (kind == "prices") {
            QVector<Quote> out;
            for (const QJsonValue& v : obj.value("prices").toArray())
                out.push_back(parseQuote(v.toObject()));
            emit pricesReceived(out);
        } else if (kind == "bars") {
            QVector<Bar> out;
            for (const QJsonValue& v : obj.value("bars").toArray())
                out.push_back(parseBar(v.toObject()));
            emit barsReceived(obj.value("symbol").toString(),
                              obj.value("timeframe").toString(), out);
        } else if (kind == "positions") {
            QVector<OpenPosition> out;
            for (const QJsonValue& v : obj.value("positions").toArray())
                out.push_back(parsePosition(v.toObject()));
            emit positionsReceived(out);
        } else if (kind == "orders") {
            QVector<PendingOrder> out;
            for (const QJsonValue& v : obj.value("orders").toArray())
                out.push_back(parseOrder(v.toObject()));
            emit ordersReceived(out);
        } else if (kind == "history") {
            QVector<HistoryTrade> out;
            for (const QJsonValue& v : obj.value("history").toArray())
                out.push_back(parseHistory(v.toObject()));
            emit historyReceived(out);
        } else if (kind == "trade") {
            TradeResult t;
            t.status      = obj.value("status").toString();
            t.ok          = (t.status == "filled" || t.status == "closed" || t.status == "no_positions");
            t.symbol      = obj.value("symbol").toString();
            t.action      = obj.value("action").toString();
            t.lots        = obj.value("lots").toDouble();
            t.price       = obj.value("price").toDouble();
            t.positionId  = obj.value("position_id").toString();
            t.orderId     = obj.value("order_id").toString();
            t.closedCount = obj.value("closed_count").toInt();
            t.totalProfit = obj.value("total_profit").toDouble();
            t.message     = obj.value("message").toString();
            emit tradeResult(t);
        }
    });
}
