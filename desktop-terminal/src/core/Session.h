#pragma once

#include <QObject>
#include <QString>
#include <QDateTime>
#include <QList>

// Holds the connection target and the authenticated session state for the whole
// app. A single instance is created at startup and passed to the network + UI
// layers. Emits signals when auth state changes so the UI can react.
class Session : public QObject
{
    Q_OBJECT
public:
    // A selectable backend target shown on the login screen.
    struct ServerProfile {
        QString name;     // "Local", "Production", "Custom"
        QString apiBase;  // e.g. "http://localhost:8000" (no trailing slash, no /api/v1)
    };
    static QList<ServerProfile> defaultProfiles();

    explicit Session(QObject *parent = nullptr);

    // --- target ---
    QString apiBase() const { return m_apiBase; }
    void setApiBase(const QString &base);
    // ws://host or wss://host derived from apiBase's scheme.
    QString wsBase() const;

    // --- auth ---
    bool isAuthenticated() const { return !m_token.isEmpty(); }
    QString token() const { return m_token; }
    QString userId() const { return m_userId; }
    QString role() const { return m_role; }
    QDateTime expiresAt() const { return m_expiresAt; }
    bool isExpired() const;

    void setAuth(const QString &token, const QString &userId,
                 const QString &role, const QDateTime &expiresAt);
    void clearAuth();

    // --- selected trading account (set once accounts are loaded) ---
    QString accountId() const { return m_accountId; }
    void setAccountId(const QString &id);

signals:
    void authenticated();
    void loggedOut();
    void accountChanged(const QString &accountId);

private:
    QString m_apiBase;
    QString m_token;
    QString m_userId;
    QString m_role;
    QDateTime m_expiresAt;
    QString m_accountId;
};
