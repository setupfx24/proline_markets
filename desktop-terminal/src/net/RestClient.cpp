#include "net/RestClient.h"
#include "core/Session.h"

#include <QNetworkAccessManager>
#include <QNetworkRequest>
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrl>

RestClient::RestClient(Session *session, QObject *parent)
    : QObject(parent)
    , m_session(session)
    , m_nam(new QNetworkAccessManager(this))
{
}

void RestClient::get(const QString &path, Callback cb)
{
    send(Method::Get, path, {}, std::move(cb));
}

void RestClient::post(const QString &path, const QJsonObject &body, Callback cb)
{
    send(Method::Post, path, body, std::move(cb));
}

void RestClient::put(const QString &path, const QJsonObject &body, Callback cb)
{
    send(Method::Put, path, body, std::move(cb));
}

void RestClient::del(const QString &path, Callback cb)
{
    send(Method::Delete, path, {}, std::move(cb));
}

void RestClient::send(Method method, const QString &path,
                      const QJsonObject &body, Callback cb)
{
    QNetworkRequest req(QUrl(m_session->apiBase() + path));
    req.setHeader(QNetworkRequest::ContentTypeHeader,
                  QStringLiteral("application/json"));
    req.setRawHeader("Accept", "application/json");
    if (m_session->isAuthenticated()) {
        req.setRawHeader("Authorization",
                         "Bearer " + m_session->token().toUtf8());
    }

    const QByteArray payload =
        body.isEmpty() ? QByteArray()
                       : QJsonDocument(body).toJson(QJsonDocument::Compact);

    QNetworkReply *reply = nullptr;
    switch (method) {
    case Method::Get:    reply = m_nam->get(req); break;
    case Method::Post:   reply = m_nam->post(req, payload); break;
    case Method::Put:    reply = m_nam->put(req, payload); break;
    case Method::Delete: reply = m_nam->deleteResource(req); break;
    }

    QObject::connect(reply, &QNetworkReply::finished, this,
                     [reply, cb = std::move(cb)]() {
        reply->deleteLater();

        const int status = reply->attribute(
            QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray raw = reply->readAll();

        QJsonParseError perr{};
        const QJsonDocument doc = raw.isEmpty()
                                      ? QJsonDocument()
                                      : QJsonDocument::fromJson(raw, &perr);
        QJsonValue data;
        if (doc.isObject())      data = doc.object();
        else if (doc.isArray())  data = doc.array();

        const bool httpOk = status >= 200 && status < 300;
        const bool transportOk = reply->error() == QNetworkReply::NoError;

        if (httpOk && transportOk) {
            cb(true, status, data, QString());
            return;
        }

        // Build the best available error message.
        QString err;
        if (doc.isObject()) {
            const QJsonObject o = doc.object();
            const QJsonValue detail = o.value(QStringLiteral("detail"));
            if (detail.isString())
                err = detail.toString();
            else if (detail.isArray() && !detail.toArray().isEmpty()) {
                // FastAPI validation errors: [{"msg": ...}]
                const QJsonObject first = detail.toArray().first().toObject();
                err = first.value(QStringLiteral("msg")).toString();
            } else if (o.contains(QStringLiteral("message"))) {
                err = o.value(QStringLiteral("message")).toString();
            }
        }
        if (err.isEmpty())
            err = status > 0 ? QStringLiteral("Request failed (HTTP %1)").arg(status)
                             : reply->errorString();

        cb(false, status, data, err);
    });
}
