#pragma once

#include <QString>
#include <QJsonObject>

// A price update from the /ws/prices firehose (or GET /instruments/{sym}/price).
// Shape: { "symbol", "bid", "ask", "timestamp", "spread" }
struct Tick {
    QString symbol;
    double  bid = 0.0;
    double  ask = 0.0;
    double  spread = 0.0;   // as published by the server (price terms)
    QString timestamp;

    bool isValid() const { return !symbol.isEmpty() && (bid > 0.0 || ask > 0.0); }

    static Tick fromJson(const QJsonObject &o)
    {
        Tick t;
        t.symbol    = o.value(QStringLiteral("symbol")).toString();
        t.bid       = o.value(QStringLiteral("bid")).toDouble();
        t.ask       = o.value(QStringLiteral("ask")).toDouble();
        t.spread    = o.value(QStringLiteral("spread")).toDouble();
        t.timestamp = o.value(QStringLiteral("timestamp")).toString();
        return t;
    }
};
