#include "core/ApiClient.h"
#include "core/ApiError.h"
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkCookie>
#include <QUrl>
#include <QUrlQuery>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>
#include <QHash>

ApiClient::ApiClient(const Config& cfg, QObject* parent)
    : QObject(parent), m_cfg(cfg), m_net(new QNetworkAccessManager(this)) {}

QNetworkRequest ApiClient::makeRequest(const QString& path) const {
    QNetworkRequest req{QUrl(m_cfg.restBase + path)};
    // These are the /api/algo endpoints, and that gateway validates ONLY
    // X-Api-Key + X-Api-Secret — it rejects a user JWT with "Missing X-Api-Key
    // or X-Api-Secret". So the key wins whenever we have one; the token is a
    // fallback for deployments whose algo gateway accepts it.
    if (!m_cfg.apiKey.isEmpty() && !m_cfg.apiSecret.isEmpty()) {
        req.setRawHeader("X-Api-Key",    m_cfg.apiKey.toUtf8());
        req.setRawHeader("X-Api-Secret", m_cfg.apiSecret.toUtf8());
    } else if (!m_cfg.token.isEmpty()) {
        req.setRawHeader("Authorization", ("Bearer " + m_cfg.token).toUtf8());
        req.setRawHeader("X-Account-Id",  m_cfg.accountId.toUtf8());
    }
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    return req;
}

