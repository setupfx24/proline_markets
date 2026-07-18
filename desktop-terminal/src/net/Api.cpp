#include "net/Api.h"
#include "net/RestClient.h"
#include "core/Session.h"

#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>

Api::Api(RestClient *rest, Session *session, QObject *parent)
    : QObject(parent)
    , m_rest(rest)
    , m_session(session)
{
}

void Api::login(const QString &email, const QString &password,
                const QString &totpCode, LoginCallback cb)
{
    QJsonObject body{
        { QStringLiteral("email"), email },
        { QStringLiteral("password"), password },
    };
    if (!totpCode.isEmpty())
        body.insert(QStringLiteral("totp_code"), totpCode);

    m_rest->post(QStringLiteral("/api/v1/auth/login"), body,
                 [this, cb = std::move(cb)](bool ok, int status,
                                            const QJsonValue &data,
                                            const QString &error) {
        if (!ok) {
            // The gateway asks for a 2FA code with HTTP 400 "2FA code required".
            const bool needTotp =
                error.contains(QStringLiteral("2FA"), Qt::CaseInsensitive) &&
                error.contains(QStringLiteral("required"), Qt::CaseInsensitive);
            cb(false, error, needTotp);
            return;
        }

        const QJsonObject o = data.toObject();
        const QString token = o.value(QStringLiteral("access_token")).toString();
        if (token.isEmpty()) {
            // Body token disabled server-side (JWT_INCLUDE_LEGACY_JSON_TOKEN=false).
            // Cookie-based auth would be needed — not supported yet in the client.
            cb(false,
               QStringLiteral("Server did not return an access token "
                              "(legacy JSON token disabled)."),
               false);
            return;
        }

        const QDateTime expires = QDateTime::fromString(
            o.value(QStringLiteral("expires_at")).toString(), Qt::ISODate);
        m_session->setAuth(token,
                           o.value(QStringLiteral("user_id")).toString(),
                           o.value(QStringLiteral("role")).toString(),
                           expires);
        cb(true, QString(), false);
    });
}

void Api::fetchAccounts(AccountsCallback cb)
{
    m_rest->get(QStringLiteral("/api/v1/accounts"),
                [cb = std::move(cb)](bool ok, int status,
                                     const QJsonValue &data,
                                     const QString &error) {
        if (!ok) {
            cb(false, {}, error);
            return;
        }
        // Response shape: { "items": [ {...}, ... ] }
        QList<Account> accounts;
        const QJsonArray items = data.toObject()
                                     .value(QStringLiteral("items")).toArray();
        for (const QJsonValue &v : items)
            accounts.append(Account::fromJson(v.toObject()));
        cb(true, accounts, QString());
    });
}

void Api::fetchInstruments(InstrumentsCallback cb)
{
    m_rest->get(QStringLiteral("/api/v1/instruments/?active_only=true"),
                [cb = std::move(cb)](bool ok, int status,
                                     const QJsonValue &data,
                                     const QString &error) {
        if (!ok) {
            cb(false, {}, error);
            return;
        }
        // Response is a JSON array of InstrumentResponse objects.
        QList<Instrument> instruments;
        const QJsonArray arr = data.toArray();
        for (const QJsonValue &v : arr)
            instruments.append(Instrument::fromJson(v.toObject()));
        cb(true, instruments, QString());
    });
}

void Api::fetchBars(const QString &symbol, const QString &resolution,
                    qint64 fromSec, qint64 toSec, BarsCallback cb)
{
    const QString path = QStringLiteral(
        "/api/v1/instruments/%1/bars?resolution=%2&from=%3&to=%4")
        .arg(symbol, resolution)
        .arg(fromSec).arg(toSec);
    m_rest->get(path, [cb = std::move(cb)](bool ok, int, const QJsonValue &data,
                                           const QString &error) {
        if (!ok) { cb(false, {}, error); return; }
        const QJsonObject o = data.toObject();
        const QString status = o.value(QStringLiteral("s")).toString();
        if (status != QLatin1String("ok")) {
            cb(true, {}, QString()); // no_data / valid-but-empty
            return;
        }
        QList<Bar> bars;
        for (const QJsonValue &v : o.value(QStringLiteral("bars")).toArray())
            bars.append(Bar::fromJson(v.toObject()));
        cb(true, bars, QString());
    });
}

