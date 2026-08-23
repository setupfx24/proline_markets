#pragma once
#include <QString>
#include <QObject>
#include <QPalette>

// Central theme for the whole terminal — a light and a dark palette plus the
// global Qt style sheet built from whichever is active.
//
// Widgets must NOT hard-code colours. They read Theme::p() and rebuild their
// own inline style sheets in an applyTheme() slot connected to
// Theme::notifier()::changed(), which fires whenever the mode is switched.
namespace Theme {

enum class Mode { Dark, Light };

struct Palette {
    // surfaces
    QString bg, panel, panelAlt, headerBg, border;
    // type
    QString text, textStrong, muted, dim;
    // semantic
    QString accent, accentHover, up, down, warn;
    // inputs
    QString inputBg, inputBorder;
    // watchlist cards
    QString cardBg, cardBorder, cardHover, cardSelBg, cardSelBorder;
    // tables
    QString tableBg, tableAlt, rowHover, rowSel, rowSelText;
    // buttons
    QString btnBg, btnBorder, btnHover, btnPressed;
    // menus / popups
    QString menuBg, menuBorder, menuSel;
    // scrollbars
    QString scrollHandle, scrollHandleHover;
    // the embedded chart ("dark" | "light" for TradingView)
    QString chartBg;
};

// Emits changed() when the mode is switched; widgets restyle themselves on it.
class Notifier : public QObject {
    Q_OBJECT
public:
    explicit Notifier(QObject* parent = nullptr) : QObject(parent) {}
signals:
    void changed();
};

Notifier* notifier();

Mode            mode();
bool            isDark();
void            setMode(Mode m);          // no-op if unchanged; else emits changed()
const Palette&  p();
QString         styleSheet();             // global app style sheet for the active mode
QPalette        qtPalette();              // QPalette for the Fusion style
QString         name();                   // "dark" | "light"
Mode            fromName(const QString& n);

} // namespace Theme
