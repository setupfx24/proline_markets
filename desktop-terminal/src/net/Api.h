#pragma once

#include <QObject>
#include <QString>
#include <QList>
#include <functional>
#include <optional>

#include "models/Account.h"
#include "models/AccountSummary.h"
#include "models/Instrument.h"
#include "models/Position.h"
#include "models/Order.h"
#include "models/Bar.h"

class Session;
class RestClient;

// Parameters for POST /api/v1/orders. Optional fields are omitted from the body
// when unset. `price` is required for non-market order types.
struct OrderRequest {
    QString accountId;
    QString symbol;
    QString orderType = QStringLiteral("market"); // market | limit | stop | stop_limit
    QString side      = QStringLiteral("buy");    // buy | sell
    double  lots = 0.0;
    std::optional<double> price;
    std::optional<double> stopLoss;
    std::optional<double> takeProfit;
    std::optional<double> stopLimitPrice;
    QString comment;
};

// High-level, typed wrapper around the gateway endpoints. Owns nothing but a
// RestClient + Session (not owning). Parses responses into model structs and
// updates the Session on login.
class Api : public QObject
{
    Q_OBJECT
public:
    Api(RestClient *rest, Session *session, QObject *parent = nullptr);

    // POST /api/v1/auth/login. On success stores the token in Session.
    // cb(ok, error, needTotp) — needTotp=true means the server wants a 2FA code
    // (reveal the field and retry with it filled in).
    using LoginCallback =
        std::function<void(bool ok, const QString &error, bool needTotp)>;
    void login(const QString &email, const QString &password,
               const QString &totpCode, LoginCallback cb);

    // GET /api/v1/accounts -> list of trading accounts.
    using AccountsCallback =
        std::function<void(bool ok, const QList<Account> &accounts,
                           const QString &error)>;
    void fetchAccounts(AccountsCallback cb);

    // GET /api/v1/instruments/?active_only=true -> tradable instruments.
    using InstrumentsCallback =
        std::function<void(bool ok, const QList<Instrument> &instruments,
                           const QString &error)>;
    void fetchInstruments(InstrumentsCallback cb);

    // GET /api/v1/instruments/{symbol}/bars?resolution=..&from=..&to=..
    // (TradingView UDF; from/to are epoch seconds).
    using BarsCallback =
        std::function<void(bool ok, const QList<Bar> &bars, const QString &error)>;
    void fetchBars(const QString &symbol, const QString &resolution,
                   qint64 fromSec, qint64 toSec, BarsCallback cb);

    // GET /api/v1/accounts/{id}/summary -> live equity/margin/pnl.
    using SummaryCallback =
        std::function<void(bool ok, const AccountSummary &summary,
                           const QString &error)>;
    void fetchAccountSummary(const QString &accountId, SummaryCallback cb);

    // POST /api/v1/orders/ -> places a market or pending order.
    using PlaceOrderCallback =
        std::function<void(bool ok, const Order &order, const QString &error)>;
    void placeOrder(const OrderRequest &req, PlaceOrderCallback cb);

    // GET /api/v1/positions/?account_id=..&status=open
    using PositionsCallback =
        std::function<void(bool ok, const QList<Position> &positions,
                           const QString &error)>;
    void fetchPositions(const QString &accountId, PositionsCallback cb);

    // GET /api/v1/orders/?account_id=..&status=pending
    using OrdersCallback =
        std::function<void(bool ok, const QList<Order> &orders,
                           const QString &error)>;
    void fetchPendingOrders(const QString &accountId, OrdersCallback cb);

    // Simple ok/error results for mutations.
    using ResultCallback =
        std::function<void(bool ok, const QString &error)>;

    // POST /api/v1/positions/{id}/close  (omit lots for a full close).
    void closePosition(const QString &positionId,
                       std::optional<double> lots, ResultCallback cb);
    // PUT /api/v1/positions/{id}  (SL/TP; pass std::nullopt to leave unchanged).
    void modifyPosition(const QString &positionId,
                        std::optional<double> stopLoss,
                        std::optional<double> takeProfit, ResultCallback cb);
    // DELETE /api/v1/orders/{id}
    void cancelOrder(const QString &orderId, ResultCallback cb);

private:
    RestClient *m_rest;
    Session *m_session;
};
