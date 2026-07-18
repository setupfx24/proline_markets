#pragma once

#include <QObject>
#include <QWebSocket>
#include <QTimer>
#include <QJsonObject>

class Session;

// Streams trade lifecycle events for one account from
// /ws/trades/{account_id}?token=<JWT>. Auth is via the JWT in the query and the
// account_id in the path (no subscribe message). Replies {"type":"pong"} to
// heartbeats. Auto-reconnects and rebinds when the selected account changes.
class TradeSocket : public QObject
{
    Q_OBJECT
public:
    explicit TradeSocket(Session *session, QObject *parent = nullptr);

    void bind(const QString &accountId); // (re)connect for this account
    void stop();

signals:
    // Any trade event that should trigger a positions/orders/account refresh.
    // `type` is e.g. "order_update" | "position_closed"; raw carries the fields.
    void tradeEvent(const QString &type, const QJsonObject &raw);
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
    QString m_accountId;
    bool m_running = false;
};
