#pragma once

#include <QString>
#include <QJsonObject>
#include <cmath>

// Mirrors GET /api/v1/instruments/ items.
struct Instrument {
    QString id;
    QString symbol;
    QString displayName;
    QString segment;        // forex | indices | commodities | crypto | stocks
    QString baseCurrency;
    QString quoteCurrency;
    int     digits = 5;
    double  pipSize = 0.0001;
    double  minLot = 0.01;
    double  maxLot = 100.0;
    double  lotStep = 0.01;
    double  contractSize = 100000.0;
    double  marginRate = 0.01;
    bool    isActive = true;

    // Smallest price increment (1 "point"), used to render spread in points.
    double pointSize() const { return std::pow(10.0, -digits); }

    static Instrument fromJson(const QJsonObject &o)
    {
        Instrument i;
        i.id            = o.value(QStringLiteral("id")).toString();
        i.symbol        = o.value(QStringLiteral("symbol")).toString();
        i.displayName   = o.value(QStringLiteral("display_name")).toString();
        i.segment       = o.value(QStringLiteral("segment")).toString();
        i.baseCurrency  = o.value(QStringLiteral("base_currency")).toString();
        i.quoteCurrency = o.value(QStringLiteral("quote_currency")).toString();
        i.digits        = o.value(QStringLiteral("digits")).toInt(5);
        i.pipSize       = o.value(QStringLiteral("pip_size")).toDouble(0.0001);
        i.minLot        = o.value(QStringLiteral("min_lot")).toDouble(0.01);
        i.maxLot        = o.value(QStringLiteral("max_lot")).toDouble(100.0);
        i.lotStep       = o.value(QStringLiteral("lot_step")).toDouble(0.01);
        i.contractSize  = o.value(QStringLiteral("contract_size")).toDouble(100000.0);
        i.marginRate    = o.value(QStringLiteral("margin_rate")).toDouble(0.01);
        i.isActive      = o.value(QStringLiteral("is_active")).toBool(true);
        return i;
    }
};
