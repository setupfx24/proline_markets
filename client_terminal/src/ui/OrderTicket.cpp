#include "ui/OrderTicket.h"
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QLabel>
#include <QFormLayout>
#include <QGridLayout>
#include <QVBoxLayout>

OrderTicket::OrderTicket(QWidget* parent) : QWidget(parent) {
    m_symbolLabel = new QLabel(tr("—"));
    m_symbolLabel->setStyleSheet("font-weight:bold; font-size:15px;");

    m_bidLabel = new QLabel("—");
    m_askLabel = new QLabel("—");
    m_bidLabel->setStyleSheet("color:#e01b24; font-size:14px;");
    m_askLabel->setStyleSheet("color:#26a269; font-size:14px;");

    auto* quoteRow = new QGridLayout;
    quoteRow->addWidget(new QLabel(tr("Bid")), 0, 0);
    quoteRow->addWidget(new QLabel(tr("Ask")), 0, 1);
    quoteRow->addWidget(m_bidLabel, 1, 0);
    quoteRow->addWidget(m_askLabel, 1, 1);

    m_volume = new QDoubleSpinBox;
    m_volume->setDecimals(2);
    m_volume->setRange(0.01, 100.0);
    m_volume->setSingleStep(0.01);
    m_volume->setValue(0.10);

    m_sl = new QDoubleSpinBox;
    m_sl->setDecimals(5);
    m_sl->setRange(0.0, 1e9);
    m_sl->setSpecialValueText(tr("none"));   // 0 => none

    m_tp = new QDoubleSpinBox;
    m_tp->setDecimals(5);
    m_tp->setRange(0.0, 1e9);
    m_tp->setSpecialValueText(tr("none"));

    auto* form = new QFormLayout;
    form->addRow(tr("Volume (lots)"), m_volume);
    form->addRow(tr("Stop Loss"),     m_sl);
    form->addRow(tr("Take Profit"),   m_tp);

    m_sellBtn = new QPushButton(tr("SELL"));
    m_buyBtn  = new QPushButton(tr("BUY"));
    m_sellBtn->setMinimumHeight(44);
    m_buyBtn->setMinimumHeight(44);
    m_sellBtn->setStyleSheet("QPushButton{background:#e01b24;color:white;font-weight:bold;border-radius:6px;}"
                             "QPushButton:hover{background:#f04148;}");
    m_buyBtn->setStyleSheet("QPushButton{background:#26a269;color:white;font-weight:bold;border-radius:6px;}"
                            "QPushButton:hover{background:#2ec27e;}");

    auto* btnRow = new QGridLayout;
    btnRow->addWidget(m_sellBtn, 0, 0);
    btnRow->addWidget(m_buyBtn,  0, 1);

    m_closeBtn = new QPushButton(tr("CLOSE ALL positions for this symbol"));
    m_closeBtn->setMinimumHeight(32);

    auto* header = new QLabel(tr("ORDER TICKET"));
    header->setStyleSheet("color:#7c828c; font-weight:700; font-size:10px; letter-spacing:1.5px; padding:8px 12px 5px 12px;");

    auto* lay = new QVBoxLayout(this);
    lay->addWidget(header);
    lay->addWidget(m_symbolLabel);
    lay->addLayout(quoteRow);
    lay->addSpacing(6);
    lay->addLayout(form);
    lay->addSpacing(6);
    lay->addLayout(btnRow);
    lay->addWidget(m_closeBtn);
    lay->addStretch();

    setEnabled(false); // enabled once a symbol is chosen

    connect(m_buyBtn, &QPushButton::clicked, this, [this]() {
        emit buy(m_spec.symbol, m_volume->value(), m_sl->value(), m_tp->value());
    });
    connect(m_sellBtn, &QPushButton::clicked, this, [this]() {
        emit sell(m_spec.symbol, m_volume->value(), m_sl->value(), m_tp->value());
    });
    connect(m_closeBtn, &QPushButton::clicked, this, [this]() {
        emit closeAll(m_spec.symbol);
    });
}

void OrderTicket::setSymbolSpec(const SymbolSpec& spec) {
    m_spec   = spec;
    m_digits = spec.digits;
    m_symbolLabel->setText(spec.symbol);
    m_volume->setRange(spec.minLot, spec.maxLot);
    m_volume->setSingleStep(spec.lotStep);
    if (m_volume->value() < spec.minLot) m_volume->setValue(spec.minLot);
    m_sl->setDecimals(spec.digits);
    m_tp->setDecimals(spec.digits);
    m_bidLabel->setText("—");
    m_askLabel->setText("—");
    setEnabled(true);
}

void OrderTicket::updateQuote(const Quote& q) {
    if (q.symbol != m_spec.symbol) return;
    m_bidLabel->setText(QString::number(q.bid, 'f', m_digits));
    m_askLabel->setText(QString::number(q.ask, 'f', m_digits));
}
