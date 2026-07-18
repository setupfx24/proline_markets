#pragma once

#include <QObject>
#include <QWebSocket>
#include <QTimer>

#include "models/Tick.h"

class Session;

// Streams live ticks from the gateway's /ws/prices firehose. The endpoint needs
// no subscribe message and no auth (token is optional); it pushes every tick to
// every client. Auto-reconnects with a short backoff while running.
class PriceSocket : public QObject
{
    Q_OBJECT
public:
    explicit PriceSocket(Session *session, QObject *parent = nullptr);

    void start();   // connect (and keep reconnecting) until stop()
    void stop();
    bool isConnected() const { return m_socket.state() == QAbstractSocket::ConnectedState; }

signals:
    void tick(const Tick &tick);
    void connectionChanged(bool connected);

private slots:
    void onConnected();
    void onDisconnected();
    void onTextMessage(const QString &message);
    void reconnect();

private:
    QUrl endpoint() const;

    Session *m_session;
    QWebSocket m_socket;
    QTimer m_reconnectTimer;
    bool m_running = false;
};
