#pragma once
#include <QObject>
#include <QWebSocket>
#include <QTimer>
#include "core/Models.h"
#include "core/Config.h"

// Live tick stream over WebSocket (/ws/prices). Authenticates via ?token= on
// the URL, emits tickReceived() for every tick, and auto-reconnects on drop.
// Every symbol is pushed — the endpoint has no subscribe protocol.
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
    QUrl streamUrl() const;   // wsUrl with the session token appended

    Config     m_cfg;
    QWebSocket m_ws;
    QTimer     m_reconnectTimer;
    bool       m_authed  = false;
    bool       m_wantRun = false;
};
