#include "ui/AccountPanel.h"
#include "ui/Theme.h"
#include "ui/Icons.h"
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QColor>
#include <QSize>
#include <QPainter>
#include <QStyle>
#include <QStyleOption>
#include <cmath>
#include <QSpacerItem>

static const char* MASK = "••••••";

QLabel* AccountPanel::addField(QHBoxLayout* row, const QString& caption, const QString& key) {
    auto* cap = new QLabel(caption);
    auto* val = new QLabel("—");
    m_keys.insert(key, cap);
    m_values.insert(key, val);
    row->addWidget(cap);
    row->addWidget(val);
    auto* gap = new QSpacerItem(14, 0, QSizePolicy::Fixed, QSizePolicy::Minimum);
    row->addItem(gap);
    m_gaps.insert(key, gap);
    return val;
}

AccountPanel::AccountPanel(QWidget* parent) : QWidget(parent) {
    setFixedHeight(24);

    auto* row = new QHBoxLayout(this);
    row->setContentsMargins(8, 0, 6, 0);
    row->setSpacing(4);

    // Order mirrors MT5's status line exactly.
    addField(row, tr("Balance:"),      "balance");
    // Credit sits between Balance and Equity because it is exactly what
    // separates them: equity is balance plus credit plus floating P/L. Without
    // it on screen a bonus account shows a balance and an equity that differ by
    // an unexplained amount with no open positions — reported from the desk as
    // "balance and equity are different when no position or pending order is
    // inside". Hidden entirely when there is no credit, which is most accounts;
    // a permanent "Credit: 0.00" would just be noise on the status line.
    addField(row, tr("Credit:"),       "credit");
    addField(row, tr("Equity:"),       "equity");
    // Sits next to Equity because it is the difference between the two: equity
    // is balance plus this. MT5 calls it Profit; "Floating P/L" is spelled out
    // here so it cannot be mistaken for realised, withdrawable money.
    addField(row, tr("Floating P/L:"), "floating");
    addField(row, tr("Margin:"),       "margin");
    addField(row, tr("Free margin:"),  "free");
    addField(row, tr("Margin level:"), "level");
    row->addStretch();

    m_refresh = new QPushButton;
    m_refresh->setFixedSize(20, 18);
    m_refresh->setCursor(Qt::PointingHandCursor);
    m_refresh->setToolTip(tr("Refresh account"));
    m_refresh->setIconSize(QSize(12, 12));
    connect(m_refresh, &QPushButton::clicked, this, &AccountPanel::refreshRequested);
    row->addWidget(m_refresh);

    applyTheme();
    connect(Theme::notifier(), &Theme::Notifier::changed, this, &AccountPanel::applyTheme);
}

void AccountPanel::paintEvent(QPaintEvent*) {
    QStyleOption opt;
    opt.initFrom(this);
    QPainter p(this);
    style()->drawPrimitive(QStyle::PE_Widget, &opt, &p, this);
}

void AccountPanel::applyTheme() {
    const auto& c = Theme::p();
    setStyleSheet(QString("AccountPanel{background:%1; border-top:1px solid %2;}")
                  .arg(c.panelAlt, c.border));

    for (QLabel* k : m_keys)
        k->setStyleSheet(QString("background:transparent; color:%1; font-size:11px;").arg(c.muted));
    for (QLabel* v : m_values)
        v->setStyleSheet(QString("background:transparent; color:%1; font-size:11px;"
                                 "font-weight:700; font-family:Consolas,monospace;")
                         .arg(c.textStrong));

    m_refresh->setIcon(Icons::refresh(QColor(c.muted), 12));
    m_refresh->setStyleSheet(QString(
        "QPushButton{background:transparent; border:1px solid %1; border-radius:3px;}"
        "QPushButton:hover{background:%2; border-color:%3;}")
        .arg(c.btnBorder, c.btnHover, c.accent));

    setAccount(m_last);   // re-applies the equity colour for the new palette
    renderFloating();     // ditto for the P/L colour, which the loop above reset
}

void AccountPanel::setPrivacy(bool on) {
    m_privacy = on;
    setAccount(m_last);
    renderFloating();
}

