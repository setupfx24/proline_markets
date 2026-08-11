#include "ui/Theme.h"
#include <QColor>

namespace Theme {
namespace {

const Palette DARK = {
    /* bg           */ "#0e0f13",
    /* panel        */ "#16181d",
    /* panelAlt     */ "#1a1d23",
    /* headerBg     */ "#101216",
    /* border       */ "#24272e",

    /* text         */ "#d6d9de",
    /* textStrong   */ "#e6e9ee",
    /* muted        */ "#7c828c",
    /* dim          */ "#6b7280",

    /* accent       */ "#3b82f6",
    /* accentHover  */ "#2563eb",
    /* up           */ "#26a269",
    /* down         */ "#e01b24",
    /* warn         */ "#f59e0b",

    /* inputBg      */ "#1a1d23",
    /* inputBorder  */ "#2a2e36",

    /* cardBg       */ "#14161b",
    /* cardBorder   */ "#23262e",
    /* cardHover    */ "#3a4358",
    /* cardSelBg    */ "#172033",
    /* cardSelBorder*/ "#3b82f6",

    /* tableBg      */ "#0f1115",
    /* tableAlt     */ "#12141a",
    /* rowHover     */ "#171b22",
    /* rowSel       */ "#1c2b4a",
    /* rowSelText   */ "#ffffff",

    /* btnBg        */ "#22262e",
    /* btnBorder    */ "#2f343d",
    /* btnHover     */ "#2a2f39",
    /* btnPressed   */ "#1c2027",

    /* menuBg       */ "#16181d",
    /* menuBorder   */ "#2a2e36",
    /* menuSel      */ "#1e2a44",

    /* scrollHandle */ "#2c313a",
    /* scrollHover  */ "#3a404b",

    /* chartBg      */ "#0e0f13",
};

// MetaTrader-style light scheme: grey window chrome, white data surfaces, a
// visible 1px grid on every table and a deep-blue brand/accent. The terminal
// defaults to this mode because the MT5 layout it now mirrors is a light UI.
const Palette LIGHT = {
    /* bg           */ "#eef0f3",
    /* panel        */ "#f4f5f7",
    /* panelAlt     */ "#e6e9ee",
    /* headerBg     */ "#1a5fb4",   // the blue brand strip above the menu bar
    /* border       */ "#c3c8d1",

    /* text         */ "#1f2430",
    /* textStrong   */ "#0d1117",
    /* muted        */ "#5a6472",
    /* dim          */ "#8a94a3",

    /* accent       */ "#1a5fb4",
    /* accentHover  */ "#14498a",
    /* up           */ "#127a35",
    /* down         */ "#c01c28",
    /* warn         */ "#b45309",

    /* inputBg      */ "#ffffff",
    /* inputBorder  */ "#b9bfca",

    /* cardBg       */ "#ffffff",
    /* cardBorder   */ "#c3c8d1",
    /* cardHover    */ "#8fb0dd",
    /* cardSelBg    */ "#cfe0f7",
    /* cardSelBorder*/ "#1a5fb4",

    /* tableBg      */ "#ffffff",
    /* tableAlt     */ "#f6f8fa",
    /* rowHover     */ "#e8f0fb",
    /* rowSel       */ "#cfe0f7",
    /* rowSelText   */ "#0d1117",

    /* btnBg        */ "#e9ecf1",
    /* btnBorder    */ "#b9bfca",
    /* btnHover     */ "#dde2ea",
    /* btnPressed   */ "#ccd3dd",

    /* menuBg       */ "#ffffff",
    /* menuBorder   */ "#b9bfca",
    /* menuSel      */ "#cfe0f7",

    /* scrollHandle */ "#b6bcc7",
    /* scrollHover  */ "#98a0ad",

    /* chartBg      */ "#ffffff",
};

// Light is the default: the terminal mirrors MT5's light desktop layout.
Mode g_mode = Mode::Light;

} // namespace

Notifier* notifier() {
    static Notifier n;
    return &n;
}

Mode mode()   { return g_mode; }
bool isDark() { return g_mode == Mode::Dark; }

void setMode(Mode m) {
    if (m == g_mode) return;
    g_mode = m;
    emit notifier()->changed();
}

const Palette& p() { return isDark() ? DARK : LIGHT; }

QString name() { return isDark() ? "dark" : "light"; }

Mode fromName(const QString& n) {
    return n.compare("light", Qt::CaseInsensitive) == 0 ? Mode::Light : Mode::Dark;
}

QPalette qtPalette() {
    const Palette& c = p();
    QPalette q;
    q.setColor(QPalette::Window,          QColor(c.bg));
    q.setColor(QPalette::WindowText,      QColor(c.text));
    q.setColor(QPalette::Base,            QColor(c.panelAlt));
    q.setColor(QPalette::AlternateBase,   QColor(c.tableAlt));
    q.setColor(QPalette::Text,            QColor(c.text));
    q.setColor(QPalette::Button,          QColor(c.btnBg));
    q.setColor(QPalette::ButtonText,      QColor(c.text));
    q.setColor(QPalette::Highlight,       QColor(c.accent));
    q.setColor(QPalette::HighlightedText, QColor(isDark() ? "#ffffff" : "#ffffff"));
    q.setColor(QPalette::ToolTipBase,     QColor(c.panel));
    q.setColor(QPalette::ToolTipText,     QColor(c.text));
    q.setColor(QPalette::PlaceholderText, QColor(c.dim));
    q.setColor(QPalette::Disabled, QPalette::Text,       QColor(c.dim));
    q.setColor(QPalette::Disabled, QPalette::ButtonText, QColor(c.dim));
    return q;
}

QString styleSheet() {
    const Palette& c = p();
    return QString(R"QSS(
/* MetaTrader-style density: small type, tight rows, a visible grid. Every rule
   below is deliberately compact — the point of this layout is to fit a market
   watch, a chart and the full trade blotter on one screen. */
* { font-family: "Segoe UI", "Inter", sans-serif; font-size: 11px; }

QMainWindow, QWidget { background: %BG%; color: %TEXT%; }
QMainWindow::separator { background: %BORDER%; width: 1px; height: 1px; }
QSplitter::handle { background: %BORDER%; }
QSplitter::handle:horizontal { width: 3px; }
QSplitter::handle:vertical   { height: 3px; }

/* ---- Menu bar (File / Accounts / View) ---- */
QMenuBar {
    background: %PANEL%; color: %TEXT%;
    border-bottom: 1px solid %BORDER%; padding: 1px 4px;
}
/* A hairline after every entry, so the menu row reads as separated cells
   rather than floating words. The identity block draws its own matching
   divider — see MainWindow::buildMenuBar. */
/* The vertical margin shrinks the item box so its right border is only as tall
   as the label — a full-height rule read as a table gridline. */
QMenuBar::item { background: transparent; padding: 2px 12px; margin: 5px 0;
                 border-right: 1px solid %BORDER%; }
QMenuBar::item:selected { background: %MENUSEL%; color: %TEXTSTRONG%; }

/* ---- Tables (market watch + trade blotter) ---- */
QTableWidget, QTableView {
    background: %TABLEBG%; alternate-background-color: %TABLEALT%;
    gridline-color: %BORDER%; border: none; outline: none;
    selection-background-color: %ROWSEL%; selection-color: %ROWSELTEXT%;
}
QTableWidget::item { padding: 2px 6px; border: none; }
QTableWidget::item:hover    { background: %ROWHOVER%; }
QTableWidget::item:selected { background: %ROWSEL%; color: %ROWSELTEXT%; }
QHeaderView::section {
    background: %PANELALT%; color: %MUTED%; padding: 4px 6px;
    border: none; border-right: 1px solid %BORDER%; border-bottom: 1px solid %BORDER%;
    font-weight: 600; font-size: 11px;
}
QTableCornerButton::section { background: %PANELALT%; border: none; }

/* ---- Tabs — MT5 draws them as small boxed tabs under the blotter ---- */
QTabWidget::pane { border: 1px solid %BORDER%; background: %TABLEBG%; top: -1px; }
QTabBar { background: %PANELALT%; }
QTabBar::tab {
    background: %PANELALT%; color: %MUTED%;
    padding: 4px 14px; margin-right: 1px;
    border: 1px solid %BORDER%;
    font-weight: 600; font-size: 11px;
}
QTabBar::tab:selected      { background: %TABLEBG%; color: %TEXTSTRONG%; border-bottom-color: %TABLEBG%; }
QTabBar::tab:hover:!selected { background: %ROWHOVER%; color: %TEXT%; }

/* ---- Inputs ---- */
QLineEdit, QDoubleSpinBox, QSpinBox, QComboBox {
    background: %INPUTBG%; color: %TEXTSTRONG%;
    border: 1px solid %INPUTBORDER%; border-radius: 3px;
    padding: 3px 6px; selection-background-color: %ACCENT%;
}
QLineEdit:focus, QDoubleSpinBox:focus, QSpinBox:focus, QComboBox:focus {
    border: 1px solid %ACCENT%;
}
QComboBox::drop-down { border: none; width: 22px; }
QComboBox QAbstractItemView {
    background: %MENUBG%; color: %TEXTSTRONG%; border: 1px solid %MENUBORDER%;
    selection-background-color: %ACCENT%; outline: none;
}
QDoubleSpinBox::up-button, QDoubleSpinBox::down-button,
QSpinBox::up-button, QSpinBox::down-button { width: 16px; background: %BTNBG%; border: none; }
QDoubleSpinBox::up-button:hover, QDoubleSpinBox::down-button:hover { background: %BTNHOVER%; }

/* ---- Buttons ---- */
QPushButton {
    background: %BTNBG%; color: %TEXT%;
    border: 1px solid %BTNBORDER%; border-radius: 3px; padding: 4px 10px; font-weight: 600;
}
QPushButton:hover { background: %BTNHOVER%; }
QPushButton:pressed { background: %BTNPRESSED%; }
QPushButton:disabled { color: %DIM%; background: %PANELALT%; }

/* ---- Status bar ---- */
QStatusBar { background: %PANEL%; color: %MUTED%; border-top: 1px solid %BORDER%; }
QStatusBar::item { border: none; }

/* ---- Scrollbars ---- */
QScrollBar:vertical { background: transparent; width: 10px; margin: 0; }
QScrollBar::handle:vertical { background: %SCROLL%; border-radius: 5px; min-height: 30px; }
QScrollBar::handle:vertical:hover { background: %SCROLLHOVER%; }
QScrollBar:horizontal { background: transparent; height: 10px; }
QScrollBar::handle:horizontal { background: %SCROLL%; border-radius: 5px; min-width: 30px; }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }

/* ---- Tooltips / menus ---- */
QToolTip { background: %PANELALT%; color: %TEXTSTRONG%; border: 1px solid %BTNBORDER%; padding: 5px 8px; }
QMenu { background: %MENUBG%; color: %TEXT%; border: 1px solid %MENUBORDER%; }
QMenu::item:selected { background: %MENUSEL%; }
)QSS")
        .replace("%BG%",          c.bg)
        .replace("%PANELALT%",    c.panelAlt)
        .replace("%PANEL%",       c.panel)
        .replace("%HEADERBG%",    c.headerBg)
        .replace("%BORDER%",      c.border)
        .replace("%TEXTSTRONG%",  c.textStrong)
        .replace("%TEXT%",        c.text)
        .replace("%MUTED%",       c.muted)
        .replace("%DIM%",         c.dim)
        .replace("%ACCENT%",      c.accent)
        .replace("%INPUTBG%",     c.inputBg)
        .replace("%INPUTBORDER%", c.inputBorder)
        .replace("%TABLEBG%",     c.tableBg)
        .replace("%TABLEALT%",    c.tableAlt)
        .replace("%ROWHOVER%",    c.rowHover)
        .replace("%ROWSELTEXT%",  c.rowSelText)
        .replace("%ROWSEL%",      c.rowSel)
        .replace("%BTNBORDER%",   c.btnBorder)
        .replace("%BTNHOVER%",    c.btnHover)
        .replace("%BTNPRESSED%",  c.btnPressed)
        .replace("%BTNBG%",       c.btnBg)
        .replace("%MENUBORDER%",  c.menuBorder)
        .replace("%MENUSEL%",     c.menuSel)
        .replace("%MENUBG%",      c.menuBg)
        .replace("%SCROLLHOVER%", c.scrollHandleHover)
        .replace("%SCROLL%",      c.scrollHandle);
}

} // namespace Theme
