#include "core/PriceStream.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QAbstractSocket>
#include <QUrlQuery>

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
            m_ws.open(streamUrl());
        }
    });
}

// /ws/prices takes an optional ?token= and validates it only when present.
// The token is still sent so an invalid session is rejected up front (close
// 4001) instead of silently streaming to a signed-out client.
QUrl PriceStream::streamUrl() const {
    QUrl url(m_cfg.wsUrl);
    if (!m_cfg.token.isEmpty()) {
        QUrlQuery q(url.query());
        q.removeAllQueryItems("token");
        q.addQueryItem("token", m_cfg.token);
        url.setQuery(q);
    }
    return url;
}

void PriceStream::start() {
    m_wantRun = true;
    emit statusChanged(tr("Connecting…"));
    m_ws.open(streamUrl());
}

void PriceStream::stop() {
    m_wantRun = false;
    m_reconnectTimer.stop();
    m_ws.close();
}

void PriceStream::onConnected() {
    // /ws/prices authenticates from the query string and never reads the
    // socket, so there is no auth frame to send and no ack to wait for — an
    // accepted connection is already a live one. The previous first-message
    // handshake belonged to /ws/algo/prices and would have hung here forever.
    m_authed = true;
    emit statusChanged(tr("Live"));
    emit authenticated(m_cfg.accountId);
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

    // Keepalive. The server ignores whatever we send back, so nothing is
    // returned — the frame just has to not be mistaken for a tick.
    if (o.value("type").toString() == "ping") return;

    // Ticks are forwarded verbatim from the price feed and carry no envelope
    // or "type" field, so they are recognised by shape. Requiring type=="tick"
    // (the old /ws/algo/prices contract) silently dropped every quote.
    if (!o.contains("symbol")) return;

    Quote q;
    q.symbol = o.value("symbol").toString();
    q.bid    = o.value("bid").toDouble();
    q.ask    = o.value("ask").toDouble();
    q.spread = o.value("spread").toDouble();
    q.timestamp = QDateTime::fromString(o.value("timestamp").toString(), Qt::ISODateWithMs);
    q.valid  = !q.symbol.isEmpty();
    if (q.valid) emit tickReceived(q);
}

void PriceStream::scheduleReconnect() {
    if (m_wantRun && !m_reconnectTimer.isActive())
        m_reconnectTimer.start();
}
