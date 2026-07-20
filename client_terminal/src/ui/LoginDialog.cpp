#include "ui/LoginDialog.h"
#include <QVBoxLayout>
#include <QFormLayout>
#include <QHBoxLayout>
#include <QLineEdit>
#include <QComboBox>
#include <QPushButton>
#include <QLabel>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrl>

LoginDialog::LoginDialog(const Config& cfg, QWidget* parent)
    : QDialog(parent), m_cfg(cfg), m_net(new QNetworkAccessManager(this)) {
    setWindowTitle(tr("Bull4x Terminal — Sign in"));
    setModal(true);
    setMinimumWidth(440);

    auto* title = new QLabel(tr("<b>Sign in to Bull4x</b>"));
    title->setStyleSheet("font-size:16px;");
    auto* hint  = new QLabel(tr("Use your Bull4x account email and password — the same "
                                "as the website. Your trading accounts load automatically."));
    hint->setWordWrap(true);
    hint->setStyleSheet("color:#8a8f98;");

    m_profile = new QComboBox;
    m_profile->addItems({tr("Bull4x"), tr("Local dev"), tr("Custom")});

    m_email = new QLineEdit(m_cfg.userName);
    m_email->setPlaceholderText(tr("you@example.com"));
    m_password = new QLineEdit;
    m_password->setEchoMode(QLineEdit::Password);
    m_password->setPlaceholderText(tr("Password"));

    m_rest = new QLineEdit(m_cfg.restBase);
    m_ws   = new QLineEdit(m_cfg.wsUrl);

    auto* form = new QFormLayout;
    form->addRow(tr("Server"),   m_profile);
    form->addRow(tr("Email"),    m_email);
    form->addRow(tr("Password"), m_password);
    form->addRow(tr("REST base"), m_rest);
    form->addRow(tr("WebSocket"), m_ws);

    m_loginBtn = new QPushButton(tr("Sign in"));
    m_loginBtn->setMinimumHeight(38);
    m_loginBtn->setStyleSheet("QPushButton{background:#2563eb;color:white;font-weight:700;border-radius:8px;}"
                              "QPushButton:hover{background:#3b82f6;}"
                              "QPushButton:disabled{background:#2a2f39;color:#6b7280;}");
    connect(m_loginBtn, &QPushButton::clicked, this, &LoginDialog::doLogin);
    connect(m_password, &QLineEdit::returnPressed, this, &LoginDialog::doLogin);

    // Account picker (revealed after sign-in)
    m_accountLabel = new QLabel(tr("Trading account"));
    m_accountLabel->setStyleSheet("color:#8a8f98;");
    m_account = new QComboBox;
    m_connectBtn = new QPushButton(tr("Connect"));
    m_connectBtn->setMinimumHeight(38);
    m_connectBtn->setStyleSheet("QPushButton{background:#26a269;color:white;font-weight:700;border-radius:8px;}"
                                "QPushButton:hover{background:#2ec27e;}");
    connect(m_connectBtn, &QPushButton::clicked, this, &LoginDialog::onConnect);
    m_accountLabel->hide();
    m_account->hide();
    m_connectBtn->hide();

    m_status = new QLabel;
    m_status->setWordWrap(true);
    m_status->setStyleSheet("color:#e01b24;");

    connect(m_profile, &QComboBox::currentTextChanged, this, [this](const QString& n) { applyProfile(n); });
    // Preselect Bull4x endpoints if config matches.
    {
        QSignalBlocker b(m_profile);
        if (m_cfg.restBase == BULL_REST)       m_profile->setCurrentText(tr("Bull4x"));
        else if (m_cfg.restBase == LOCAL_REST) m_profile->setCurrentText(tr("Local dev"));
        else                                   m_profile->setCurrentText(tr("Custom"));
    }

    auto* lay = new QVBoxLayout(this);
    lay->addWidget(title);
    lay->addWidget(hint);
    lay->addSpacing(6);
    lay->addLayout(form);
    lay->addWidget(m_loginBtn);
    lay->addSpacing(6);
    lay->addWidget(m_accountLabel);
    lay->addWidget(m_account);
    lay->addWidget(m_connectBtn);
    lay->addWidget(m_status);
}

