#pragma once

#include <QDialog>

class Session;
class Api;
class QComboBox;
class QLineEdit;
class QLabel;
class QPushButton;
class QCheckBox;

// Modal login screen. Lets the user pick a server (Local / Production / Custom),
// enter credentials + optional 2FA, and authenticates via Api::login. On
// success the Session is populated and the dialog accepts.
class LoginDialog : public QDialog
{
    Q_OBJECT
public:
    LoginDialog(Api *api, Session *session, QWidget *parent = nullptr);

private slots:
    void onServerChanged(int index);
    void onSubmit();

private:
    void setBusy(bool busy);
    void showError(const QString &msg);
    void loadSaved();
    void saveState();

    Api *m_api;
    Session *m_session;

    QComboBox   *m_server   = nullptr;
    QLineEdit   *m_customUrl = nullptr;
    QLineEdit   *m_email    = nullptr;
    QLineEdit   *m_password = nullptr;
    QLineEdit   *m_totp     = nullptr;
    QLabel      *m_totpLabel = nullptr;
    QCheckBox   *m_remember = nullptr;
    QPushButton *m_submit   = nullptr;
    QLabel      *m_status   = nullptr;

    bool m_totpVisible = false;
};
