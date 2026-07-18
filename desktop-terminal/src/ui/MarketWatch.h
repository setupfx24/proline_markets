#pragma once

#include <QWidget>
#include <QHash>

#include "models/Instrument.h"
#include "models/Tick.h"

class QTableWidget;
class QLineEdit;

// Live "Market Watch" table: one row per instrument showing Bid / Ask / Spread,
// updated in place from PriceSocket ticks. Bid/Ask flash green/red on up/down
// ticks. Selecting a row emits symbolSelected for the (later) order panel/chart.
class MarketWatch : public QWidget
{
    Q_OBJECT
public:
    explicit MarketWatch(QWidget *parent = nullptr);

    void setInstruments(const QList<Instrument> &instruments);

public slots:
    void onTick(const Tick &tick);

signals:
    void symbolSelected(const QString &symbol);

private slots:
    void applyFilter(const QString &text);
    void emitCurrentSymbol();

private:
    int rowFor(const QString &symbol) const;
    void setPriceCell(int row, int col, double value, int digits, double prev);

    QLineEdit *m_filter = nullptr;
    QTableWidget *m_table = nullptr;

    QHash<QString, int> m_rowBySymbol;
    QHash<QString, Instrument> m_instruments;
    QHash<QString, double> m_lastBid;
    QHash<QString, double> m_lastAsk;
};