void ApiClient::renewAlgoKey() {
    // An investor cannot hold an algo key — /api/v1/algo/generate is one of the
    // routes forbid_investor blocks — and does not need one: in this mode the
    // reads and the tick stream both run off the session JWT.
    if (m_cfg.readOnly) return;
    if (m_cfg.token.trimmed().isEmpty() || m_cfg.accountId.trimmed().isEmpty()) {
        emit algoKeyRenewed(false, QString(), QString(),
                            tr("Sign in again to restore market data."));
        return;
    }
    QJsonObject body;
    body["account_id"] = m_cfg.accountId;
    body["label"]      = QStringLiteral("Proline Markets Terminal");

    QNetworkReply* r = m_net->post(v1Request("/algo/generate"),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(r, &QNetworkReply::finished, this, [this, r]() {
        r->deleteLater();
        const int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
        const bool ok = (r->error() == QNetworkReply::NoError && http < 400);
        const QString key = o.value("api_key").toString();
        const QString sec = o.value("api_secret").toString();
        if (ok && !key.isEmpty() && !sec.isEmpty()) {
            // Keep our own copy in step — the very next REST call signs with it.
            m_cfg.apiKey    = key;
            m_cfg.apiSecret = sec;
            emit algoKeyRenewed(true, key, sec, QString());
        } else {
            emit algoKeyRenewed(false, QString(), QString(), apiDetail(o, r->errorString()));
        }
    });
}

void ApiClient::shareTrade(const QString& positionId) {
    if (rejectReadOnly(tr("Sharing trade"))) {
        emit shareLinkReady(positionId, false, QString(), kReadOnlyMsg());
        return;
    }
    // The server reuses a live card for the same position rather than minting a
    // second one, so pressing Share twice yields the same link.
    QJsonObject body;
    body["display_mode"] = QStringLiteral("pnl");

    QNetworkReply* r = m_net->post(v1Request("/positions/" + positionId + "/share"),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(r, &QNetworkReply::finished, this, [this, r, positionId]() {
        r->deleteLater();
        const int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
        const bool ok = (r->error() == QNetworkReply::NoError && http < 400);
        const QString code = o.value("short_code").toString();
        if (ok && !code.isEmpty()) emit shareLinkReady(positionId, true, code, QString());
        else emit shareLinkReady(positionId, false, QString(), apiDetail(o, r->errorString()));
    });
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

// /api/v1 renders Decimal columns as JSON STRINGS ("0.0100"), while /api/algo
// sends plain numbers. QJsonValue::toDouble() returns 0 for a string, which
// silently gave every instrument a 0 lot step, so read both forms.
static double numField(const QJsonObject& o, const char* key, double fallback = 0.0) {
    const QJsonValue v = o.value(QString::fromLatin1(key));
    if (v.isDouble()) return v.toDouble();
    if (v.isString()) {
        bool ok = false;
        const double d = v.toString().toDouble(&ok);
        if (ok) return d;
    }
    return fallback;
}

// GET /api/v1/instruments/ — same instrument, different field names.
static SymbolSpec parseSymbolV1(const QJsonObject& o) {
    SymbolSpec s;
    s.symbol       = o.value("symbol").toString();
    s.displayName  = o.value("display_name").toString(s.symbol);
    s.category     = o.value("segment").toString();   // algo calls this "category"
    s.digits       = o.value("digits").toInt(5);
    s.minLot       = numField(o, "min_lot", 0.01);
    s.maxLot       = numField(o, "max_lot", 100.0);
    s.lotStep      = numField(o, "lot_step", 0.01);
    s.contractSize = numField(o, "contract_size", 100000.0);
    return s;
}

// One entry of GET /api/v1/accounts. The algo gateway's /account calls the
// number "account" and returns only the selected one.
static AccountInfo parseAccountV1(const QJsonObject& o) {
    AccountInfo a;
    a.account       = o.value("account_number").toString();
    a.currency      = o.value("currency").toString("USD");
    a.leverage      = o.value("leverage").toInt(100);
    a.balance       = numField(o, "balance");
    a.credit        = numField(o, "credit");
    a.equity        = numField(o, "equity");
    a.marginUsed    = numField(o, "margin_used");
    a.freeMargin    = numField(o, "free_margin");
    a.marginLevel   = numField(o, "margin_level");
    a.isDemo        = o.value("is_demo").toBool();
    a.openPositions = o.value("open_positions").toInt();
    a.valid         = !a.account.isEmpty();
    return a;
}

// GET /api/v1/instruments/{symbol}/bars — TradingView shape: `time` is epoch
// SECONDS, not the ISO string the algo gateway sends.
static Bar parseBarV1(const QJsonObject& o) {
    Bar b;
    b.time   = QDateTime::fromSecsSinceEpoch(
                   static_cast<qint64>(o.value("time").toDouble()), Qt::UTC);
    b.open   = numField(o, "open");
    b.high   = numField(o, "high");
    b.low    = numField(o, "low");
    b.close  = numField(o, "close");
    b.volume = numField(o, "volume");
    return b;
}

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

// The two gateways spell several fields differently (the algo connector used
// sl/tp/opened_at/profit; the platform API uses stop_loss/take_profit/
// created_at/pnl). Read whichever is present so one build works against both.
static QString firstString(const QJsonObject& o, std::initializer_list<const char*> keys) {
    for (const char* k : keys)
        if (o.contains(k) && !o.value(k).isNull()) return o.value(k).toString();
    return {};
}
static double firstDouble(const QJsonObject& o, std::initializer_list<const char*> keys) {
    for (const char* k : keys)
        if (o.contains(k) && !o.value(k).isNull()) return o.value(k).toDouble();
    return 0.0;
}

static OpenPosition parsePosition(const QJsonObject& o) {
    OpenPosition p;
    p.id           = o.value("id").toString();
    p.symbol       = o.value("symbol").toString();
    p.side         = o.value("side").toString();
    p.lots         = o.value("lots").toDouble();
    p.openPrice    = firstDouble(o, {"open_price"});
    p.currentPrice = firstDouble(o, {"current_price"});
    p.sl           = firstDouble(o, {"sl", "stop_loss"});
    p.tp           = firstDouble(o, {"tp", "take_profit"});
    p.swap         = o.value("swap").toDouble();
    p.commission   = o.value("commission").toDouble();
    p.profit       = firstDouble(o, {"profit", "pnl"});
    p.openedAt     = firstString(o, {"opened_at", "created_at"});
    p.comment      = o.value("comment").toString();
    return p;
}

static PendingOrder parseOrder(const QJsonObject& o) {
    PendingOrder p;
    p.id        = o.value("id").toString();
    p.symbol    = o.value("symbol").toString();
    p.type      = firstString(o, {"type", "order_type"});
    p.side      = o.value("side").toString();
    p.lots      = o.value("lots").toDouble();
    p.price     = firstDouble(o, {"price"});
    p.sl        = firstDouble(o, {"sl", "stop_loss"});
    p.tp        = firstDouble(o, {"tp", "take_profit"});
    p.createdAt = firstString(o, {"created_at"});
    p.comment   = o.value("comment").toString();
    p.status    = o.value("status").toString();
    return p;
}

static Transaction parseTransaction(const QJsonObject& o) {
    Transaction t;
    t.id          = o.value("id").toString();
    t.type        = o.value("type").toString();
    t.method      = o.value("method").toString();
    t.description = o.value("description").toString();
    t.currency    = o.value("currency").toString("USD");
    t.amount      = o.value("amount").toDouble();
    t.createdAt   = firstString(o, {"created_at"});
    return t;
}

static HistoryTrade parseHistory(const QJsonObject& o) {
    HistoryTrade h;
    h.id          = o.value("id").toString();
    h.symbol      = o.value("symbol").toString();
    h.side        = o.value("side").toString();
    h.lots        = o.value("lots").toDouble();
    h.openPrice   = firstDouble(o, {"open_price"});
    h.closePrice  = firstDouble(o, {"close_price"});
    h.profit      = firstDouble(o, {"profit", "pnl"});
    h.swap        = o.value("swap").toDouble();
    h.commission  = o.value("commission").toDouble();
    h.openedAt    = firstString(o, {"opened_at"});
    h.closedAt    = firstString(o, {"closed_at", "close_time"});
    h.closeReason = o.value("close_reason").toString();
    return h;
}

// --- read-only (investor) guard --------------------------------------------

// Investor sessions carry role=investor, and the gateway 403s every write. The
// UI hides these actions, but a keyboard shortcut, a dragged chart line or a
// stale dialog can still reach the client — so nothing mutating leaves here.
QString ApiClient::kReadOnlyMsg() {
    return tr("Investor access is read-only — trading is disabled.");
}

bool ApiClient::rejectReadOnly(const QString& context) {
    if (!m_cfg.readOnly) return false;
    emit errorOccurred(context, kReadOnlyMsg(), 403);
    return true;
}

// --- requests --------------------------------------------------------------

// The terminal's timeframe strings ("5m", "1h", …) in the resolution spelling
// GET /api/v1/instruments/{symbol}/bars expects, plus the bar length in
// seconds so the request can ask for a bounded window instead of everything.
static QString v1Resolution(const QString& tf) {
    static const QHash<QString, QString> map{
        {"1m", "1"}, {"5m", "5"}, {"15m", "15"}, {"30m", "30"},
        {"1h", "60"}, {"4h", "240"}, {"1d", "1D"},
    };
    return map.value(tf.toLower(), "5");
}
static qint64 v1BarSeconds(const QString& tf) {
    static const QHash<QString, qint64> map{
        {"1m", 60}, {"5m", 300}, {"15m", 900}, {"30m", 1800},
        {"1h", 3600}, {"4h", 14400}, {"1d", 86400},
    };
    return map.value(tf.toLower(), 300);
}

void ApiClient::fetchSymbols() {
    if (m_cfg.readOnly) {
        // Public endpoint, but go through v1Request so the session header is
        // attached like every other read in this mode.
        QNetworkReply* r = m_net->get(v1Request("/instruments/"));
        handleReply(r, "symbols_v1", tr("Loading symbols"));
        return;
    }
    QNetworkReply* r = m_net->get(makeRequest("/symbols"));
    handleReply(r, "symbols", tr("Loading symbols"));
}

void ApiClient::fetchAccount() {
    if (m_cfg.readOnly) {
        // /api/v1/accounts returns the list; for an investor token the gateway
        // already scopes it to what the credential may see. The selected one is
        // picked out in handleReply.
        QNetworkReply* r = m_net->get(v1Request("/accounts"));
        handleReply(r, "account_v1", tr("Loading account"));
        return;
    }
    QNetworkReply* r = m_net->get(makeRequest("/account"));
    handleReply(r, "account", tr("Loading account"));
}

void ApiClient::fetchPrices(const QStringList& symbols) {
    if (m_cfg.readOnly) {
        // No per-symbol filter on this one — it returns every live tick, which
        // is what the watchlist wants anyway.
        QNetworkReply* r = m_net->get(v1Request("/instruments/prices/all"));
        handleReply(r, "prices_v1", tr("Loading prices"));
        return;
    }
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
    if (m_cfg.readOnly) {
        const qint64 now  = QDateTime::currentSecsSinceEpoch();
        const qint64 span = v1BarSeconds(timeframe) * qMax(1, limit);
        QUrlQuery q;
        q.addQueryItem("resolution", v1Resolution(timeframe));
        q.addQueryItem("from", QString::number(now - span));
        q.addQueryItem("to",   QString::number(now));
        QNetworkReply* r = m_net->get(
            v1Request("/instruments/" + symbol.toUpper() + "/bars?" + q.toString()));
        // The v1 response carries neither symbol nor timeframe, but
        // barsReceived() must report both — the chart routes on them.
        r->setProperty("pm_symbol", symbol);
        r->setProperty("pm_timeframe", timeframe);
        handleReply(r, "bars_v1", tr("Loading chart for %1").arg(symbol));
        return;
    }
    QUrlQuery q;
    q.addQueryItem("symbol", symbol);
    q.addQueryItem("timeframe", timeframe);
    q.addQueryItem("limit", QString::number(limit));
    QNetworkReply* r = m_net->get(makeRequest("/bars?" + q.toString()));
    handleReply(r, "bars", tr("Loading chart for %1").arg(symbol));
}

// Open positions, pending orders and closed-trade history are NOT part of the
// algo gateway — it only serves symbols/price/prices/bars/account/trade. They
// live on the platform API under /api/v1, keyed by account_id and authenticated
// with the user's JWT, which is why the blotter stayed empty while the chart
// worked. Trades placed from the website land in the same tables, so this is
// also what makes them visible here.
void ApiClient::fetchPositions() {
    if (m_cfg.accountId.isEmpty()) return;
    QNetworkReply* r = m_net->get(v1Request(
        QString("/positions/?account_id=%1&status=open").arg(m_cfg.accountId)));
    handleReply(r, "positions", tr("Loading positions"));
}

void ApiClient::fetchTransactions() {
    if (m_cfg.accountId.isEmpty()) return;
    // Scoped to the selected account. Without account_id the endpoint returns
    // the USER's whole ledger across every account, which is not what a
    // per-account blotter tab should show.
    QNetworkReply* r = m_net->get(
        v1Request("/wallet/transactions?account_id=" + m_cfg.accountId));
    handleReply(r, "transactions", tr("Loading transactions"));
}

void ApiClient::fetchOrders() {
    if (m_cfg.accountId.isEmpty()) return;
    // status=pending, like fetchPositions asks for status=open. Without it the
    // endpoint returns EVERY order the account ever placed — filled market
    // orders included — and they all landed in the Pending tab, where the only
    // action offered is cancel. The server then rightly answered "Can only
    // cancel pending order" on each one.
    QNetworkReply* r = m_net->get(v1Request(
        QString("/orders/?account_id=%1&status=pending").arg(m_cfg.accountId)));
    handleReply(r, "orders", tr("Loading orders"));
}

void ApiClient::fetchHistory(int limit) {
    if (m_cfg.accountId.isEmpty()) return;
    QNetworkReply* r = m_net->get(v1Request(
        QString("/portfolio/trades?account_id=%1&per_page=%2").arg(m_cfg.accountId).arg(limit)));
    handleReply(r, "history", tr("Loading history"));
}

void ApiClient::placeOrder(const QString& action, const QString& symbol, double volume,
                           double sl, double tp, const QString& comment) {
    if (rejectReadOnly(tr("Placing %1 %2").arg(action, symbol))) {
        TradeResult tr_;
        tr_.ok = false;
        tr_.status = "error";
        tr_.message = kReadOnlyMsg();
        emit tradeResult(tr_);
        return;
    }
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
    if (rejectReadOnly(tr("Closing %1").arg(symbol))) {
        TradeResult tr_;
        tr_.ok = false;
        tr_.status = "error";
        tr_.message = kReadOnlyMsg();
        emit tradeResult(tr_);
        return;
    }
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
                msg = apiDetail(obj, reply->errorString());
            }
            emit self->positionOpResult(positionId, op, ok, msg);
        });
}

