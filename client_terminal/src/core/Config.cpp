#include "core/Config.h"
#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>

QString Config::filePath() {
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppConfigLocation);
    if (dir.isEmpty())
        dir = QDir::homePath() + "/.proline-terminal";
    QDir().mkpath(dir);
    return dir + "/config.json";
}

Config Config::load() {
    Config c;
    QFile f(filePath());
    if (!f.open(QIODevice::ReadOnly))
        return c; // defaults

    const QJsonObject o = QJsonDocument::fromJson(f.readAll()).object();
    if (o.contains("token"))     c.token     = o.value("token").toString();
    if (o.contains("accountId")) c.accountId = o.value("accountId").toString();
    if (o.contains("userName"))  c.userName  = o.value("userName").toString();
    if (o.contains("accountsJson")) c.accountsJson = o.value("accountsJson").toString();
    if (o.contains("apiKey"))    c.apiKey    = o.value("apiKey").toString();
    if (o.contains("apiSecret")) c.apiSecret = o.value("apiSecret").toString();
    if (o.contains("restBase") && !o.value("restBase").toString().isEmpty())
        c.restBase = o.value("restBase").toString();
    if (o.contains("wsUrl") && !o.value("wsUrl").toString().isEmpty())
        c.wsUrl = o.value("wsUrl").toString();

    // Anyone who ran an earlier build has /api/algo saved to disk, and a saved
    // value wins over the default — so without this they would keep hitting
    // the endpoints that do not exist and see nothing but 401s.
    c.restBase.replace("/api/algo", "/api/v1");
    c.wsUrl.replace("/ws/algo/prices", "/ws/prices");
    return c;
}

bool Config::save() const {
    QJsonObject o;
    o["token"]        = token;
    o["accountId"]    = accountId;
    o["userName"]     = userName;
    o["accountsJson"] = accountsJson;
    o["apiKey"]       = apiKey;
    o["apiSecret"]    = apiSecret;
    o["restBase"]     = restBase;
    o["wsUrl"]        = wsUrl;

    QFile f(filePath());
    if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate))
        return false;
    f.write(QJsonDocument(o).toJson(QJsonDocument::Indented));
    return true;
}
