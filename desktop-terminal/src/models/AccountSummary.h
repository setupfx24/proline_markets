#pragma once

#include <QJsonObject>

// Mirrors GET /api/v1/accounts/{id}/summary (AccountSummary).
struct AccountSummary {
    double balance = 0.0;
    double credit = 0.0;
    double equity = 0.0;
    double marginUsed = 0.0;
    double freeMargin = 0.0;
    double marginLevel = 0.0;
    double unrealizedPnl = 0.0;
    int    openPositions = 0;

    static AccountSummary fromJson(const QJsonObject &o)
    {
        AccountSummary s;
        s.balance       = o.value(QStringLiteral("balance")).toDouble();
        s.credit        = o.value(QStringLiteral("credit")).toDouble();
        s.equity        = o.value(QStringLiteral("equity")).toDouble();
        s.marginUsed    = o.value(QStringLiteral("margin_used")).toDouble();
        s.freeMargin    = o.value(QStringLiteral("free_margin")).toDouble();
        s.marginLevel   = o.value(QStringLiteral("margin_level")).toDouble();
        s.unrealizedPnl = o.value(QStringLiteral("unrealized_pnl")).toDouble();
        s.openPositions = o.value(QStringLiteral("open_positions_count")).toInt();
        return s;
    }
};
