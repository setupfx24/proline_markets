#include <QApplication>
#include <QStyleFactory>
#include <QIcon>
#include "core/Config.h"
#include "core/Models.h"
#include "ui/LoginDialog.h"
#include "ui/MainWindow.h"
#include "ui/Theme.h"

// Re-applies the active theme to the whole application. Called at startup and
// again whenever the user flips the light/dark switch.
static void applyTheme(QApplication& app) {
    app.setStyle(QStyleFactory::create("Fusion"));
    app.setPalette(Theme::qtPalette());
    app.setStyleSheet(Theme::styleSheet());
}

#ifdef Q_OS_WIN
// NOMINMAX / WIN32_LEAN_AND_MEAN before windows.h: it otherwise defines min()
// and max() as macros, which collide with std:: and Qt's templates in anything
// compiled after this point.
#  define WIN32_LEAN_AND_MEAN
#  define NOMINMAX
#  include <windows.h>
// Held for the process lifetime purely so the Inno Setup installer can see
// that the terminal is running (installer.iss: AppMutex). Without it, Setup
// only had Restart Manager to go on, which does not register the files
// QtWebEngine keeps mapped (icudtl.dat, *.pak, v8_context_snapshot.bin) — so
// an install over a running copy got as far as the first locked file and
// failed with "DeleteFile failed; code 32".
//
// Deliberately NOT a single-instance guard: the name must match installer.iss,
// and a second terminal window is still allowed to open. Windows frees the
// handle when the process dies, including a crash, so it can never go stale.
static void holdInstallerMutex() {
    static HANDLE h = nullptr;
    if (!h) h = ::CreateMutexW(nullptr, FALSE, L"ProlineMarketsTerminal.SingleInstance");
}
#endif

int main(int argc, char* argv[]) {
    QApplication app(argc, argv);
#ifdef Q_OS_WIN
    holdInstallerMutex();
#endif
    // These two also decide where Config writes its file (AppConfigLocation is
    // derived from them), so changing them relocates the saved session.
    app.setApplicationName("Proline Markets Terminal");
    app.setOrganizationName("Proline Markets");
    // Brand mark on the window title bar / taskbar, so it's obvious at a glance
    // which platform's terminal this is. (The EXE's own icon comes from
    // resources/app.rc, which is what Explorer and the desktop shortcut use.)
    app.setWindowIcon(QIcon(":/prolinemarket-256.png"));

    qRegisterMetaType<Quote>("Quote");
    qRegisterMetaType<AccountInfo>("AccountInfo");
    qRegisterMetaType<TradeResult>("TradeResult");

    Config cfg = Config::load();
    Theme::setMode(Theme::fromName(cfg.theme));
    applyTheme(app);

    // Every mode switch re-applies the palette + global sheet; individual
    // widgets restyle their own inline styles off the same signal.
    QObject::connect(Theme::notifier(), &Theme::Notifier::changed,
                     &app, [&app]() { applyTheme(app); });

    // First run (or no creds) -> ask for credentials up front.
    if (!cfg.hasCredentials()) {
        LoginDialog dlg(cfg);
        if (dlg.exec() != QDialog::Accepted)
            return 0;
        cfg = dlg.config();
    }

    MainWindow w(cfg);
    w.show();
    return app.exec();
}
