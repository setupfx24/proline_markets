#include "core/PriceStream.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QAbstractSocket>

PriceStream::PriceStream(const Config& cfg, QObject* parent)
    : QObject(parent), m_cfg(cfg) {
    connect(&m_ws, &QWebSocket::connected,    this, &PriceStream::onConnected);
    connect(&m_ws, &QWebSocket::disconnected, this, &PriceStream::onDisconnected);
    connect(&m_ws, &QWebSocket::textMessageReceived, this, &PriceStream::onTextMessage);
    connect(&m_ws, QOverload<QAbstractSocket::SocketError>::of(&QWebSocket::errorOccurred),
            this, &PriceStream::onError);

    m_reconnectTimer.setSingleShot(true);
    connect(&m_reconnectTimer, &QTimer::timeout, this, [this]() {
        if (m_wantRun) {
            emit statusChanged(tr("Reconnecting…"));
            m_ws.open(QUrl(m_cfg.wsUrl));
        }
    });
}

void PriceStream::start() {
    m_wantRun = true;
    m_retryMs = kRetryFloorMs;   // a deliberate (re)start earns a fresh budget
    emit statusChanged(tr("Connecting…"));
    m_ws.open(QUrl(m_cfg.wsUrl));
}

void PriceStream::stop() {
    m_wantRun = false;
    m_reconnectTimer.stop();
    m_ws.close();
}

void PriceStream::onConnected() {
    m_authed = false;
    emit statusChanged(tr("Authenticating…"));
    QJsonObject auth;
    auth["action"] = "auth";
    // /ws/algo/prices authenticates with the algo key pair, same as the REST
    // algo endpoints — prefer it, and fall back to the JWT for gateways that
    // accept one.
    if (!m_cfg.apiKey.isEmpty() && !m_cfg.apiSecret.isEmpty()) {
        auth["api_key"]    = m_cfg.apiKey;
        auth["api_secret"] = m_cfg.apiSecret;
    } else {
        auth["token"] = m_cfg.token;           // desktop-terminal JWT
    }
    m_ws.sendTextMessage(QString::fromUtf8(QJsonDocument(auth).toJson(QJsonDocument::Compact)));
}

void PriceStream::onDisconnected() {
    const bool wasAuthed = m_authed;
    m_authed = false;
    if (!m_wantRun) {
        emit statusChanged(tr("Stopped"));
        return;
    }

    // Application close codes from /ws/algo/prices — see algo_prices_ws():
    //   4001 auth_timeout   4002 bad_auth_message
    //   4003 invalid_credentials   4004 account_inactive
    //
    // These are the ones no amount of reconnecting will fix. 4003 is the one
    // traders actually hit: POST /algo/generate revokes the account's previous
    // key before minting a new one, so signing in anywhere else silently kills
    // the key this terminal is holding. The old behaviour was to retry every
    // four seconds forever, which is exactly the "Disconnected — retrying…"
    // that never goes away. Ask the host for a fresh key pair instead.
    const int code = m_ws.closeCode();
    if (!wasAuthed && code >= 4002 && code <= 4004) {
        const QString why = code == 4004 ? tr("This trading account is not active.")
                                         : tr("Market-data credentials were rejected.");
        emit statusChanged(tr("%1 Renewing…").arg(why));
        emit credentialsRejected(why);
        return;   // no blind retry — renewAndRestart() drives what happens next
    }

    emit statusChanged(tr("Disconnected — retrying…"));
    scheduleReconnect();
}

void PriceStream::onError() {
    emit statusChanged(tr("Stream error: %1").arg(m_ws.errorString()));
    // disconnected() will fire and trigger reconnect if wanted.
}

void PriceStream::onTextMessage(const QString& msg) {
    const QJsonObject o = QJsonDocument::fromJson(msg.toUtf8()).object();

    // Auth acknowledgement
    if (o.value("status").toString() == "authenticated") {
        m_authed = true;
        m_retryMs = kRetryFloorMs;   // a good connection clears the backoff
        const QString acct = o.value("account").toString();
        emit statusChanged(tr("Live • account %1").arg(acct));
        emit authenticated(acct);
        return;
    }

    const QString type = o.value("type").toString();
    if (type == "tick") {
        Quote q;
        q.symbol = o.value("symbol").toString();
        q.bid    = o.value("bid").toDouble();
        q.ask    = o.value("ask").toDouble();
        q.spread = o.value("spread").toDouble();
        q.timestamp = QDateTime::fromString(o.value("timestamp").toString(), Qt::ISODateWithMs);
        q.valid  = !q.symbol.isEmpty();
        if (q.valid) emit tickReceived(q);
    } else if (type == "ping") {
        QJsonObject pong; pong["type"] = "pong";
        m_ws.sendTextMessage(QString::fromUtf8(QJsonDocument(pong).toJson(QJsonDocument::Compact)));
    }
}

void PriceStream::scheduleReconnect() {
    if (!m_wantRun || m_reconnectTimer.isActive()) return;
    m_reconnectTimer.start(m_retryMs);
    // Double up to a minute. A terminal left open overnight against a dead
    // endpoint used to make 900 attempts an hour and repaint the status bar
    // with each one; it now settles at one a minute.
    m_retryMs = qMin(m_retryMs * 2, kRetryCeilMs);
}
