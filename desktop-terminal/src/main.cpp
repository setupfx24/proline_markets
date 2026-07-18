// Proline Terminal — entry point.
//
// Boot flow: show the LoginDialog; on success construct the MainWindow shell.
// Networking is wired through RestClient (HTTP) + Api (typed calls) sharing a
// single Session that holds the target server and auth state.

#include <QApplication>

#include "core/Session.h"
#include "net/RestClient.h"
#include "net/Api.h"
#include "ui/LoginDialog.h"
#include "ui/MainWindow.h"

#ifndef PROLINE_APP_VERSION
#define PROLINE_APP_VERSION "dev"
#endif

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    QApplication::setApplicationName(QStringLiteral("Proline Terminal"));
    QApplication::setOrganizationName(QStringLiteral("Proline Markets"));
    QApplication::setOrganizationDomain(QStringLiteral("prolinemarket.com"));
    QApplication::setApplicationVersion(QStringLiteral(PROLINE_APP_VERSION));

    Session session;
    RestClient rest(&session);
    Api api(&rest, &session);

    // Dev convenience: PROLINE_DEV_UI=1 skips login and opens the terminal shell
    // directly (empty panels if no backend) — used for UI previews/screenshots.
    if (!qEnvironmentVariableIsSet("PROLINE_DEV_UI")) {
        LoginDialog login(&api, &session);
        if (login.exec() != QDialog::Accepted)
            return 0;
    } else {
        session.setApiBase(QStringLiteral("http://localhost:8000"));
    }

    auto *window = new MainWindow(&api, &session);
    window->setAttribute(Qt::WA_DeleteOnClose);
    window->show();

    return app.exec();
}
