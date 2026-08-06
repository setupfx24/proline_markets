#include "ui/EditOrderDialog.h"
#include "ui/Theme.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QLabel>
#include <QDoubleSpinBox>
#include <QPushButton>
#include <cmath>

namespace {
// Doubles that came from JSON and back through a spin box never compare equal
// on the last bit, so "changed" is judged a decade below the instrument's last
// digit rather than with ==.
bool differs(double a, double b, int digits) {
    return std::fabs(a - b) > std::pow(10.0, -(digits + 1));
}
}

EditOrderDialog::EditOrderDialog(const PendingOrder& order, const SymbolSpec& spec,
                                 double bid, double ask, QWidget* parent)
    : QDialog(parent), m_order(order), m_spec(spec), m_bid(bid), m_ask(ask) {
    setWindowTitle(tr("Modify pending order — %1").arg(order.symbol));
    setModal(true);
    setMinimumWidth(380);

    const auto& c = Theme::p();
    const int digits = spec.digits > 0 ? spec.digits : 5;
    const double step = std::pow(10.0, -digits + 1);

    auto* title = new QLabel(tr("<b>%1</b> · %2 %3")
                             .arg(order.symbol, order.side.toLower(), order.type.toLower()));
    title->setStyleSheet(QString("font-size:15px; color:%1;").arg(c.textStrong));

    auto* live = new QLabel(tr("Bid %1   Ask %2")
                            .arg(bid > 0 ? QString::number(bid, 'f', digits) : QStringLiteral("—"),
                                 ask > 0 ? QString::number(ask, 'f', digits) : QStringLiteral("—")));
    live->setStyleSheet(QString("color:%1; font-size:11px; font-family:Consolas,monospace;")
                        .arg(c.muted));

    m_price = new QDoubleSpinBox;
    m_price->setDecimals(digits);
    m_price->setRange(0.0, 1e7);
    m_price->setSingleStep(step);
    m_price->setValue(order.price);

    m_lots = new QDoubleSpinBox;
    m_lots->setDecimals(2);
    m_lots->setRange(spec.minLot > 0 ? spec.minLot : 0.01,
                     spec.maxLot > 0 ? spec.maxLot : 100.0);
    m_lots->setSingleStep(spec.lotStep > 0 ? spec.lotStep : 0.01);
    m_lots->setValue(order.lots);

    auto mkBracket = [&](double v) {
        auto* s = new QDoubleSpinBox;
        s->setDecimals(digits);
        s->setRange(0.0, 1e7);
        s->setSingleStep(step);
        s->setSpecialValueText(tr("none"));   // 0 => not set
        s->setValue(v);
        return s;
    };
    m_sl = mkBracket(order.sl);
    m_tp = mkBracket(order.tp);

    for (QWidget* w : {(QWidget*)m_price, (QWidget*)m_lots,
                       (QWidget*)m_sl, (QWidget*)m_tp})
        w->setMinimumHeight(32);

    auto cap = [&](const QString& t) {
        auto* l = new QLabel(t);
        l->setStyleSheet(QString("color:%1; font-size:10px; font-weight:800;"
                                 "letter-spacing:1px;").arg(c.muted));
        return l;
    };
    auto* form = new QGridLayout;
    form->setHorizontalSpacing(10);
    form->setVerticalSpacing(6);
    form->addWidget(cap(tr("PRICE")),  0, 0);  form->addWidget(cap(tr("VOLUME")), 0, 1);
    form->addWidget(m_price,           1, 0);  form->addWidget(m_lots,            1, 1);
    form->addWidget(cap(tr("STOP LOSS")), 2, 0); form->addWidget(cap(tr("TAKE PROFIT")), 2, 1);
    form->addWidget(m_sl,              3, 0);  form->addWidget(m_tp,              3, 1);

    m_hint = new QLabel;
    m_hint->setWordWrap(true);

    auto* cancel = new QPushButton(tr("Cancel"));
    cancel->setMinimumHeight(36);
    connect(cancel, &QPushButton::clicked, this, &QDialog::reject);

    m_save = new QPushButton(tr("Save changes"));
    m_save->setMinimumHeight(36);
    m_save->setCursor(Qt::PointingHandCursor);
    connect(m_save, &QPushButton::clicked, this, &QDialog::accept);

    auto* actions = new QHBoxLayout;
    actions->setSpacing(8);
    actions->addWidget(cancel, 1);
    actions->addWidget(m_save, 1);

    auto* lay = new QVBoxLayout(this);
    lay->setSpacing(9);
    lay->addWidget(title);
    lay->addWidget(live);
    lay->addSpacing(2);
    lay->addLayout(form);
    lay->addWidget(m_hint);
    lay->addSpacing(2);
    lay->addLayout(actions);

    for (QDoubleSpinBox* s : {m_price, m_lots, m_sl, m_tp})
        connect(s, &QDoubleSpinBox::valueChanged, this, [this]() { refreshHint(); });
    refreshHint();
}