void Api::fetchAccountSummary(const QString &accountId, SummaryCallback cb)
{
    m_rest->get(QStringLiteral("/api/v1/accounts/%1/summary").arg(accountId),
                [cb = std::move(cb)](bool ok, int, const QJsonValue &data,
                                     const QString &error) {
        if (!ok) { cb(false, {}, error); return; }
        cb(true, AccountSummary::fromJson(data.toObject()), QString());
    });
}

void Api::placeOrder(const OrderRequest &req, PlaceOrderCallback cb)
{
    QJsonObject body{
        { QStringLiteral("account_id"), req.accountId },
        { QStringLiteral("symbol"),     req.symbol },
        { QStringLiteral("order_type"), req.orderType },
        { QStringLiteral("side"),       req.side },
        { QStringLiteral("lots"),       req.lots },
    };
    if (req.price)          body.insert(QStringLiteral("price"), *req.price);
    if (req.stopLoss)       body.insert(QStringLiteral("stop_loss"), *req.stopLoss);
    if (req.takeProfit)     body.insert(QStringLiteral("take_profit"), *req.takeProfit);
    if (req.stopLimitPrice) body.insert(QStringLiteral("stop_limit_price"), *req.stopLimitPrice);
    if (!req.comment.isEmpty()) body.insert(QStringLiteral("comment"), req.comment);

    m_rest->post(QStringLiteral("/api/v1/orders/"), body,
                 [cb = std::move(cb)](bool ok, int, const QJsonValue &data,
                                      const QString &error) {
        if (!ok) { cb(false, Order{}, error); return; }
        cb(true, Order::fromJson(data.toObject()), QString());
    });
}

void Api::fetchPositions(const QString &accountId, PositionsCallback cb)
{
    m_rest->get(QStringLiteral("/api/v1/positions/?account_id=%1&status=open").arg(accountId),
                [cb = std::move(cb)](bool ok, int, const QJsonValue &data,
                                     const QString &error) {
        if (!ok) { cb(false, {}, error); return; }
        QList<Position> positions;
        for (const QJsonValue &v : data.toArray())
            positions.append(Position::fromJson(v.toObject()));
        cb(true, positions, QString());
    });
}

void Api::fetchPendingOrders(const QString &accountId, OrdersCallback cb)
{
    m_rest->get(QStringLiteral("/api/v1/orders/?account_id=%1&status=pending").arg(accountId),
                [cb = std::move(cb)](bool ok, int, const QJsonValue &data,
                                     const QString &error) {
        if (!ok) { cb(false, {}, error); return; }
        QList<Order> orders;
        for (const QJsonValue &v : data.toArray())
            orders.append(Order::fromJson(v.toObject()));
        cb(true, orders, QString());
    });
}

void Api::closePosition(const QString &positionId,
                        std::optional<double> lots, ResultCallback cb)
{
    QJsonObject body;
    if (lots)
        body.insert(QStringLiteral("lots"), *lots);
    m_rest->post(QStringLiteral("/api/v1/positions/%1/close").arg(positionId), body,
                 [cb = std::move(cb)](bool ok, int, const QJsonValue &,
                                      const QString &error) {
        cb(ok, error);
    });
}

void Api::modifyPosition(const QString &positionId,
                         std::optional<double> stopLoss,
                         std::optional<double> takeProfit, ResultCallback cb)
{
    QJsonObject body;
    if (stopLoss)   body.insert(QStringLiteral("stop_loss"), *stopLoss);
    if (takeProfit) body.insert(QStringLiteral("take_profit"), *takeProfit);
    m_rest->put(QStringLiteral("/api/v1/positions/%1").arg(positionId), body,
                [cb = std::move(cb)](bool ok, int, const QJsonValue &,
                                     const QString &error) {
        cb(ok, error);
    });
}

void Api::cancelOrder(const QString &orderId, ResultCallback cb)
{
    m_rest->del(QStringLiteral("/api/v1/orders/%1").arg(orderId),
                [cb = std::move(cb)](bool ok, int, const QJsonValue &,
                                     const QString &error) {
        cb(ok, error);
    });
}
