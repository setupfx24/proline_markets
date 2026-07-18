#pragma once

#include <QString>
#include <QJsonObject>
#include <QList>

// Mirrors an item from GET /api/v1/accounts. Numeric fields arrive as JSON
// numbers; equity/free_margin/margin_level are live-computed server-side.
struct Account {
    QString id;
    QString accountNumber;
    QString groupName;
    QString currency;
    double  balance     = 0.0;
    double  credit      = 0.0;
    double  equity      = 0.0;
    double  marginUsed  = 0.0;
    double  freeMargin  = 0.0;
    double  marginLevel = 0.0;
    int     leverage    = 0;
    bool    isDemo      = false;
    bool    isActive    = true;

    static Account fromJson(const QJsonObject &o)
    {
        Account a;
        a.id            = o.value(QStringLiteral("id")).toString();
        a.accountNumber = o.value(QStringLiteral("account_number")).toString();
        a.currency      = o.value(QStringLiteral("currency")).toString();
        a.balance       = o.value(QStringLiteral("balance")).toDouble();
        a.credit        = o.value(QStringLiteral("credit")).toDouble();
        a.equity        = o.value(QStringLiteral("equity")).toDouble();
        a.marginUsed    = o.value(QStringLiteral("margin_used")).toDouble();
        a.freeMargin    = o.value(QStringLiteral("free_margin")).toDouble();
        a.marginLevel   = o.value(QStringLiteral("margin_level")).toDouble();
        a.leverage      = o.value(QStringLiteral("leverage")).toInt();
        a.isDemo        = o.value(QStringLiteral("is_demo")).toBool();
        a.isActive      = o.value(QStringLiteral("is_active")).toBool(true);
        const QJsonObject g = o.value(QStringLiteral("group")).toObject();
        a.groupName     = g.value(QStringLiteral("name")).toString();
        return a;
    }

    QString label() const
    {
        QString s = accountNumber;
        if (!groupName.isEmpty())
            s += QStringLiteral(" · ") + groupName;
        if (isDemo)
            s += QStringLiteral(" (demo)");
        return s;
    }
};