void EditOrderDialog::refreshHint() {
    const auto& c = Theme::p();
    const int digits = m_spec.digits > 0 ? m_spec.digits : 5;
    const bool buy   = m_order.side.compare("buy", Qt::CaseInsensitive) == 0;
    const bool limit = m_order.type.compare("limit", Qt::CaseInsensitive) == 0;
    const double ref = buy ? m_ask : m_bid;

    // Same rule the placement dialog states: a limit buys below the market, a
    // stop buys above it (mirrored for a sell). Saying so before the request
    // goes out beats a server rejection after.
    const bool wantBelow = (buy && limit) || (!buy && !limit);
    const bool ok = ref <= 0.0 || (wantBelow ? price() < ref : price() > ref);
    const QString rule = wantBelow ? tr("below") : tr("above");

    const bool anything = priceChanged() || lotsChanged() || slChanged() || tpChanged();

    if (!ok) {
        m_hint->setText(tr("A %1 %2 must be %3 the current %4 (%5) — the server "
                           "will reject this price.")
                        .arg(buy ? tr("buy") : tr("sell"), limit ? tr("limit") : tr("stop"),
                             rule, buy ? tr("ask") : tr("bid"),
                             QString::number(ref, 'f', digits)));
    } else if (!anything) {
        m_hint->setText(tr("Nothing changed yet."));
    } else {
        QStringList parts;
        if (priceChanged()) parts << tr("price");
        if (lotsChanged())  parts << tr("volume");
        if (slChanged())    parts << (stopLoss()   <= 0.0 ? tr("stop loss removed")   : tr("stop loss"));
        if (tpChanged())    parts << (takeProfit() <= 0.0 ? tr("take profit removed") : tr("take profit"));
        // Only the changed legs are sent — see the note in the header.
        m_hint->setText(tr("On save: %1.").arg(parts.join(tr(", "))));
    }
    m_hint->setStyleSheet(QString("color:%1; font-size:11px;").arg(ok ? c.muted : c.warn));
    m_save->setEnabled(ok && anything);
    m_save->setStyleSheet(QString(
        "QPushButton{background:%1; color:#ffffff; border:none; border-radius:8px;"
        "font-weight:800;}"
        "QPushButton:disabled{background:%2; color:%3;}")
        .arg(c.accent, c.btnBg, c.muted));
}

double EditOrderDialog::price() const      { return m_price->value(); }
double EditOrderDialog::lots() const       { return m_lots->value(); }
double EditOrderDialog::stopLoss() const   { return m_sl->value(); }
double EditOrderDialog::takeProfit() const { return m_tp->value(); }

bool EditOrderDialog::priceChanged() const {
    return differs(price(), m_order.price, m_spec.digits > 0 ? m_spec.digits : 5);
}
bool EditOrderDialog::lotsChanged() const  { return differs(lots(), m_order.lots, 2); }
bool EditOrderDialog::slChanged() const {
    return differs(stopLoss(), m_order.sl, m_spec.digits > 0 ? m_spec.digits : 5);
}
bool EditOrderDialog::tpChanged() const {
    return differs(takeProfit(), m_order.tp, m_spec.digits > 0 ? m_spec.digits : 5);
}
