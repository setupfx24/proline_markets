#pragma once
#include <QObject>
#include <QVector>
#include <QStringList>
#include <QNetworkRequest>
#include "core/Models.h"
#include "core/Config.h"

class QNetworkAccessManager;
class QNetworkReply;

// Async REST client for the Proline Markets Algo API. Each call fires a request
// and emits a corresponding signal when the reply arrives. Auth headers are
// attached automatically from the Config.
class ApiClient : public QObject {
    Q_OBJECT
public:
    explicit ApiClient(const Config& cfg, QObject* parent = nullptr);

    void setConfig(const Config& cfg) { m_cfg = cfg; }
    void setAccountId(const QString& id) { m_cfg.accountId = id; }

    // Fire-and-emit requests
    void fetchSymbols();
    void fetchAccount();
    void fetchPrices(const QStringList& symbols);   // empty => all
    void fetchBars(const QString& symbol, const QString& timeframe, int limit = 300);
    void fetchPositions();
    void fetchOrders();
    void fetchTransactions();   // ledger for the selected account
    void fetchHistory(int limit = 100);

    // action = "BUY" | "SELL". sl/tp <= 0 are omitted.
    void placeOrder(const QString& action, const QString& symbol, double volume,
                    double sl = 0.0, double tp = 0.0, const QString& comment = QString());
    void closePositions(const QString& symbol);

    // Per-position ops via the platform's /api/v1/positions endpoints (JWT).
    // Sends ONLY the bracket being changed ("sl" | "tp"); the endpoint does a
    // partial update, so re-sending the other one from a stale snapshot would
    // silently revert it. level <= 0 asks to remove the bracket.
    // Pending (limit / stop) order. The algo /trade endpoint only fills at
    // market, so this goes to /api/v1/orders with the JWT — same auth as the
    // per-position operations below.
    //   type = "limit" | "stop";  side = "buy" | "sell"
    //   sl/tp <= 0 are omitted.
    void placePendingOrder(const QString& symbol, const QString& side, const QString& type,
                           double lots, double price, double sl = 0.0, double tp = 0.0,
                           const QString& comment = QString());
    // Cancels a pending order. Returns 400 once it has filled, which is why
    // the list is refetched after every action rather than patched in place.
    // Amend a pending order. Only the legs the caller actually changed are
    // sent: PUT /orders/{id} leaves an omitted field alone, so passing every
    // field would rewrite values the trader never touched. Pass a negative to
    // mean "not changing this one"; 0 on sl/tp means "remove".
    void modifyPendingOrder(const QString& orderId, double price, double lots,
                            double sl, double tp);
    void cancelOrder(const QString& orderId);

    // Mints a fresh access token from the stored refresh cookie. The access
    // token lasts ~45 minutes and everything on /api/v1 — per-position close,
    // SL/TP, the wallet — dies with it, so this has to run on a timer rather
    // than waiting for a user to hit "Invalid token" mid-trade.
    void refreshSession();

    void modifyBracket(const QString& positionId, const QString& kind, double level);
    // lots <= 0 (or >= the position's size) closes it fully; a smaller value is
    // a partial close and leaves the remainder open.
    void closePositionById(const QString& positionId, double lots = 0.0);

    // Mint a replacement market-data key pair for the selected account, using
    // the session JWT. Needed mid-session because /algo/generate revokes the
    // account's previous key: any later sign-in elsewhere kills the pair this
    // terminal holds, and only a fresh one gets the tick stream back.
    void renewAlgoKey();
    // Mint (or reuse) the public share card for a position. Answered with
    // shareLinkReady().
    void shareTrade(const QString& positionId);

signals:
    // A fresh market-data key pair. Both must be persisted: the secret is
    // returned exactly once, and the old pair is dead the moment this fires.
    void algoKeyRenewed(bool ok, const QString& apiKey, const QString& apiSecret,
                        const QString& message);
    void shareLinkReady(const QString& positionId, bool ok,
                        const QString& shortCode, const QString& message);
    void symbolsReceived(const QVector<SymbolSpec>& symbols);
    void accountReceived(const AccountInfo& account);
    void pricesReceived(const QVector<Quote>& quotes);
    void barsReceived(const QString& symbol, const QString& timeframe, const QVector<Bar>& bars);
    void tradeResult(const TradeResult& result);
    void positionsReceived(const QVector<OpenPosition>& positions);
    void ordersReceived(const QVector<PendingOrder>& orders);
    void transactionsReceived(const QVector<Transaction>& txns);
    void historyReceived(const QVector<HistoryTrade>& history);
    // Result of a per-position modify/close. ok=false carries the reject reason
    // (so the chart can snap a dragged line back and toast the message).
    void positionOpResult(const QString& positionId, const QString& op, bool ok, const QString& message);
    // Result of placePendingOrder()/cancelOrder(). op = "place" | "cancel".
    void orderOpResult(const QString& op, bool ok, const QString& message);
    // New access token, plus the replacement refresh cookie. Both must be
    // persisted: the old refresh token is dead the moment this fires.
    void sessionRefreshed(const QString& accessToken, const QString& refreshToken);
    void sessionRefreshFailed(const QString& message);
    // httpStatus is the response code, or 0 when the request never got one (DNS
    // failure, timeout, connection refused). Carrying it lets a listener tell a
    // dead session from a network blip without matching on the message text.
    void errorOccurred(const QString& context, const QString& message, int httpStatus);

private:
    QNetworkRequest makeRequest(const QString& path) const;   // adds auth headers (algo API)
    QNetworkRequest v1Request(const QString& path) const;     // adds Bearer auth (/api/v1)
    void handleReply(QNetworkReply* reply, const QString& kind, const QString& context);

    Config m_cfg;
    QNetworkAccessManager* m_net;
};
