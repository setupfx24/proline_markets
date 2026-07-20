#pragma once
#include <QString>

// A cohesive, modern dark theme for the whole terminal, applied as a global
// Qt style sheet. Palette matches the embedded TradingView chart (#0e0f13).
namespace Theme {

// Accent + semantic colours reused across custom-painted widgets.
constexpr const char* Bg        = "#0e0f13";
constexpr const char* Panel     = "#16181d";
constexpr const char* PanelAlt  = "#1a1d23";
constexpr const char* Border    = "#24272e";
constexpr const char* Text      = "#d6d9de";
constexpr const char* Muted     = "#7c828c";
constexpr const char* Accent    = "#3b82f6";
constexpr const char* Up        = "#26a269";
constexpr const char* Down      = "#e01b24";

inline QString styleSheet() {
    return R"QSS(
* { font-family: "Segoe UI", "Inter", sans-serif; font-size: 12px; }

QMainWindow, QWidget { background: #0e0f13; color: #d6d9de; }

/* ---- Dock panels ---- */
QDockWidget {
    titlebar-close-icon: none; titlebar-normal-icon: none;
    color: #7c828c; font-weight: 600; font-size: 11px;
}
QDockWidget::title {
    background: #16181d; padding: 7px 12px;
    border-bottom: 1px solid #24272e;
    text-transform: uppercase; letter-spacing: 1px;
}
QDockWidget > QWidget { background: #101216; }
QMainWindow::separator { background: #24272e; width: 1px; height: 1px; }

/* ---- Section header labels (inside widgets) ---- */
QLabel[role="header"] {
    color: #7c828c; font-weight: 700; font-size: 10px;
    letter-spacing: 1.5px; padding: 8px 10px 4px 10px;
}

/* ---- Watchlist / tables ---- */
QTableWidget {
    background: #0f1115; alternate-background-color: #12141a;
    gridline-color: transparent; border: none; outline: none;
    selection-background-color: #1e2a44;
}
QTableWidget::item { padding: 7px 10px; border: none; border-bottom: 1px solid #16181d; }
QTableWidget::item:hover   { background: #171b22; }
QTableWidget::item:selected { background: #1c2b4a; color: #ffffff; }
QHeaderView::section {
    background: #16181d; color: #6b7280; padding: 7px 8px;
    border: none; border-bottom: 1px solid #24272e;
    font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
}
QTableCornerButton::section { background: #16181d; border: none; }

/* ---- Inputs ---- */
QLineEdit, QDoubleSpinBox, QSpinBox, QComboBox {
    background: #1a1d23; color: #e6e9ee;
    border: 1px solid #2a2e36; border-radius: 6px;
    padding: 6px 9px; selection-background-color: #3b82f6;
}
QLineEdit:focus, QDoubleSpinBox:focus, QSpinBox:focus, QComboBox:focus {
    border: 1px solid #3b82f6; background: #1d2128;
}
QComboBox::drop-down { border: none; width: 22px; }
QComboBox QAbstractItemView {
    background: #1a1d23; color: #e6e9ee; border: 1px solid #2a2e36;
    selection-background-color: #3b82f6; outline: none;
}
QDoubleSpinBox::up-button, QDoubleSpinBox::down-button,
QSpinBox::up-button, QSpinBox::down-button { width: 16px; background: #22262e; border: none; }
QDoubleSpinBox::up-button:hover, QDoubleSpinBox::down-button:hover { background: #2d323c; }

/* ---- Buttons ---- */
QPushButton {
    background: #22262e; color: #d6d9de;
    border: 1px solid #2f343d; border-radius: 6px; padding: 7px 14px; font-weight: 600;
}
QPushButton:hover { background: #2a2f39; border-color: #3a4049; }
QPushButton:pressed { background: #1c2027; }
QPushButton:disabled { color: #565b64; background: #191b20; }

/* ---- Toolbar ---- */
QToolBar { background: #101216; border: none; spacing: 6px; padding: 4px 8px; }
QToolBar QToolButton {
    background: transparent; color: #b7bcc4; border-radius: 6px; padding: 6px 12px; font-weight: 600;
}
QToolBar QToolButton:hover { background: #1e222a; color: #ffffff; }

/* ---- Status bar ---- */
QStatusBar { background: #16181d; color: #7c828c; border-top: 1px solid #24272e; }
QStatusBar::item { border: none; }

/* ---- Scrollbars ---- */
QScrollBar:vertical { background: transparent; width: 10px; margin: 0; }
QScrollBar::handle:vertical { background: #2c313a; border-radius: 5px; min-height: 30px; }
QScrollBar::handle:vertical:hover { background: #3a404b; }
QScrollBar:horizontal { background: transparent; height: 10px; }
QScrollBar::handle:horizontal { background: #2c313a; border-radius: 5px; min-width: 30px; }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }

/* ---- Tooltips / menus ---- */
QToolTip { background: #1a1d23; color: #e6e9ee; border: 1px solid #2f343d; padding: 5px 8px; }
QMenu { background: #16181d; color: #d6d9de; border: 1px solid #2a2e36; }
QMenu::item:selected { background: #1e2a44; }
)QSS";
}

} // namespace Theme
