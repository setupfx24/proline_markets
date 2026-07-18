#pragma once

#include <QString>
#include <QJsonObject>

// Mirrors an item from GET /api/v1/positions/. current_price/profit are
// recomputed live server-side from the latest tick for open positions.
struct Position {
    QString id;
    QString accountId;
    QString symbol;
    QString side;          // buy | sell
    double  lots = 0.0;
    double  openPrice = 0.0;
    double  currentPrice = 0.0;
    double  stopLoss = 0.0;     // 0 => none
    double  takeProfit = 0.0;   // 0 => none
    double  swap = 0.0;
    double  commission = 0.0;
    double  profit = 0.0;
    double  contractSize = 0.0;
    QString status;        // open | closed
    QString tradeType;     // self_trade | copy_trade | algo_trade | mt5_trade
    QString createdAt;

    bool isBuy() const { return side.compare(QLatin1String("buy"), Qt::CaseInsensitive) == 0; }
    // Positions mirrored from MT5 or copied from a master are read-only.
    bool isReadOnly() const {
        return tradeType == QLatin1String("mt5_trade")
            || tradeType == QLatin1String("copy_trade");
    }

    static Position fromJson(const QJsonObject &o)
    {
        Position p;
        p.id           = o.value(QStringLiteral("id")).toString();
        p.accountId    = o.value(QStringLiteral("account_id")).toString();
        p.symbol       = o.value(QStringLiteral("symbol")).toString();
        p.side         = o.value(QStringLiteral("side")).toString();
        p.lots         = o.value(QStringLiteral("lots")).toDouble();
        p.openPrice    = o.value(QStringLiteral("open_price")).toDouble();
        p.currentPrice = o.value(QStringLiteral("current_price")).toDouble();
        p.stopLoss     = o.value(QStringLiteral("stop_loss")).toDouble();
        p.takeProfit   = o.value(QStringLiteral("take_profit")).toDouble();
        p.swap         = o.value(QStringLiteral("swap")).toDouble();
        p.commission   = o.value(QStringLiteral("commission")).toDouble();
        p.profit       = o.value(QStringLiteral("profit")).toDouble();
        p.contractSize = o.value(QStringLiteral("contract_size")).toDouble();
        p.status       = o.value(QStringLiteral("status")).toString();
        p.tradeType    = o.value(QStringLiteral("trade_type")).toString();
        p.createdAt    = o.value(QStringLiteral("created_at")).toString();
        return p;
    }
};
