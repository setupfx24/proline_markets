#include "ui/ClosePositionDialog.h"
#include "ui/Theme.h"
#include "ui/SpinInput.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QLabel>
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QFrame>
#include <cmath>

static QString money(double v) {
    return QString("%1$%L2").arg(v < 0 ? "-" : "").arg(std::fabs(v), 0, 'f', 2);
}

// Rounds to the instrument's lot step. Truncates rather than rounds to nearest:
// rounding up could ask to close more lots than the position holds, which the
// server rejects outright.
static double snap(double lots, double step) {
    if (step <= 0.0) return lots;
    return std::floor(lots / step + 1e-9) * step;
}

ClosePositionDialog::ClosePositionDialog(const OpenPosition& pos, double lotStep,
                                         double minLot, QWidget* parent)
    : QDialog(parent), m_pos(pos),
      m_step(lotStep > 0 ? lotStep : 0.01),
      m_min(minLot > 0 ? minLot : 0.01) {
    setWindowTitle(tr("Close Position"));
    setModal(true);
    setMinimumWidth(380);

    const auto& c = Theme::p();
    const bool sell = m_pos.side.compare("sell", Qt::CaseInsensitive) == 0;

    auto* title = new QLabel(tr("<b>Close Position</b>"));
    title->setStyleSheet(QString("font-size:15px; color:%1;").arg(c.textStrong));

    // ── details card ──
    auto* card = new QFrame;
    card->setStyleSheet(QString("QFrame{background:%1; border:1px solid %2; border-radius:8px;}")
                        .arg(c.cardBg, c.cardBorder));
    auto* g = new QGridLayout(card);
    g->setContentsMargins(12, 10, 12, 10);
    g->setVerticalSpacing(7);

    auto row = [&](int r, const QString& k, const QString& v, const QString& colour) {
        auto* kl = new QLabel(k);
        kl->setStyleSheet(QString("background:transparent; color:%1; font-size:12px;").arg(c.muted));
        auto* vl = new QLabel(v);
        vl->setStyleSheet(QString("background:transparent; color:%1; font-size:12px;"
                                  "font-weight:700;").arg(colour));
        vl->setAlignment(Qt::AlignRight | Qt::AlignVCenter);
        g->addWidget(kl, r, 0);
        g->addWidget(vl, r, 1);
    };
    row(0, tr("Symbol"),    m_pos.symbol,                          c.textStrong);
    row(1, tr("Side"),      m_pos.side.toUpper(),                  sell ? c.down : c.accent);
    row(2, tr("Open lots"), QString::number(m_pos.lots, 'f', 2),   c.textStrong);
    row(3, tr("P&&L"),      money(m_pos.profit),                   m_pos.profit >= 0 ? c.up : c.down);

    // ── lots to close ──
    auto* lotsCap = new QLabel(tr("LOTS TO CLOSE"));
    lotsCap->setStyleSheet(QString("color:%1; font-size:10px; font-weight:800;"
                                   "letter-spacing:1px;").arg(c.muted));

    auto* quickRow = new QHBoxLayout;
    quickRow->setSpacing(6);
    const int pcts[4] = {25, 50, 75, 100};
    for (int i = 0; i < 4; ++i) {
        m_quick[i] = new QPushButton(pcts[i] == 100 ? tr("FULL")
                                                    : QString("%1%").arg(pcts[i]));
        m_quick[i]->setCheckable(true);
        m_quick[i]->setCursor(Qt::PointingHandCursor);
        m_quick[i]->setMinimumHeight(30);
        connect(m_quick[i], &QPushButton::clicked, this, [this, p = pcts[i]]() { setPercent(p); });
        quickRow->addWidget(m_quick[i]);
    }

    m_lots = new QDoubleSpinBox;
    m_lots->setDecimals(2);
    m_lots->setSingleStep(m_step);
    // The floor is the smaller of the instrument minimum and the position size:
    // a 0.01-lot position on an instrument with a 0.10 minimum must still be
    // closable, and that close is always a full one.
    m_lots->setRange(qMin(m_min, m_pos.lots), m_pos.lots);
    m_lots->setValue(m_pos.lots);
    m_lots->setMinimumHeight(34);
    // Through the shared helper, not setKeyboardTracking() by hand: this field
    // also opens pre-filled (with the full position size), so it needs the
    // select-on-focus that makes a click-and-type actually replace the value.
    SpinInput::freeTyping({m_lots});
    connect(m_lots, &QDoubleSpinBox::valueChanged, this, [this]() { refresh(); });

    auto* estRow = new QHBoxLayout;
    auto* estCap = new QLabel(tr("EST. P&&L"));
    estCap->setStyleSheet(QString("color:%1; font-size:11px; font-weight:700;").arg(c.muted));
    m_estPl = new QLabel;
    m_estPl->setAlignment(Qt::AlignRight | Qt::AlignVCenter);
    estRow->addWidget(estCap);
    estRow->addStretch();
    estRow->addWidget(m_estPl);

    // ── actions ──
    auto* cancel = new QPushButton(tr("Cancel"));
    cancel->setMinimumHeight(38);
    cancel->setCursor(Qt::PointingHandCursor);
    connect(cancel, &QPushButton::clicked, this, &QDialog::reject);

    m_confirm = new QPushButton;
    m_confirm->setMinimumHeight(38);
    m_confirm->setCursor(Qt::PointingHandCursor);
    m_confirm->setStyleSheet(QString(
        "QPushButton{background:qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 #c4161c,stop:1 #8f1015);"
        "color:#ffffff; border:none; border-radius:8px; font-weight:800;}"
        "QPushButton:hover{background:qlineargradient(x1:0,y1:0,x2:1,y2:0,"
        "stop:0 #d81b22,stop:1 #a51218);}"));
    connect(m_confirm, &QPushButton::clicked, this, &QDialog::accept);

    auto* actions = new QHBoxLayout;
    actions->setSpacing(8);
    actions->addWidget(cancel, 1);
    actions->addWidget(m_confirm, 2);

    auto* lay = new QVBoxLayout(this);
    lay->setSpacing(9);
    lay->addWidget(title);
    lay->addWidget(card);
    lay->addWidget(lotsCap);
    lay->addLayout(quickRow);
    lay->addWidget(m_lots);
    lay->addLayout(estRow);
    lay->addSpacing(4);
    lay->addLayout(actions);

    setPercent(100);   // FULL preselected, matching the web terminal
}

