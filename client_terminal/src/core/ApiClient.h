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
    void fetchHistory(int limit = 100);

    // action = "BUY" | "SELL". sl/tp <= 0 are omitted.
    void placeOrder(const QString& action, const QString& symbol, double volume,
                    double sl = 0.0, double tp = 0.0, const QString& comment = QString());
    void closePositions(const QString& symbol);

    // Per-position ops via the platform's /api/v1/positions endpoints (JWT).
    // sl/tp: >0 sets the level, <=0 clears it.
    void modifyPosition(const QString& positionId, double sl, double tp);
    void closePositionById(const QString& positionId);

signals:
    void symbolsReceived(const QVector<SymbolSpec>& symbols);
    void accountReceived(const AccountInfo& account);
    void pricesReceived(const QVector<Quote>& quotes);
    void barsReceived(const QString& symbol, const QString& timeframe, const QVector<Bar>& bars);
    void tradeResult(const TradeResult& result);
    void positionsReceived(const QVector<OpenPosition>& positions);
    void ordersReceived(const QVector<PendingOrder>& orders);
    void historyReceived(const QVector<HistoryTrade>& history);
    // Result of a per-position modify/close. ok=false carries the reject reason
    // (so the chart can snap a dragged line back and toast the message).
    void positionOpResult(const QString& positionId, const QString& op, bool ok, const QString& message);
    void errorOccurred(const QString& context, const QString& message);

private:
    // Every call goes to /api/v1 with `Authorization: Bearer <jwt>`.
    QNetworkRequest makeRequest(const QString& path) const;
    // `a`/`b` carry request context the response does not echo back (the bars
    // endpoint returns candles without repeating the symbol or resolution).
    void handleReply(QNetworkReply* reply, const QString& kind, const QString& context,
                     const QString& a = QString(), const QString& b = QString());

    Config m_cfg;
    QNetworkAccessManager* m_net;
    // /accounts does not report an open-position count, so it is carried over
    // from the last positions fetch to keep AccountInfo complete.
    int m_openPositions = 0;
};
