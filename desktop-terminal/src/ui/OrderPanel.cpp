#include "ui/OrderPanel.h"
#include "net/Api.h"
#include "core/Session.h"

#include <QComboBox>
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QLabel>
#include <QFormLayout>
#include <QGridLayout>
#include <QVBoxLayout>

OrderPanel::OrderPanel(Api *api, Session *session, QWidget *parent)
    : QWidget(parent)
    , m_api(api)
    , m_session(session)
{
    m_symbolLabel = new QLabel(tr("—"));
    m_symbolLabel->setStyleSheet(QStringLiteral("font-size:18px;font-weight:600;"));

    m_bidLabel = new QLabel(QStringLiteral("—"));
    m_askLabel = new QLabel(QStringLiteral("—"));
    m_bidLabel->setStyleSheet(QStringLiteral("color:#e5484d;font-size:16px;font-weight:600;"));
    m_askLabel->setStyleSheet(QStringLiteral("color:#2ea043;font-size:16px;font-weight:600;"));

    m_type = new QComboBox;
    m_type->addItems({ tr("Market"), tr("Limit"), tr("Stop") });

    m_lots = new QDoubleSpinBox;
    m_lots->setDecimals(2);
    m_lots->setRange(0.01, 100.0);
    m_lots->setSingleStep(0.01);
    m_lots->setValue(0.10);

    m_price = new QDoubleSpinBox;
    m_price->setDecimals(5);
    m_price->setRange(0.0, 1'000'000.0);
    m_price->setEnabled(false); // market by default

    m_sl = new QDoubleSpinBox;
    m_sl->setDecimals(5);
    m_sl->setRange(0.0, 1'000'000.0);
    m_sl->setSpecialValueText(tr("none"));

    m_tp = new QDoubleSpinBox;
    m_tp->setDecimals(5);
    m_tp->setRange(0.0, 1'000'000.0);
    m_tp->setSpecialValueText(tr("none"));

    m_buy = new QPushButton(tr("BUY"));
    m_sell = new QPushButton(tr("SELL"));
    m_buy->setMinimumHeight(40);
    m_sell->setMinimumHeight(40);
    m_buy->setStyleSheet(QStringLiteral(
        "QPushButton{background:#2ea043;color:white;font-weight:700;border-radius:4px;}"
        "QPushButton:disabled{background:#4a4a4a;}"));
    m_sell->setStyleSheet(QStringLiteral(
        "QPushButton{background:#e5484d;color:white;font-weight:700;border-radius:4px;}"
        "QPushButton:disabled{background:#4a4a4a;}"));

    m_status = new QLabel;
    m_status->setWordWrap(true);

    // --- layout ---
    auto *bidask = new QGridLayout;
    bidask->addWidget(new QLabel(tr("Bid")), 0, 0);
    bidask->addWidget(new QLabel(tr("Ask")), 0, 1);
    bidask->addWidget(m_bidLabel, 1, 0);
    bidask->addWidget(m_askLabel, 1, 1);

    auto *form = new QFormLayout;
    form->addRow(tr("Type"), m_type);
    form->addRow(tr("Lots"), m_lots);
    form->addRow(tr("Price"), m_price);
    form->addRow(tr("Stop loss"), m_sl);
    form->addRow(tr("Take profit"), m_tp);

    auto *buttons = new QGridLayout;
    buttons->addWidget(m_sell, 0, 0);
    buttons->addWidget(m_buy, 0, 1);

    auto *root = new QVBoxLayout(this);
    root->addWidget(m_symbolLabel);
    root->addLayout(bidask);
    root->addLayout(form);
    root->addLayout(buttons);
    root->addWidget(m_status);
    root->addStretch();

    connect(m_type, &QComboBox::currentIndexChanged, this, [this](int idx) {
        m_price->setEnabled(idx != 0); // enabled for Limit/Stop
        if (idx != 0)
            refreshPriceFields();
    });
    connect(m_buy, &QPushButton::clicked, this, [this] { submit(true); });
    connect(m_sell, &QPushButton::clicked, this, [this] { submit(false); });

    setSymbol(QString());
}

