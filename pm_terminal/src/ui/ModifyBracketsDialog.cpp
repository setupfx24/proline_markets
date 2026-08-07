#include "ui/ModifyBracketsDialog.h"
#include "ui/Theme.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QLabel>
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QFrame>
#include <cmath>

ModifyBracketsDialog::ModifyBracketsDialog(const OpenPosition& pos, int digits, QWidget* parent)
    : QDialog(parent), m_pos(pos), m_slWas(pos.sl), m_tpWas(pos.tp) {
    setWindowTitle(tr("Modify S/L and T/P"));
    setModal(true);
    setMinimumWidth(360);

    const auto& c = Theme::p();
    const bool sell = m_pos.side.compare("sell", Qt::CaseInsensitive) == 0;

    auto* title = new QLabel(tr("<b>Modify S/L and T/P</b>"));
    title->setStyleSheet(QString("font-size:15px; color:%1;").arg(c.textStrong));

    // ── position summary ──
    auto* card = new QFrame;
    card->setStyleSheet(QString("QFrame{background:%1; border:1px solid %2; border-radius:8px;}")
                        .arg(c.cardBg, c.cardBorder));
    auto* g = new QGridLayout(card);
    g->setContentsMargins(12, 10, 12, 10);
    g->setVerticalSpacing(6);
    auto row = [&](int r, const QString& k, const QString& v, const QString& colour) {
        auto* kl = new QLabel(k);
        kl->setStyleSheet(QString("background:transparent; color:%1; font-size:12px;").arg(c.muted));
        auto* vl = new QLabel(v);
        vl->setStyleSheet(QString("background:transparent; color:%1; font-size:12px; font-weight:700;")
                          .arg(colour));
        vl->setAlignment(Qt::AlignRight | Qt::AlignVCenter);
        g->addWidget(kl, r, 0);
        g->addWidget(vl, r, 1);
    };
    row(0, tr("Symbol"),     m_pos.symbol,                                    c.textStrong);
    row(1, tr("Side"),       m_pos.side.toUpper(),        sell ? c.down : c.accent);
    row(2, tr("Volume"),     QString::number(m_pos.lots, 'f', 2),             c.textStrong);
    row(3, tr("Open price"), QString::number(m_pos.openPrice, 'f', digits),   c.textStrong);

    // ── the two brackets ──
    auto mkSpin = [&](double value) {
        auto* s = new QDoubleSpinBox;
        s->setDecimals(digits);
        s->setRange(0.0, 1e7);
        s->setSingleStep(std::pow(10.0, -digits + 1));
        // 0 is reachable whether or not a bracket is already set: on an
        // existing one it means "remove it", on an empty one "don't set one".
        // The floor used to be lifted one tick above 0 for an existing bracket
        // because the endpoint could not clear a level; it now can.
        s->setMinimum(0.0);
        s->setValue(value > 0.0 ? value : 0.0);
        s->setMinimumHeight(32);
        connect(s, &QDoubleSpinBox::valueChanged, this, [this]() { refreshHint(); });
        return s;
    };
    m_sl = mkSpin(m_pos.sl);
    m_tp = mkSpin(m_pos.tp);

    auto* form = new QGridLayout;
    form->setHorizontalSpacing(10);
    form->setVerticalSpacing(6);
    auto cap = [&](const QString& t) {
        auto* l = new QLabel(t);
        l->setStyleSheet(QString("color:%1; font-size:10px; font-weight:800;"
                                 "letter-spacing:1px;").arg(c.muted));
        return l;
    };
    form->addWidget(cap(tr("STOP LOSS")),   0, 0);
    form->addWidget(cap(tr("TAKE PROFIT")), 0, 1);
    form->addWidget(m_sl, 1, 0);
    form->addWidget(m_tp, 1, 1);

    m_hint = new QLabel;
    m_hint->setWordWrap(true);
    m_hint->setStyleSheet(QString("color:%1; font-size:11px;").arg(c.muted));

    // ── actions ──
    auto* cancel = new QPushButton(tr("Cancel"));
    cancel->setMinimumHeight(36);
    connect(cancel, &QPushButton::clicked, this, &QDialog::reject);

    m_save = new QPushButton(tr("Save"));
    m_save->setMinimumHeight(36);
    m_save->setCursor(Qt::PointingHandCursor);
    m_save->setStyleSheet(QString(
        "QPushButton{background:%1; color:#ffffff; border:none; border-radius:8px;"
        "font-weight:800;}"
        "QPushButton:hover{background:%2;}"
        "QPushButton:disabled{background:%3; color:%4;}")
        .arg(c.accent, c.accentHover, c.btnBg, c.dim));
    connect(m_save, &QPushButton::clicked, this, &QDialog::accept);

    auto* actions = new QHBoxLayout;
    actions->setSpacing(8);
    actions->addWidget(cancel, 1);
    actions->addWidget(m_save, 1);

    auto* lay = new QVBoxLayout(this);
    lay->setSpacing(9);
    lay->addWidget(title);
    lay->addWidget(card);
    lay->addLayout(form);
    lay->addWidget(m_hint);
    lay->addSpacing(2);
    lay->addLayout(actions);

    refreshHint();
}

void ModifyBracketsDialog::refreshHint() {
    QStringList parts;
    // "be removed" vs "move": clearing to 0 is a materially different action
    // from nudging a level, and worth spelling out before it is saved.
    if (slChanged())
        parts << (stopLoss() <= 0.0 ? tr("stop loss will be removed")
                                    : tr("stop loss will move"));
    if (tpChanged())
        parts << (takeProfit() <= 0.0 ? tr("take profit will be removed")
                                      : tr("take profit will move"));

    // Saying which legs will be sent matters: only the changed ones are, so an
    // untouched bracket is left exactly as the server has it.
    m_hint->setText(parts.isEmpty() ? tr("Nothing changed yet.")
                                    : tr("On save, %1.").arg(parts.join(tr(" and "))));
    m_save->setEnabled(!parts.isEmpty());
}

// Compared with a tolerance below the instrument's last digit: the spin box
// round-trips the value it was given, and an exact == on doubles would call an
// untouched field "changed" often enough to matter.
static bool differs(double a, double b) { return std::fabs(a - b) > 1e-9; }

bool   ModifyBracketsDialog::slChanged() const { return differs(m_sl->value(), m_slWas); }
bool   ModifyBracketsDialog::tpChanged() const { return differs(m_tp->value(), m_tpWas); }
double ModifyBracketsDialog::stopLoss()   const { return m_sl->value(); }
double ModifyBracketsDialog::takeProfit() const { return m_tp->value(); }
