#include "ui/AccountPanel.h"
#include <QLabel>
#include <QGridLayout>
#include <QVBoxLayout>
#include <QPushButton>

AccountPanel::AccountPanel(QWidget* parent) : QWidget(parent) {
    auto* header = new QLabel(tr("ACCOUNT"));
    header->setStyleSheet("color:#7c828c; font-weight:700; font-size:10px; letter-spacing:1.5px; padding:8px 12px 5px 12px;");

    m_headline = new QLabel(tr("Not connected"));
    m_headline->setStyleSheet("font-size:14px; font-weight:bold;");

    auto* grid = new QGridLayout;
    const QStringList rows = {"Balance", "Credit", "Equity", "Margin used",
                              "Free margin", "Margin level", "Leverage", "Open positions"};
    int r = 0;
    for (const QString& key : rows) {
        auto* k = new QLabel(tr(qPrintable(key)));
        k->setStyleSheet("color:#8a8f98;");
        auto* v = new QLabel("—");
        v->setAlignment(Qt::AlignRight | Qt::AlignVCenter);
        v->setStyleSheet("font-family:monospace;");
        grid->addWidget(k, r, 0);
        grid->addWidget(v, r, 1);
        m_values.insert(key, v);
        ++r;
    }

    auto* refresh = new QPushButton(tr("Refresh"));
    connect(refresh, &QPushButton::clicked, this, &AccountPanel::refreshRequested);

    auto* lay = new QVBoxLayout(this);
    lay->addWidget(header);
    lay->addWidget(m_headline);
    lay->addSpacing(6);
    lay->addLayout(grid);
    lay->addWidget(refresh);
    lay->addStretch();
}

QLabel* AccountPanel::valueLabel(const QString& key) {
    return m_values.value(key, nullptr);
}

void AccountPanel::setAccount(const AccountInfo& a) {
    if (!a.valid) {
        m_headline->setText(tr("Account unavailable"));
        return;
    }
    m_headline->setText(tr("#%1  ·  %2  ·  %3")
                        .arg(a.account, a.currency, a.isDemo ? tr("DEMO") : tr("LIVE")));

    auto set = [&](const QString& k, const QString& v) {
        if (auto* l = valueLabel(k)) l->setText(v);
    };
    set("Balance",        QString::number(a.balance, 'f', 2));
    set("Credit",         QString::number(a.credit, 'f', 2));
    set("Equity",         QString::number(a.equity, 'f', 2));
    set("Margin used",    QString::number(a.marginUsed, 'f', 2));
    set("Free margin",    QString::number(a.freeMargin, 'f', 2));
    set("Margin level",   a.marginUsed > 0 ? QString::number(a.marginLevel, 'f', 2) + "%" : "—");
    set("Leverage",       QString("1:%1").arg(a.leverage));
    set("Open positions", QString::number(a.openPositions));

    // Colour equity vs balance (floating P/L direction).
    if (auto* eq = valueLabel("Equity")) {
        if (a.equity > a.balance)      eq->setStyleSheet("font-family:monospace; color:#26a269;");
        else if (a.equity < a.balance) eq->setStyleSheet("font-family:monospace; color:#e01b24;");
        else                           eq->setStyleSheet("font-family:monospace;");
    }
}
