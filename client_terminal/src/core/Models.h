#pragma once
#include <QString>
#include <QDateTime>
#include <QMetaType>
#include <QVector>

// Plain data structs mirroring the Proline Markets Algo API JSON shapes.

struct SymbolSpec {
    QString symbol;
    QString displayName;
    QString category;
    int     digits       = 5;
    double  minLot       = 0.01;
    double  maxLot       = 100.0;
    double  lotStep      = 0.01;
    double  contractSize = 100000.0;
};

struct Quote {
    QString   symbol;
    double    bid    = 0.0;
    double    ask    = 0.0;
    double    spread = 0.0;
    QDateTime timestamp;
    bool      valid  = false;
};

struct Bar {
    QDateTime time;
    double open   = 0.0;
    double high   = 0.0;
    double low    = 0.0;
    double close  = 0.0;
    double volume = 0.0;
};

struct AccountInfo {
    QString account;
    QString currency = "USD";
    int     leverage = 100;
    double  balance     = 0.0;
    double  credit      = 0.0;
    double  equity      = 0.0;
    double  marginUsed  = 0.0;
    double  freeMargin  = 0.0;
    double  marginLevel = 0.0;
    bool    isDemo      = false;
    int     openPositions = 0;
    bool    valid = false;
};

// Result of a placed / closed order.
struct TradeResult {
    bool    ok = false;
    QString status;        // "filled" | "closed" | "no_positions" | "error"
    QString symbol;
    QString action;        // BUY | SELL | CLOSE
    double  lots  = 0.0;
    double  price = 0.0;
    QString positionId;
    QString orderId;
    int     closedCount  = 0;
    double  totalProfit  = 0.0;
    QString message;       // human message / error detail
};

// Open position with live floating P/L.
struct OpenPosition {
    QString id, symbol, side;
    double  lots = 0, openPrice = 0, currentPrice = 0, sl = 0, tp = 0;
    double  swap = 0, commission = 0, profit = 0;
    QString openedAt, comment;
};

// Pending (not-yet-filled) order.
struct PendingOrder {
    QString id, symbol, type, side;
    double  lots = 0, price = 0, sl = 0, tp = 0;
    QString createdAt, comment;
};

// Closed trade (history).
struct HistoryTrade {
    QString id, symbol, side;
    double  lots = 0, openPrice = 0, closePrice = 0, profit = 0, swap = 0, commission = 0;
    QString openedAt, closedAt, closeReason;
};

Q_DECLARE_METATYPE(Quote)
Q_DECLARE_METATYPE(AccountInfo)
Q_DECLARE_METATYPE(TradeResult)