void LoginDialog::applyProfile(const QString& name) {
    if (name == tr("Bull4x"))         { m_rest->setText(BULL_REST);  m_ws->setText(BULL_WS); }
    else if (name == tr("Local dev")) { m_rest->setText(LOCAL_REST); m_ws->setText(LOCAL_WS); }
}

void LoginDialog::setBusy(bool busy) {
    m_loginBtn->setEnabled(!busy);
    m_loginBtn->setText(busy ? tr("Signing in…") : tr("Sign in"));
}

void LoginDialog::doLogin() {
    const QString email = m_email->text().trimmed();
    const QString pass  = m_password->text();
    if (email.isEmpty() || pass.isEmpty()) {
        m_status->setText(tr("Enter your email and password."));
        return;
    }
    m_status->clear();
    setBusy(true);

    m_cfg.restBase = m_rest->text().trimmed();
    m_cfg.wsUrl    = m_ws->text().trimmed();

    QNetworkRequest req{QUrl(m_cfg.restBase + "/terminal/login")};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    QJsonObject body;
    body["email"] = email;
    body["password"] = pass;

    QNetworkReply* reply = m_net->post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(reply->readAll()).object();

        if (reply->error() != QNetworkReply::NoError || http >= 400) {
            QString detail = o.value("detail").toString();
            if (detail.isEmpty()) detail = reply->errorString();
            m_status->setText(tr("Sign-in failed: %1").arg(detail));
            return;
        }

        m_token    = o.value("token").toString();
        m_userName = o.value("name").toString(m_email->text().trimmed());
        const QJsonArray accts = o.value("accounts").toArray();
        m_accountsJson = QString::fromUtf8(QJsonDocument(accts).toJson(QJsonDocument::Compact));

        if (m_token.isEmpty() || accts.isEmpty()) {
            m_status->setText(tr("Signed in, but no trading accounts were found."));
            return;
        }

        m_account->clear();
        for (const QJsonValue& v : accts) {
            const QJsonObject a = v.toObject();
            const QString label = QString("%1  ·  %2  ·  %3  ·  %4 %5")
                .arg(a.value("account_number").toString(),
                     a.value("is_demo").toBool() ? tr("DEMO") : tr("LIVE"),
                     a.value("currency").toString("USD"))
                .arg(a.value("balance").toDouble(), 0, 'f', 2)
                .arg(a.value("currency").toString("USD"));
            m_account->addItem(label, a.value("account_id").toString());
        }
        // Preselect previously used account if present.
        const int idx = m_account->findData(m_cfg.accountId);
        if (idx >= 0) m_account->setCurrentIndex(idx);

        m_status->setStyleSheet("color:#26a269;");
        m_status->setText(tr("Signed in as %1 — pick an account.").arg(m_userName));
        m_accountLabel->show();
        m_account->show();
        m_connectBtn->show();
        m_loginBtn->hide();
    });
}

void LoginDialog::onConnect() {
    if (m_account->currentIndex() < 0) {
        m_status->setStyleSheet("color:#e01b24;");
        m_status->setText(tr("Select a trading account."));
        return;
    }
    m_cfg.token        = m_token;
    m_cfg.accountId    = m_account->currentData().toString();
    m_cfg.userName     = m_userName;
    m_cfg.accountsJson = m_accountsJson;
    m_cfg.restBase     = m_rest->text().trimmed();
    m_cfg.wsUrl        = m_ws->text().trimmed();
    m_cfg.apiKey.clear();
    m_cfg.apiSecret.clear();
    m_cfg.save();
    accept();
}
