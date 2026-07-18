#pragma once

#include <QString>
#include <QJsonObject>

// Mirrors an order object from POST/GET /api/v1/orders.
struct Order {
    QString id;
    QString accountId;
    QString symbol;
    QString orderType;   // market | limit | stop | stop_limit
    QString side;        // buy | sell
    QString status;      // pending | filled | cancelled
    double  lots = 0.0;
    double  price = 0.0;        // requested price (pending)
    double  stopLoss = 0.0;
    double  takeProfit = 0.0;
    double  filledPrice = 0.0;
    double  commission = 0.0;
    double  swap = 0.0;
    QString comment;
    QString createdAt;

    bool isBuy() const { return side.compare(QLatin1String("buy"), Qt::CaseInsensitive) == 0; }

    static Order fromJson(const QJsonObject &o)
    {
        Order r;
        r.id          = o.value(QStringLiteral("id")).toString();
        r.accountId   = o.value(QStringLiteral("account_id")).toString();
        r.symbol      = o.value(QStringLiteral("symbol")).toString();
        r.orderType   = o.value(QStringLiteral("order_type")).toString();
        r.side        = o.value(QStringLiteral("side")).toString();
        r.status      = o.value(QStringLiteral("status")).toString();
        r.lots        = o.value(QStringLiteral("lots")).toDouble();
        r.price       = o.value(QStringLiteral("price")).toDouble();
        r.stopLoss    = o.value(QStringLiteral("stop_loss")).toDouble();
        r.takeProfit  = o.value(QStringLiteral("take_profit")).toDouble();
        r.filledPrice = o.value(QStringLiteral("filled_price")).toDouble();
        r.commission  = o.value(QStringLiteral("commission")).toDouble();
        r.swap        = o.value(QStringLiteral("swap")).toDouble();
        r.comment     = o.value(QStringLiteral("comment")).toString();
        r.createdAt   = o.value(QStringLiteral("created_at")).toString();
        return r;
    }
};
