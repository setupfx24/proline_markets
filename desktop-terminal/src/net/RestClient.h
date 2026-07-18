#pragma once

#include <QObject>
#include <QJsonValue>
#include <QJsonObject>
#include <functional>

class Session;
class QNetworkAccessManager;

// Thin async wrapper over QNetworkAccessManager. Prepends Session::apiBase() to
// the given path, attaches the Bearer token when authenticated, sends/parses
// JSON, and invokes the callback with a normalized result.
class RestClient : public QObject
{
    Q_OBJECT
public:
    // ok       : true on HTTP 2xx with parseable (or empty) body
    // status   : HTTP status code (0 on transport failure)
    // data     : parsed JSON body (object or array), or Null
    // error    : human-readable message (FastAPI "detail" when present)
    using Callback = std::function<void(bool ok, int status,
                                        const QJsonValue &data,
                                        const QString &error)>;

    RestClient(Session *session, QObject *parent = nullptr);

    void get(const QString &path, Callback cb);
    void post(const QString &path, const QJsonObject &body, Callback cb);
    void put(const QString &path, const QJsonObject &body, Callback cb);
    void del(const QString &path, Callback cb);

private:
    enum class Method { Get, Post, Put, Delete };
    void send(Method method, const QString &path,
              const QJsonObject &body, Callback cb);

    Session *m_session;
    QNetworkAccessManager *m_nam;
};
