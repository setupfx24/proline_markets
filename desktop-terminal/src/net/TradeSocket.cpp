#include "net/TradeSocket.h"
#include "core/Session.h"

#include <QJsonDocument>
#include <QUrlQuery>
#include <QUrl>

TradeSocket::TradeSocket(Session *session, QObject *parent)
    : QObject(parent)
    , m_session(session)
{
    m_reconnectTimer.setSingleShot(true);
    m_reconnectTimer.setInterval(2000);

    connect(&m_socket, &QWebSocket::connected, this, &TradeSocket::onConnected);
    connect(&m_socket, &QWebSocket::disconnected, this, &TradeSocket::onDisconnected);
    connect(&m_socket, &QWebSocket::textMessageReceived, this, &TradeSocket::onTextMessage);
    connect(&m_reconnectTimer, &QTimer::timeout, this, &TradeSocket::reconnect);
}

QUrl TradeSocket::endpoint() const
{
    QUrl url(m_session->wsBase() + QStringLiteral("/ws/trades/") + m_accountId);
    QUrlQuery q;
    q.addQueryItem(QStringLiteral("token"), m_session->token());
    url.setQuery(q);
    return url;
}

void TradeSocket::bind(const QString &accountId)
{
    if (accountId.isEmpty())
        return;
    m_running = true;
    if (accountId == m_accountId
        && m_socket.state() == QAbstractSocket::ConnectedState)
        return; // already bound & live

    m_accountId = accountId;
    m_reconnectTimer.stop();
    if (m_socket.state() != QAbstractSocket::UnconnectedState)
        m_socket.close();          // onDisconnected will reconnect to the new account
    else
        m_socket.open(endpoint());
}

void TradeSocket::stop()
{
    m_running = false;
    m_reconnectTimer.stop();
    m_socket.close();
}

void TradeSocket::onConnected()
{
    emit connectionChanged(true);
}

void TradeSocket::onDisconnected()
{
    emit connectionChanged(false);
    if (m_running && !m_accountId.isEmpty() && !m_reconnectTimer.isActive())
        m_reconnectTimer.start();
}

void TradeSocket::reconnect()
{
    if (m_running && m_socket.state() == QAbstractSocket::UnconnectedState)
        m_socket.open(endpoint());
}

void TradeSocket::onTextMessage(const QString &message)
{
    const QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
    if (!doc.isObject())
        return;
    const QJsonObject o = doc.object();
    const QString type = o.value(QStringLiteral("type")).toString();

    // Heartbeat: reply with pong so the server keeps the connection alive.
    if (type == QLatin1String("ping")) {
        m_socket.sendTextMessage(QStringLiteral("{\"type\":\"pong\"}"));
        return;
    }
    emit tradeEvent(type, o);
}
