#include "ui/EmbedProfile.h"
#include <QWebEngineProfile>
#include <QCoreApplication>
#include <QStandardPaths>
#include <QDir>

QWebEngineProfile* embedProfile() {
    static QWebEngineProfile* profile = nullptr;
    if (profile) return profile;

    // A NAMED profile is the whole point: an unnamed one is off-the-record and
    // silently keeps nothing, which is the bug this function exists to fix.
    // Parented to the application so it outlives every page built on it —
    // destroying a profile while a page still uses it crashes the renderer.
    profile = new QWebEngineProfile(QStringLiteral("prolinemarket-embeds"),
                                    QCoreApplication::instance());

    // CacheLocation, not AppDataLocation. On Windows the latter is the ROAMING
    // profile, so on a domain account this cache — around 11 MB of somebody
    // else's JavaScript — would be copied to the server at every sign-out and
    // back at every sign-in. A cache is by definition rebuildable and belongs
    // on the local disk.
    const QString base =
        QStandardPaths::writableLocation(QStandardPaths::CacheLocation);
    if (!base.isEmpty()) {
        const QString dir = base + QStringLiteral("/embeds");
        QDir().mkpath(dir);
        profile->setCachePath(dir);
        profile->setPersistentStoragePath(dir);
    }

    profile->setHttpCacheType(QWebEngineProfile::DiskHttpCache);
    // 64 MB. The widget bundles are a few MB; this leaves room for their fonts
    // and sprites without letting a third party grow unbounded on disk.
    profile->setHttpCacheMaximumSize(64 * 1024 * 1024);
    // Session cookies still work in memory — the widgets need none to render,
    // and nothing of theirs should survive on disk.
    profile->setPersistentCookiesPolicy(QWebEngineProfile::NoPersistentCookies);

    return profile;
}