// Shared reply handling for the two order operations. Both answer with a
// FastAPI body, so the reason comes out through apiDetail() and reaches the
// user instead of Qt's generic "server replied: Bad Request".
static void handleOrderOp(ApiClient* self, QNetworkReply* reply, const QString& op) {
    QObject::connect(reply, &QNetworkReply::finished, self, [self, reply, op]() {
        reply->deleteLater();
        const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(reply->readAll()).object();
        const bool ok = (reply->error() == QNetworkReply::NoError && http < 400);
        emit self->orderOpResult(
            op, ok,
            ok ? (op == "cancel" ? QObject::tr("Order cancelled")
                                 : QObject::tr("Pending order placed"))
               : apiDetail(o, reply->errorString()));
    });
}

void ApiClient::placePendingOrder(const QString& symbol, const QString& side,
                                  const QString& type, double lots, double price,
                                  double sl, double tp, const QString& comment) {
    if (rejectReadOnly(tr("Placing order"))) {
        emit orderOpResult("place", false, kReadOnlyMsg());
        return;
    }
    QJsonObject body;
    body["account_id"] = m_cfg.accountId;
    body["symbol"]     = symbol;
    body["order_type"] = type.toLower();     // limit | stop
    body["side"]       = side.toLower();     // buy | sell
    body["lots"]       = lots;
    body["price"]      = price;
    if (sl > 0.0) body["stop_loss"]   = sl;
    if (tp > 0.0) body["take_profit"] = tp;
    body["comment"] = comment.isEmpty() ? QStringLiteral("terminal") : comment;

    QNetworkReply* r = m_net->post(v1Request("/orders/"),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    handleOrderOp(this, r, "place");
}

void ApiClient::modifyPendingOrder(const QString& orderId, double price, double lots,
                                   double sl, double tp) {
    if (rejectReadOnly(tr("Modifying order"))) {
        emit orderOpResult("modify", false, kReadOnlyMsg());
        return;
    }
    QJsonObject body;
    if (price >= 0.0) body["price"] = price;
    if (lots  >  0.0) body["lots"]  = lots;
    // 0 is a real instruction here ("remove the bracket"), so the sentinel for
    // "leave alone" has to be negative rather than 0.
    if (sl >= 0.0) body["stop_loss"]   = sl > 0.0 ? QJsonValue(sl) : QJsonValue(QJsonValue::Null);
    if (tp >= 0.0) body["take_profit"] = tp > 0.0 ? QJsonValue(tp) : QJsonValue(QJsonValue::Null);
    if (body.isEmpty()) return;                 // nothing to send

    QNetworkReply* r = m_net->put(v1Request("/orders/" + orderId),
                                  QJsonDocument(body).toJson(QJsonDocument::Compact));
    handleOrderOp(this, r, "modify");
}

void ApiClient::cancelOrder(const QString& orderId) {
    if (rejectReadOnly(tr("Cancelling order"))) {
        emit orderOpResult("cancel", false, kReadOnlyMsg());
        return;
    }
    QNetworkReply* r = m_net->deleteResource(v1Request("/orders/" + orderId));
    handleOrderOp(this, r, "cancel");
}

void ApiClient::modifyBracket(const QString& positionId, const QString& kind, double level) {
    if (rejectReadOnly(tr("Modifying SL/TP"))) {
        emit positionOpResult(positionId, kind, false, kReadOnlyMsg());
        return;
    }
    const QString field = (kind == "tp") ? "take_profit" : "stop_loss";

    // level <= 0 means "remove this bracket", sent as an explicit JSON null.
    //
    // This used to be refused outright, because the server applied the update
    // with `if req.stop_loss is not None` — null read as "leave it alone", so
    // a removal answered 200 and the old level was back on the next poll. The
    // endpoint now keys off the fields the client actually sent, so null
    // genuinely clears. Only ONE field is ever sent, and the untouched one is
    // omitted rather than nulled, which is what stops a stop-loss edit from
    // wiping the take profit.
    QJsonObject body;
    if (level > 0.0) body[field] = level;
    else             body[field] = QJsonValue(QJsonValue::Null);
    QNetworkReply* r = m_net->put(v1Request("/positions/" + positionId),
                                  QJsonDocument(body).toJson(QJsonDocument::Compact));
    handlePositionOp(this, r, positionId, "modify");
}

// The refresh cookie is sent by hand rather than through a cookie jar: the
// terminal's managers are per-widget and none of them outlives a restart, so
// the credential has to travel in Config, not in QNetworkAccessManager.
void ApiClient::refreshSession() {
    if (m_cfg.refreshToken.trimmed().isEmpty()) {
        emit sessionRefreshFailed(tr("No stored session to refresh."));
        return;
    }
    QString base = m_cfg.restBase;
    base.replace("/api/algo", "/api/v1");

    QNetworkRequest req{QUrl(base + "/auth/refresh")};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setRawHeader("Cookie", ("pt_refresh=" + m_cfg.refreshToken).toUtf8());
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);

    QNetworkReply* r = m_net->post(req, QByteArray("{}"));
    connect(r, &QNetworkReply::finished, this, [this, r]() {
        r->deleteLater();
        const int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
        if (r->error() != QNetworkReply::NoError || http >= 400) {
            emit sessionRefreshFailed(apiDetail(o, r->errorString()));
            return;
        }
        const QString access = o.value("access_token").toString();

        // Pick the replacement refresh cookie out of Set-Cookie. Missing it
        // would leave the old, now-invalidated token in Config and every later
        // refresh would 401 — the failure mode is silent until the session dies.
        QString newRefresh;
        const QVariant sc = r->header(QNetworkRequest::SetCookieHeader);
        for (const QNetworkCookie& ck : sc.value<QList<QNetworkCookie>>())
            if (ck.name() == "pt_refresh") newRefresh = QString::fromUtf8(ck.value());

        if (access.isEmpty()) { emit sessionRefreshFailed(tr("Refresh returned no token.")); return; }
        emit sessionRefreshed(access, newRefresh);
    });
}

