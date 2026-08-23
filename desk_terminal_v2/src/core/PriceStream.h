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
    // The stream's credentials were refused. Retrying cannot fix this — the
    // key pair has to be replaced before the next attempt, which only the
    // holder of the JWT can do, so MainWindow handles it.
    void credentialsRejected(const QString& reason);

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
    // Backoff, so a stream that cannot connect is not hammered every 4s for the
    // rest of the session — and so the status bar is not rewritten with
    // "Disconnected — retrying…" every four seconds while it fails. Reset to
    // the floor on every successful authentication.
    int        m_retryMs = kRetryFloorMs;
    static constexpr int kRetryFloorMs = 4000;
    static constexpr int kRetryCeilMs  = 60000;
};
