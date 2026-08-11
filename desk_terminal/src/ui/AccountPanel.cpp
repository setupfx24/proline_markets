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

static const char* MASK = "••••••";

QLabel* AccountPanel::addField(QHBoxLayout* row, const QString& caption, const QString& key) {
    auto* cap = new QLabel(caption);
    auto* val = new QLabel("—");
    m_keys.insert(key, cap);
    m_values.insert(key, val);
    row->addWidget(cap);
    row->addWidget(val);
    row->addSpacing(14);
    return val;
}

AccountPanel::AccountPanel(QWidget* parent) : QWidget(parent) {
    setFixedHeight(24);

    auto* row = new QHBoxLayout(this);
    row->setContentsMargins(8, 0, 6, 0);
    row->setSpacing(4);

    // Order mirrors MT5's status line exactly.
    addField(row, tr("Balance:"),      "balance");
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
    m_values["margin"]->setText(money(a.marginUsed));
    m_values["free"]->setText(money(a.freeMargin));
    m_values["level"]->setText(m_privacy ? QString::fromUtf8(MASK)
                                         : QString("%L1 %").arg(a.marginLevel, 0, 'f', 2));

    // Equity is the one figure that moves with the market — colour it against
    // balance so direction reads even when the number itself is masked.
    m_values["equity"]->setStyleSheet(QString(
        "background:transparent; font-size:11px; font-weight:700;"
        "font-family:Consolas,monospace; color:%1;")
        .arg(a.equity > a.balance ? c.up : a.equity < a.balance ? c.down : c.textStrong));
}
