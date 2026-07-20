#include "ui/WalletDialog.h"
#include <QVBoxLayout>
#include <QFormLayout>
#include <QLabel>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrl>

WalletDialog::WalletDialog(const Config& cfg, QWidget* parent)
    : QDialog(parent), m_cfg(cfg), m_net(new QNetworkAccessManager(this)) {
    setWindowTitle(tr("Wallet — Fund a trading account"));
    setModal(true);
    setMinimumWidth(420);

    auto* title = new QLabel(tr("<b>Main Wallet</b>"));
    title->setStyleSheet("font-size:15px;");
    m_balance = new QLabel(tr("Loading…"));
    m_balance->setStyleSheet("font-size:22px; font-weight:800; color:#26a269;");

    auto* sub = new QLabel(tr("Transfer money from your main wallet into a live trading account."));
    sub->setWordWrap(true);
    sub->setStyleSheet("color:#8a8f98;");

    m_account = new QComboBox;
    m_amount = new QDoubleSpinBox;
    m_amount->setRange(1.0, 1000000.0);
    m_amount->setDecimals(2);
    m_amount->setValue(100.0);
    m_amount->setPrefix("$ ");

    auto* form = new QFormLayout;
    form->addRow(tr("To account"), m_account);
    form->addRow(tr("Amount"),     m_amount);

    m_transferBtn = new QPushButton(tr("Transfer"));
    m_transferBtn->setMinimumHeight(40);
    m_transferBtn->setStyleSheet("QPushButton{background:#2563eb;color:white;font-weight:700;border-radius:8px;}"
                                 "QPushButton:hover{background:#3b82f6;}"
                                 "QPushButton:disabled{background:#2a2f39;color:#6b7280;}");
    connect(m_transferBtn, &QPushButton::clicked, this, &WalletDialog::doTransfer);

    m_status = new QLabel;
    m_status->setWordWrap(true);

    auto* close = new QPushButton(tr("Close"));
    connect(close, &QPushButton::clicked, this, &QDialog::accept);

    auto* lay = new QVBoxLayout(this);
    lay->addWidget(title);
    lay->addWidget(m_balance);
    lay->addSpacing(4);
    lay->addWidget(sub);
    lay->addSpacing(6);
    lay->addLayout(form);
    lay->addWidget(m_transferBtn);
    lay->addWidget(m_status);
    lay->addStretch();
    lay->addWidget(close);

    if (m_cfg.token.isEmpty()) {
        m_balance->setText(tr("Sign in required"));
        m_balance->setStyleSheet("font-size:16px; color:#f59e0b;");
        m_status->setStyleSheet("color:#f59e0b;");
        m_status->setText(tr("The wallet needs email/password sign-in. "
                             "Go to Settings and sign in to use transfers."));
        m_transferBtn->setEnabled(false);
        m_account->setEnabled(false);
        m_amount->setEnabled(false);
    } else {
        loadWallet();
    }
}

static QNetworkRequest bearerReq(const Config& cfg, const QString& path) {
    QNetworkRequest req{QUrl(cfg.restBase + path)};
    req.setRawHeader("Authorization", ("Bearer " + cfg.token).toUtf8());
    req.setRawHeader("X-Account-Id",  cfg.accountId.toUtf8());
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    return req;
}

void WalletDialog::loadWallet() {
    QNetworkReply* r = m_net->get(bearerReq(m_cfg, "/terminal/wallet"));
    connect(r, &QNetworkReply::finished, this, [this, r]() {
        r->deleteLater();
        const int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
        if (r->error() != QNetworkReply::NoError || http >= 400) {
            m_status->setStyleSheet("color:#e01b24;");
            m_status->setText(tr("Couldn't load wallet: %1")
                              .arg(o.value("detail").toString(r->errorString())));
            return;
        }
        const double bal = o.value("main_wallet_balance").toDouble();
        m_balance->setText(QString("$ %L1 %2").arg(bal, 0, 'f', 2).arg(o.value("currency").toString("USD")));
        m_balance->setStyleSheet("font-size:22px; font-weight:800; color:#26a269;");

        m_account->clear();
        for (const QJsonValue& v : o.value("accounts").toArray()) {
            const QJsonObject a = v.toObject();
            m_account->addItem(QString("%1 · $%L2")
                .arg(a.value("account_number").toString())
                .arg(a.value("balance").toDouble(), 0, 'f', 2),
                a.value("account_id").toString());
        }
        const int idx = m_account->findData(m_cfg.accountId);
        if (idx >= 0) m_account->setCurrentIndex(idx);
        m_amount->setMaximum(bal > 1 ? bal : 1000000.0);
    });
}

void WalletDialog::doTransfer() {
    if (m_account->currentIndex() < 0) {
        m_status->setStyleSheet("color:#e01b24;");
        m_status->setText(tr("Select a trading account."));
        return;
    }
    m_transferBtn->setEnabled(false);
    m_transferBtn->setText(tr("Transferring…"));
    m_status->clear();

    QJsonObject body;
    body["to_account_id"] = m_account->currentData().toString();
    body["amount"] = m_amount->value();

    QNetworkReply* r = m_net->post(bearerReq(m_cfg, "/terminal/transfer"),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(r, &QNetworkReply::finished, this, [this, r]() {
        r->deleteLater();
        m_transferBtn->setEnabled(true);
        m_transferBtn->setText(tr("Transfer"));
        const int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
        if (r->error() != QNetworkReply::NoError || http >= 400) {
            m_status->setStyleSheet("color:#e01b24;");
            m_status->setText(tr("Transfer failed: %1")
                              .arg(o.value("detail").toString(r->errorString())));
            return;
        }
        m_status->setStyleSheet("color:#26a269;");
        m_status->setText(tr("✓ Transferred $%L1 to %2")
                          .arg(m_amount->value(), 0, 'f', 2)
                          .arg(m_account->currentText().section(' ', 0, 0)));
        emit transferred();
        loadWallet();   // refresh balances
    });
}
