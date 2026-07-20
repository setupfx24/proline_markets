#pragma once
#include <QDialog>
#include "core/Config.h"

class QLineEdit;
class QComboBox;
class QPushButton;
class QLabel;
class QNetworkAccessManager;

// Email/password login (like the website) → JWT + the user's trading accounts.
// The user picks an account; the terminal stores the token + account id.
class LoginDialog : public QDialog {
    Q_OBJECT
public:
    static constexpr const char* BULL_REST  = "https://api.bull4x.com/api/algo";
    static constexpr const char* BULL_WS    = "wss://api.bull4x.com/ws/algo/prices";
    static constexpr const char* LOCAL_REST = "http://localhost:8000/api/algo";
    static constexpr const char* LOCAL_WS   = "ws://localhost:8000/ws/algo/prices";

    explicit LoginDialog(const Config& cfg, QWidget* parent = nullptr);
    Config config() const { return m_cfg; }

private slots:
    void doLogin();
    void onConnect();

private:
    void applyProfile(const QString& name);
    void setBusy(bool busy);

    Config       m_cfg;
    QComboBox*   m_profile;
    QLineEdit*   m_email;
    QLineEdit*   m_password;
    QLineEdit*   m_rest;
    QLineEdit*   m_ws;
    QPushButton* m_loginBtn;
    QLabel*      m_accountLabel;
    QComboBox*   m_account;
    QPushButton* m_connectBtn;
    QLabel*      m_status;
    QNetworkAccessManager* m_net;

    QString m_token;
    QString m_userName;
    QString m_accountsJson;
};
