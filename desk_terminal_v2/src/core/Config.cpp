#include "core/Config.h"
#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>

QString Config::filePath() {
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppConfigLocation);
    if (dir.isEmpty())
        dir = QDir::homePath() + "/.prolinemarket-terminal";
    QDir().mkpath(dir);
    return dir + "/config.json";
}

// NO legacy config migration — deliberately.
//
// This terminal was forked from an earlier white-label build, which did carry
// its config forward on each rename because those were renames of the same
// broker: the same account, the same backend, only the host moved. Proline Markets is a
// *different platform*. A token or API key from that build authenticates nothing
// here, and adopting one would also drag its endpoints in, pointing this build
// at another broker's API. So a Proline Markets install starts with a clean config and
// a real sign-in.
//
// For the same reason nothing deletes those files either: the terminal it was
// forked from may still be installed on this machine and its config is its own.

Config Config::load() {
    Config c;
    QFile f(filePath());
    if (!f.open(QIODevice::ReadOnly))
        return c; // defaults

    const QJsonObject o = QJsonDocument::fromJson(f.readAll()).object();
    if (o.contains("token"))     c.token     = o.value("token").toString();
    if (o.contains("refreshToken")) c.refreshToken = o.value("refreshToken").toString();
    if (o.contains("accountId")) c.accountId = o.value("accountId").toString();
    if (o.contains("userName"))  c.userName  = o.value("userName").toString();
    if (o.contains("email"))     c.email     = o.value("email").toString();
    if (o.contains("readOnly"))  c.readOnly  = o.value("readOnly").toBool();
    if (o.contains("theme"))     c.theme     = o.value("theme").toString("dark");
    if (o.contains("privacy"))   c.privacy   = o.value("privacy").toBool();
    if (o.contains("accountsJson")) c.accountsJson = o.value("accountsJson").toString();
    if (o.contains("apiKey"))    c.apiKey    = o.value("apiKey").toString();
    if (o.contains("apiSecret")) c.apiSecret = o.value("apiSecret").toString();
    // Clamped on the way in: a hand-edited or corrupt file must not put the
    // grid into a state setChartCount() would reject anyway.
    if (o.contains("chartCount"))
        c.chartCount = qBound(1, o.value("chartCount").toInt(1), 4);
    if (o.contains("chartSymbols")) {
        c.chartSymbols.clear();
        for (const QJsonValue& v : o.value("chartSymbols").toArray())
            c.chartSymbols << v.toString();
    }
    if (o.contains("webBase") && !o.value("webBase").toString().isEmpty())
        c.webBase = o.value("webBase").toString();
    if (o.contains("favourites")) {
        c.favourites.clear();
        for (const QJsonValue& v : o.value("favourites").toArray())
            c.favourites << v.toString();
    }
    if (o.contains("restBase") && !o.value("restBase").toString().isEmpty())
        c.restBase = o.value("restBase").toString();
    if (o.contains("wsUrl") && !o.value("wsUrl").toString().isEmpty())
        c.wsUrl = o.value("wsUrl").toString();
    return c;
}

bool Config::save() const {
    QJsonObject o;
    o["token"]        = token;
    o["refreshToken"] = refreshToken;
    o["accountId"]    = accountId;
    o["userName"]     = userName;
    o["email"]        = email;
    o["readOnly"]     = readOnly;
    o["theme"]        = theme;
    o["privacy"]      = privacy;
    o["accountsJson"] = accountsJson;
    o["apiKey"]       = apiKey;
    o["apiSecret"]    = apiSecret;
    o["webBase"]      = webBase;
    o["favourites"]   = QJsonArray::fromStringList(favourites);
    o["restBase"]     = restBase;
    o["wsUrl"]        = wsUrl;
    o["chartCount"]   = chartCount;
    o["chartSymbols"] = QJsonArray::fromStringList(chartSymbols);

    QFile f(filePath());
    if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate))
        return false;
    f.write(QJsonDocument(o).toJson(QJsonDocument::Indented));
    return true;
}