// setAccount() ignores an invalid AccountInfo by design (a failed poll must not
// blank a good reading), so logging out needs an explicit reset.
void AccountPanel::setFloatingPL(double pl, int openPositions) {
    m_floating    = pl;
    m_openCount   = openPositions;
    m_hasFloating = true;
    renderFloating();
}

void AccountPanel::renderFloating() {
    const auto& c = Theme::p();
    QLabel* v = m_values.value("floating");
    if (!v) return;

    if (!m_hasFloating) { v->setText("—"); return; }
    v->setText(m_privacy ? QString::fromUtf8(MASK)
                         : QString("%L1").arg(m_floating, 0, 'f', 2));
    // Flat is deliberately neutral rather than green: with no positions open
    // the figure is 0.00, and painting that as profit would be misleading.
    const QString col = m_openCount == 0 ? c.muted
                      : m_floating > 0   ? c.up
                      : m_floating < 0   ? c.down : c.textStrong;
    v->setStyleSheet(QString("background:transparent; font-size:11px; font-weight:700;"
                             "font-family:Consolas,monospace; color:%1;").arg(col));
    v->setToolTip(m_openCount == 0
                  ? tr("No open positions")
                  : tr("Unrealised P/L across %n open position(s). Becomes real "
                       "balance only when the positions close.", "", m_openCount));
}

void AccountPanel::clear() {
    m_last = AccountInfo{};
    m_floating = 0.0;
    m_openCount = 0;
    m_hasFloating = false;
    const auto& c = Theme::p();
    for (QLabel* v : m_values) {
        v->setText("—");
        v->setStyleSheet(QString("background:transparent; color:%1; font-size:11px;"
                                 "font-weight:700; font-family:Consolas,monospace;")
                         .arg(c.textStrong));
    }
}

void AccountPanel::setAccount(const AccountInfo& a) {
    if (!a.valid) return;
    m_last = a;
    const auto& c = Theme::p();

    auto money = [this](double v, const QString& suffix = QString()) {
        if (m_privacy) return QString::fromUtf8(MASK);
        QString s = QString("%L1").arg(v, 0, 'f', 2);
        if (!suffix.isEmpty()) s += " " + suffix;
        return s;
    };

    m_values["balance"]->setText(money(a.balance, a.currency));
    m_values["equity"]->setText(money(a.equity));

    const bool hasCredit = std::fabs(a.credit) > 0.005;   // below display precision
    m_values["credit"]->setText(money(a.credit));
    m_keys["credit"]->setVisible(hasCredit);
    m_values["credit"]->setVisible(hasCredit);
    // Hiding the labels leaves the gap that followed them, which reads as a
    // stray hole between Balance and Equity on a strip this tight.
    m_gaps["credit"]->changeSize(hasCredit ? 14 : 0, 0,
                                 QSizePolicy::Fixed, QSizePolicy::Minimum);
    layout()->invalidate();
    const QString creditTip = tr("Bonus credit. It counts towards equity and margin, "
                                 "so it lets you hold larger positions, but it is not "
                                 "your money and cannot be transferred or withdrawn — "
                                 "which is why the balance is lower than the equity.");
    m_keys["credit"]->setToolTip(creditTip);
    m_values["credit"]->setToolTip(creditTip);
    m_values["margin"]->setText(money(a.marginUsed));
    m_values["free"]->setText(money(a.freeMargin));
    m_values["level"]->setText(m_privacy ? QString::fromUtf8(MASK)
                                         : QString("%L1 %").arg(a.marginLevel, 0, 'f', 2));

    // Equity is the one figure that moves with the market — colour it by
    // direction so that reads even when the number itself is masked.
    //
    // Against balance PLUS credit, not balance alone. Credit is a permanent
    // addition, so comparing with balance left a bonus account's equity green
    // for ever, including flat with no positions: a "profit" colour on an
    // account that has not made anything.
    const double flat = a.balance + a.credit;
    m_values["equity"]->setStyleSheet(QString(
        "background:transparent; font-size:11px; font-weight:700;"
        "font-family:Consolas,monospace; color:%1;")
        .arg(a.equity > flat ? c.up : a.equity < flat ? c.down : c.textStrong));
}
