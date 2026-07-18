#pragma once

#include <QJsonObject>

// One OHLCV candle from GET /api/v1/instruments/{symbol}/bars
// (TradingView UDF shape: parallel arrays or an array of {time,open,high,low,close,volume}).
struct Bar {
    qint64 time = 0;   // epoch seconds (bucket start)
    double open = 0.0;
    double high = 0.0;
    double low = 0.0;
    double close = 0.0;
    double volume = 0.0;

    static Bar fromJson(const QJsonObject &o)
    {
        Bar b;
        b.time   = static_cast<qint64>(o.value(QStringLiteral("time")).toDouble());
        b.open   = o.value(QStringLiteral("open")).toDouble();
        b.high   = o.value(QStringLiteral("high")).toDouble();
        b.low    = o.value(QStringLiteral("low")).toDouble();
        b.close  = o.value(QStringLiteral("close")).toDouble();
        b.volume = o.value(QStringLiteral("volume")).toDouble();
        return b;
    }
};