void OrderPanel::setInstruments(const QList<Instrument> &instruments)
{
    m_instruments.clear();
    for (const Instrument &i : instruments)
        m_instruments.insert(i.symbol, i);
}

void OrderPanel::setSymbol(const QString &symbol)
{
    m_symbol = symbol;
    m_symbolLabel->setText(symbol.isEmpty() ? tr("Select a symbol") : symbol);

    const bool has = !symbol.isEmpty();
    m_buy->setEnabled(has);
    m_sell->setEnabled(has);

    if (m_instruments.contains(symbol)) {
        const Instrument &inst = m_instruments.value(symbol);
        m_price->setDecimals(inst.digits);
        m_sl->setDecimals(inst.digits);
        m_tp->setDecimals(inst.digits);
        const double step = inst.pointSize();
        m_price->setSingleStep(step);
        m_sl->setSingleStep(step);
        m_tp->setSingleStep(step);
        m_lots->setRange(inst.minLot, inst.maxLot);
        m_lots->setSingleStep(inst.lotStep);
        m_lots->setDecimals(inst.lotStep < 0.1 ? 2 : 1);
    }
    m_bid = m_ask = 0.0;
    m_bidLabel->setText(QStringLiteral("—"));
    m_askLabel->setText(QStringLiteral("—"));
    m_sl->setValue(0.0);
    m_tp->setValue(0.0);
}

void OrderPanel::onTick(const Tick &t)
{
    if (t.symbol != m_symbol)
        return;
    m_bid = t.bid;
    m_ask = t.ask;
    const int digits = m_instruments.contains(m_symbol)
                           ? m_instruments.value(m_symbol).digits : 5;
    m_bidLabel->setText(QString::number(m_bid, 'f', digits));
    m_askLabel->setText(QString::number(m_ask, 'f', digits));

    // Seed the pending-order price the first time we have a quote.
    if (m_type->currentIndex() != 0 && m_price->value() == 0.0)
        refreshPriceFields();
}

void OrderPanel::refreshPriceFields()
{
    if (m_price->value() == 0.0 && m_ask > 0.0)
        m_price->setValue(m_ask);
}

void OrderPanel::submit(bool buy)
{
    if (m_symbol.isEmpty()) {
        m_status->setText(tr("Select a symbol first."));
        return;
    }
    if (m_session->accountId().isEmpty()) {
        m_status->setText(tr("No account selected."));
        return;
    }

    OrderRequest req;
    req.accountId = m_session->accountId();
    req.symbol = m_symbol;
    req.side = buy ? QStringLiteral("buy") : QStringLiteral("sell");
    req.lots = m_lots->value();

    switch (m_type->currentIndex()) {
    case 1: req.orderType = QStringLiteral("limit"); break;
    case 2: req.orderType = QStringLiteral("stop"); break;
    default: req.orderType = QStringLiteral("market"); break;
    }
    if (req.orderType != QLatin1String("market")) {
        if (m_price->value() <= 0.0) {
            m_status->setText(tr("Enter a price for a pending order."));
            return;
        }
        req.price = m_price->value();
    }
    if (m_sl->value() > 0.0) req.stopLoss = m_sl->value();
    if (m_tp->value() > 0.0) req.takeProfit = m_tp->value();

    m_status->setText(tr("Placing order…"));
    m_buy->setEnabled(false);
    m_sell->setEnabled(false);

    m_api->placeOrder(req, [this](bool ok, const Order &order, const QString &error) {
        m_buy->setEnabled(!m_symbol.isEmpty());
        m_sell->setEnabled(!m_symbol.isEmpty());
        if (ok) {
            const QString msg = tr("%1 %2 %3 lots — %4")
                .arg(order.side.toUpper(), order.symbol,
                     QString::number(order.lots), order.status);
            m_status->setText(msg);
            emit orderSubmitted(true, msg);
        } else {
            m_status->setText(error);
            emit orderSubmitted(false, error);
        }
    });
}