void ClosePositionDialog::setPercent(int pct) {
    double lots = m_pos.lots * pct / 100.0;
    if (pct < 100) {
        lots = snap(lots, m_step);
        // A slice that snapped below the minimum is not tradable; fall back to
        // the smallest the box allows rather than silently sending 0.
        if (lots < m_lots->minimum()) lots = m_lots->minimum();
    } else {
        lots = m_pos.lots;
    }
    m_lots->setValue(lots);
    refresh();
}

void ClosePositionDialog::refresh() {
    const double lots = m_lots->value();
    // Proportional, which is exact for a linear P/L: closing half the lots
    // realises half the open profit. Labelled "est." because the fill happens
    // at the price the server sees, not the one on screen.
    const double est = m_pos.lots > 0 ? m_pos.profit * (lots / m_pos.lots) : 0.0;
    const auto& c = Theme::p();
    m_estPl->setText(money(est));
    m_estPl->setStyleSheet(QString("font-size:12px; font-weight:800; color:%1;")
                           .arg(est >= 0 ? c.up : c.down));

    const bool full = isFullClose();
    m_confirm->setText(full ? tr("Close position")
                            : tr("Close %1 lots").arg(QString::number(lots, 'f', 2)));

    // Reflect the typed value back onto the quick buttons, so a hand-entered
    // 50% still reads as 50%.
    const int pcts[4] = {25, 50, 75, 100};
    for (int i = 0; i < 4; ++i) {
        const double want = (pcts[i] == 100) ? m_pos.lots
                                             : snap(m_pos.lots * pcts[i] / 100.0, m_step);
        m_quick[i]->setChecked(std::fabs(want - lots) < m_step / 2.0);
    }

    const auto& p = Theme::p();
    for (QPushButton* b : m_quick) {
        b->setStyleSheet(QString(
            "QPushButton{background:%1; color:%2; border:1px solid %3;"
            "border-radius:6px; font-size:11px; font-weight:800;}"
            "QPushButton:hover{border-color:%4;}")
            .arg(b->isChecked() ? p.cardSelBg : p.btnBg,
                 b->isChecked() ? p.down      : p.text,
                 b->isChecked() ? p.down      : p.btnBorder,
                 p.down));
    }
}

double ClosePositionDialog::lotsToClose() const { return m_lots->value(); }

bool ClosePositionDialog::isFullClose() const {
    return m_lots->value() >= m_pos.lots - m_step / 2.0;
}
