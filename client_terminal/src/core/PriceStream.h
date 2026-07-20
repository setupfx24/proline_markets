#pragma once
#include <QObject>
#include <QWebSocket>
#include <QTimer>
#include "core/Models.h"
#include "core/Config.h"

// Live tick stream over WebSocket. Connects, performs first-message auth,
// emits tickReceived() for every tick, and auto-reconnects on drop.
class PriceStream : public QObject {
    Q_OBJECT
public:
    explicit PriceStream(const Config& cfg, QObject* parent = nullptr);

    void setConfig(const Config& cfg) { m_cfg = cfg; }
    void start();
    void stop();
    bool isAuthenticated() const { return m_authed; }

signals:
    void tickReceived(const Quote& quote);
    void authenticated(const QString& account);
    void statusChanged(const QString& status);   // human-readable, for status bar

private slots:
    void onConnected();
    void onDisconnected();
    void onTextMessage(const QString& msg);
    void onError();

private:
    void scheduleReconnect();

    Config     m_cfg;
    QWebSocket m_ws;
    QTimer     m_reconnectTimer;
    bool       m_authed  = false;
    bool       m_wantRun = false;
};
