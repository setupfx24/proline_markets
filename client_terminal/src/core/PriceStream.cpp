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
    m_reconnectTimer.setInterval(4000);
    connect(&m_reconnectTimer, &QTimer::timeout, this, [this]() {
        if (m_wantRun) {
            emit statusChanged(tr("Reconnecting…"));
            m_ws.open(QUrl(m_cfg.wsUrl));
        }
    });
}

void PriceStream::start() {
    m_wantRun = true;
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
    if (!m_cfg.token.isEmpty()) {
        auth["token"] = m_cfg.token;           // desktop-terminal JWT
    } else {
        auth["api_key"]    = m_cfg.apiKey;
        auth["api_secret"] = m_cfg.apiSecret;
    }
    m_ws.sendTextMessage(QString::fromUtf8(QJsonDocument(auth).toJson(QJsonDocument::Compact)));
}

void PriceStream::onDisconnected() {
    m_authed = false;
    if (m_wantRun) {
        emit statusChanged(tr("Disconnected — retrying…"));
        scheduleReconnect();
    } else {
        emit statusChanged(tr("Stopped"));
    }
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
    if (m_wantRun && !m_reconnectTimer.isActive())
        m_reconnectTimer.start();
}
