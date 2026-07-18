#include "net/PriceSocket.h"
#include "core/Session.h"

#include <QJsonDocument>
#include <QJsonObject>
#include <QUrl>

PriceSocket::PriceSocket(Session *session, QObject *parent)
    : QObject(parent)
    , m_session(session)
{
    m_reconnectTimer.setSingleShot(true);
    m_reconnectTimer.setInterval(2000);

    connect(&m_socket, &QWebSocket::connected, this, &PriceSocket::onConnected);
    connect(&m_socket, &QWebSocket::disconnected, this, &PriceSocket::onDisconnected);
    connect(&m_socket, &QWebSocket::textMessageReceived, this, &PriceSocket::onTextMessage);
    connect(&m_reconnectTimer, &QTimer::timeout, this, &PriceSocket::reconnect);
}

QUrl PriceSocket::endpoint() const
{
    // Token is optional on /ws/prices; include it when we have one so the
    // server can attribute the connection.
    QUrl url(m_session->wsBase() + QStringLiteral("/ws/prices"));
    if (m_session->isAuthenticated())
        url.setQuery(QStringLiteral("token=") + m_session->token());
    return url;
}

void PriceSocket::start()
{
    m_running = true;
    if (m_socket.state() == QAbstractSocket::UnconnectedState)
        m_socket.open(endpoint());
}

void PriceSocket::stop()
{
    m_running = false;
    m_reconnectTimer.stop();
    m_socket.close();
}

void PriceSocket::onConnected()
{
    emit connectionChanged(true);
}

void PriceSocket::onDisconnected()
{
    emit connectionChanged(false);
    if (m_running && !m_reconnectTimer.isActive())
        m_reconnectTimer.start();
}

void PriceSocket::reconnect()
{
    if (m_running && m_socket.state() == QAbstractSocket::UnconnectedState)
        m_socket.open(endpoint());
}

void PriceSocket::onTextMessage(const QString &message)
{
    const QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
    if (!doc.isObject())
        return;
    const QJsonObject o = doc.object();

    // Heartbeats: {"type":"ping"} — nothing to reply on this endpoint.
    if (o.value(QStringLiteral("type")).toString() == QLatin1String("ping"))
        return;

    if (!o.contains(QStringLiteral("symbol")))
        return;
    const Tick t = Tick::fromJson(o);
    if (t.isValid())
        emit tick(t);
}
