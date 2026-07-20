#include <QApplication>
#include <QPalette>
#include <QStyleFactory>
#include "core/Config.h"
#include "core/Models.h"
#include "ui/LoginDialog.h"
#include "ui/MainWindow.h"
#include "ui/Theme.h"

static void applyDarkTheme(QApplication& app) {
    app.setStyle(QStyleFactory::create("Fusion"));
    QPalette p;
    p.setColor(QPalette::Window,          QColor("#16181d"));
    p.setColor(QPalette::WindowText,      QColor("#e0e0e0"));
    p.setColor(QPalette::Base,            QColor("#1b1d22"));
    p.setColor(QPalette::AlternateBase,   QColor("#1f2228"));
    p.setColor(QPalette::Text,            QColor("#e0e0e0"));
    p.setColor(QPalette::Button,          QColor("#24272e"));
    p.setColor(QPalette::ButtonText,      QColor("#e0e0e0"));
    p.setColor(QPalette::Highlight,       QColor("#2d6df6"));
    p.setColor(QPalette::HighlightedText, Qt::white);
    p.setColor(QPalette::ToolTipBase,     QColor("#24272e"));
    p.setColor(QPalette::ToolTipText,     QColor("#e0e0e0"));
    p.setColor(QPalette::Disabled, QPalette::Text,       QColor("#6b7077"));
    p.setColor(QPalette::Disabled, QPalette::ButtonText, QColor("#6b7077"));
    app.setPalette(p);
}

int main(int argc, char* argv[]) {
    QApplication app(argc, argv);
    app.setApplicationName("Bull4x Terminal");
    app.setOrganizationName("Bull4x");

    qRegisterMetaType<Quote>("Quote");
    qRegisterMetaType<AccountInfo>("AccountInfo");
    qRegisterMetaType<TradeResult>("TradeResult");

    applyDarkTheme(app);
    app.setStyleSheet(Theme::styleSheet());

    Config cfg = Config::load();

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
