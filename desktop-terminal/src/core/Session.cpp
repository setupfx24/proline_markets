#include "core/Session.h"

#include <QUrl>

QList<Session::ServerProfile> Session::defaultProfiles()
{
    return {
        { QStringLiteral("Local"),      QStringLiteral("http://localhost:8000") },
        { QStringLiteral("Production"), QStringLiteral("https://api.prolinemarket.com") },
    };
}

Session::Session(QObject *parent)
    : QObject(parent)
    , m_apiBase(QStringLiteral("http://localhost:8000"))
{
}

void Session::setApiBase(const QString &base)
{
    QString b = base.trimmed();
    while (b.endsWith('/'))
        b.chop(1);
    m_apiBase = b;
}

QString Session::wsBase() const
{
    QUrl url(m_apiBase);
    const QString scheme = url.scheme() == QLatin1String("https")
                               ? QStringLiteral("wss")
                               : QStringLiteral("ws");
    QString host = url.host();
    QString out = scheme + QStringLiteral("://") + host;
    if (url.port() > 0)
        out += QLatin1Char(':') + QString::number(url.port());
    return out;
}

bool Session::isExpired() const
{
    if (m_token.isEmpty())
        return true;
    if (!m_expiresAt.isValid())
        return false; // unknown expiry -> assume still valid, let 401 handle it
    return QDateTime::currentDateTimeUtc() >= m_expiresAt.toUTC();
}

void Session::setAuth(const QString &token, const QString &userId,
                      const QString &role, const QDateTime &expiresAt)
{
    m_token = token;
    m_userId = userId;
    m_role = role;
    m_expiresAt = expiresAt;
    emit authenticated();
}

void Session::clearAuth()
{
    m_token.clear();
    m_userId.clear();
    m_role.clear();
    m_expiresAt = QDateTime();
    m_accountId.clear();
    emit loggedOut();
}

void Session::setAccountId(const QString &id)
{
    if (m_accountId == id)
        return;
    m_accountId = id;
    emit accountChanged(id);
}