void ApiClient::closePositionById(const QString& positionId, double lots) {
    if (rejectReadOnly(tr("Closing position"))) {
        emit positionOpResult(positionId, "close", false, kReadOnlyMsg());
        return;
    }
    // The endpoint takes an optional "lots". Omitting it means close the whole
    // position, so a full close sends {} rather than the size — the server then
    // uses its own record of the position instead of trusting a number this
    // client may have read one poll ago.
    QByteArray body("{}");
    if (lots > 0.0) {
        QJsonObject o;
        o["lots"] = lots;
        body = QJsonDocument(o).toJson(QJsonDocument::Compact);
    }
    QNetworkReply* r = m_net->post(v1Request("/positions/" + positionId + "/close"), body);
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
            const QString detail = apiDetail(obj, reply->errorString());
            if (kind == "trade") {
                // Surface trade failures both as a result and an error.
                TradeResult tr_;
                tr_.ok = false;
                tr_.status = "error";
                tr_.message = detail;
                emit tradeResult(tr_);
            }
            emit errorOccurred(context, detail, http);
            return;
        }

        if (kind == "symbols_v1") {
            // A bare array, not {symbols:[…]}.
            QVector<SymbolSpec> out;
            for (const QJsonValue& v : (doc.isArray() ? doc.array()
                                                      : obj.value("instruments").toArray()))
                out.push_back(parseSymbolV1(v.toObject()));
            emit symbolsReceived(out);
        } else if (kind == "account_v1") {
            const QJsonArray arr = doc.isArray() ? doc.array()
                                                 : obj.value("accounts").toArray();
            // Match the selected account; fall back to the only/first one so a
            // session whose accountId is stale still shows something.
            QJsonObject picked;
            for (const QJsonValue& v : arr) {
                const QJsonObject a = v.toObject();
                if (a.value("id").toString() == m_cfg.accountId) { picked = a; break; }
            }
            if (picked.isEmpty() && !arr.isEmpty()) picked = arr.first().toObject();
            if (!picked.isEmpty()) emit accountReceived(parseAccountV1(picked));
        } else if (kind == "prices_v1") {
            QVector<Quote> out;
            for (const QJsonValue& v : (doc.isArray() ? doc.array()
                                                      : obj.value("prices").toArray()))
                out.push_back(parseQuote(v.toObject()));
            emit pricesReceived(out);
        } else if (kind == "bars_v1") {
            QVector<Bar> out;
            for (const QJsonValue& v : obj.value("bars").toArray())
                out.push_back(parseBarV1(v.toObject()));
            emit barsReceived(reply->property("pm_symbol").toString(),
                              reply->property("pm_timeframe").toString(), out);
        } else if (kind == "symbols") {
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
        } else if (kind == "transactions") {
            QJsonArray arr = doc.isArray() ? doc.array()
                           : obj.contains("items") ? obj.value("items").toArray()
                                                   : obj.value("transactions").toArray();
            QVector<Transaction> out;
            for (const QJsonValue& v : arr) out.push_back(parseTransaction(v.toObject()));
            emit transactionsReceived(out);
        } else if (kind == "positions" || kind == "orders" || kind == "history") {
            // Three shapes in the wild: a bare array (platform positions and
            // orders), {"items": [...]} (paged history), and {"<kind>": [...]}
            // (the old algo gateway).
            QJsonArray arr;
            if (doc.isArray())                       arr = doc.array();
            else if (obj.contains("items"))          arr = obj.value("items").toArray();
            else                                     arr = obj.value(kind).toArray();

            if (kind == "positions") {
                QVector<OpenPosition> out;
                for (const QJsonValue& v : arr) out.push_back(parsePosition(v.toObject()));
                emit positionsReceived(out);
            } else if (kind == "orders") {
                QVector<PendingOrder> out;
                for (const QJsonValue& v : arr) {
                    PendingOrder p = parseOrder(v.toObject());
                    // Belt and braces over the status=pending query above: an
                    // order that is already filled, cancelled or expired must
                    // never reach a tab whose only control is Cancel. An empty
                    // status is kept — some payloads omit the field, and
                    // hiding a real pending order would be the worse failure.
                    if (!p.status.isEmpty() &&
                        p.status.compare("pending", Qt::CaseInsensitive) != 0) continue;
                    out.push_back(p);
                }
                emit ordersReceived(out);
            } else {
                QVector<HistoryTrade> out;
                for (const QJsonValue& v : arr) out.push_back(parseHistory(v.toObject()));
                emit historyReceived(out);
            }
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
