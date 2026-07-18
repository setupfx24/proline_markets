#pragma once

#include <QWidget>
#include <QHash>

#include "models/Instrument.h"
#include "models/Tick.h"

class Api;
class Session;
class QComboBox;
class QDoubleSpinBox;
class QPushButton;
class QLabel;

// Order ticket: pick order type (market/limit/stop), lot size, optional SL/TP,
// and place a Buy or Sell. Shows the live bid/ask for the active symbol. Symbol
// is driven by the Market Watch selection via setSymbol().
class OrderPanel : public QWidget
{
    Q_OBJECT
public:
    OrderPanel(Api *api, Session *session, QWidget *parent = nullptr);

    void setInstruments(const QList<Instrument> &instruments);

public slots:
    void setSymbol(const QString &symbol);
    void onTick(const Tick &tick);

signals:
    // Emitted after a place-order attempt so the shell can refresh + notify.
    void orderSubmitted(bool ok, const QString &message);

private:
    void submit(bool buy);
    void refreshPriceFields();

    Api *m_api;
    Session *m_session;

    QLabel *m_symbolLabel = nullptr;
    QLabel *m_bidLabel = nullptr;
    QLabel *m_askLabel = nullptr;
    QComboBox *m_type = nullptr;
    QDoubleSpinBox *m_lots = nullptr;
    QDoubleSpinBox *m_price = nullptr;
    QDoubleSpinBox *m_sl = nullptr;
    QDoubleSpinBox *m_tp = nullptr;
    QPushButton *m_buy = nullptr;
    QPushButton *m_sell = nullptr;
    QLabel *m_status = nullptr;

    QHash<QString, Instrument> m_instruments;
    QString m_symbol;
    double m_bid = 0.0;
    double m_ask = 0.0;
};
