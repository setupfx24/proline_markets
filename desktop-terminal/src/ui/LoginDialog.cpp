#include "ui/LoginDialog.h"
#include "core/Session.h"
#include "net/Api.h"

#include <QComboBox>
#include <QLineEdit>
#include <QLabel>
#include <QPushButton>
#include <QCheckBox>
#include <QFormLayout>
#include <QVBoxLayout>
#include <QSettings>

LoginDialog::LoginDialog(Api *api, Session *session, QWidget *parent)
    : QDialog(parent)
    , m_api(api)
    , m_session(session)
{
    setWindowTitle(tr("Proline Terminal — Sign in"));
    setModal(true);
    setMinimumWidth(380);

    auto *title = new QLabel(tr("Proline Terminal"));
    title->setStyleSheet(QStringLiteral("font-size:22px;font-weight:600;"));
    title->setAlignment(Qt::AlignHCenter);

    m_server = new QComboBox;
    for (const auto &p : Session::defaultProfiles())
        m_server->addItem(p.name + QStringLiteral("  —  ") + p.apiBase, p.apiBase);
    m_server->addItem(tr("Custom…"), QString());

    m_customUrl = new QLineEdit;
    m_customUrl->setPlaceholderText(QStringLiteral("http://host:8000"));
    m_customUrl->setVisible(false);

    m_email = new QLineEdit;
    m_email->setPlaceholderText(tr("you@example.com"));

    m_password = new QLineEdit;
    m_password->setEchoMode(QLineEdit::Password);
    m_password->setPlaceholderText(tr("Password"));

    m_totp = new QLineEdit;
    m_totp->setPlaceholderText(tr("123456"));
    m_totp->setMaxLength(6);
    m_totp->setVisible(false);
    m_totpLabel = new QLabel(tr("2FA code"));
    m_totpLabel->setVisible(false);

    m_remember = new QCheckBox(tr("Remember email && server"));

    m_status = new QLabel;
    m_status->setWordWrap(true);
    m_status->setStyleSheet(QStringLiteral("color:#e5484d;"));

    m_submit = new QPushButton(tr("Sign in"));
    m_submit->setDefault(true);

    auto *form = new QFormLayout;
    form->addRow(tr("Server"), m_server);
    form->addRow(QString(), m_customUrl);
    form->addRow(tr("Email"), m_email);
    form->addRow(tr("Password"), m_password);
    form->addRow(m_totpLabel, m_totp);

    auto *root = new QVBoxLayout(this);
    root->addWidget(title);
    root->addSpacing(8);
    root->addLayout(form);
    root->addWidget(m_remember);
    root->addWidget(m_status);
    root->addWidget(m_submit);

    connect(m_server, &QComboBox::currentIndexChanged,
            this, &LoginDialog::onServerChanged);
    connect(m_submit, &QPushButton::clicked, this, &LoginDialog::onSubmit);
    connect(m_password, &QLineEdit::returnPressed, this, &LoginDialog::onSubmit);
    connect(m_totp, &QLineEdit::returnPressed, this, &LoginDialog::onSubmit);

    loadSaved();
    onServerChanged(m_server->currentIndex());
}

void LoginDialog::onServerChanged(int index)
{
    const bool custom = !m_server->itemData(index).isValid()
                        || m_server->itemData(index).toString().isEmpty();
    m_customUrl->setVisible(custom);
    if (custom)
        m_customUrl->setFocus();
}

void LoginDialog::onSubmit()
{
    const QString apiBase =
        m_customUrl->isVisible() ? m_customUrl->text().trimmed()
                                 : m_server->currentData().toString();
    if (apiBase.isEmpty()) {
        showError(tr("Enter a server URL."));
        return;
    }
    if (m_email->text().trimmed().isEmpty() || m_password->text().isEmpty()) {
        showError(tr("Enter email and password."));
        return;
    }

    m_session->setApiBase(apiBase);
    m_status->clear();
    setBusy(true);

    m_api->login(m_email->text().trimmed(), m_password->text(),
                 m_totp->text().trimmed(),
                 [this](bool ok, const QString &error, bool needTotp) {
        setBusy(false);
        if (ok) {
            saveState();
            accept();
            return;
        }
        if (needTotp && !m_totpVisible) {
            m_totpVisible = true;
            m_totpLabel->setVisible(true);
            m_totp->setVisible(true);
            m_totp->setFocus();
            showError(tr("Enter your 2FA code to continue."));
            return;
        }
        showError(error);
    });
}

void LoginDialog::setBusy(bool busy)
{
    m_submit->setEnabled(!busy);
    m_submit->setText(busy ? tr("Signing in…") : tr("Sign in"));
    m_email->setEnabled(!busy);
    m_password->setEnabled(!busy);
    m_totp->setEnabled(!busy);
    m_server->setEnabled(!busy);
    m_customUrl->setEnabled(!busy);
}

void LoginDialog::showError(const QString &msg)
{
    m_status->setText(msg);
}

void LoginDialog::loadSaved()
{
    QSettings s;
    const bool remember = s.value(QStringLiteral("login/remember"), true).toBool();
    m_remember->setChecked(remember);
    if (!remember)
        return;
    const QString email = s.value(QStringLiteral("login/email")).toString();
    if (!email.isEmpty())
        m_email->setText(email);
    const QString server = s.value(QStringLiteral("login/apiBase")).toString();
    if (!server.isEmpty()) {
        int idx = m_server->findData(server);
        if (idx >= 0) {
            m_server->setCurrentIndex(idx);
        } else {
            m_server->setCurrentIndex(m_server->count() - 1); // Custom…
            m_customUrl->setText(server);
        }
    }
}

void LoginDialog::saveState()
{
    QSettings s;
    s.setValue(QStringLiteral("login/remember"), m_remember->isChecked());
    if (m_remember->isChecked()) {
        s.setValue(QStringLiteral("login/email"), m_email->text().trimmed());
        s.setValue(QStringLiteral("login/apiBase"), m_session->apiBase());
    } else {
        s.remove(QStringLiteral("login/email"));
    }
}
