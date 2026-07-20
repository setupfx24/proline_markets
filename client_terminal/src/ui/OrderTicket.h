#pragma once
#include <QWidget>
#include "core/Models.h"

QT_BEGIN_NAMESPACE
class QDoubleSpinBox;
class QPushButton;
class QLabel;
QT_END_NAMESPACE

// Order entry: pick volume + optional SL/TP, then BUY / SELL / CLOSE.
// Reflects the live bid/ask on the action buttons.
class OrderTicket : public QWidget {
    Q_OBJECT
public:
    explicit OrderTicket(QWidget* parent = nullptr);

    void setSymbolSpec(const SymbolSpec& spec);

public slots:
    void updateQuote(const Quote& q);   // only applied if it matches current symbol

signals:
    void buy(const QString& symbol, double volume, double sl, double tp);
    void sell(const QString& symbol, double volume, double sl, double tp);
    void closeAll(const QString& symbol);

private:
    SymbolSpec m_spec;
    int    m_digits = 5;

    QLabel*         m_symbolLabel;
    QLabel*         m_bidLabel;
    QLabel*         m_askLabel;
    QDoubleSpinBox* m_volume;
    QDoubleSpinBox* m_sl;
    QDoubleSpinBox* m_tp;
    QPushButton*    m_buyBtn;
    QPushButton*    m_sellBtn;
    QPushButton*    m_closeBtn;
};
