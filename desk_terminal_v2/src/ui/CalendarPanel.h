#pragma once
#include <QWidget>
#include <QString>

class QWebEngineView;
class QLabel;
class QComboBox;
class QTimer;

// Economic calendar — the macro releases that move the instruments this
// terminal trades (rate decisions, CPI, NFP, GDP), as a tab beside
// Trade / Pending / History / News.
//
// Built the same way NewsPanel is, and for the same reason: the Proline Markets
// gateway serves prices and trading, not macro data, so rather than stand up a
// calendar service both clients could drift apart on, this embeds TradingView's
// public events widget. It is free and needs no API key — the same terms the
// news timeline already runs on.
//
// Two filters, because an unfiltered calendar is noise. A forex trader watches
// the currencies they hold:
//   * Importance — "high impact only" is the everyday setting.
//   * Countries  — either the majors, or just the economies behind the symbol
//     in focus (EURUSD -> eu + us). MT5's calendar filters the same way.
//
// Consequences worth knowing, inherited from the news panel:
//   * It needs to reach tradingview-widget.com. Everything else in the terminal
//     talks only to the Proline Markets API, so this tab can be blank on a network that
//     permits one and not the other. It says so rather than showing white.
//   * The renderer process (~150 MB) is only paid for once the tab is opened.
class CalendarPanel : public QWidget {
    Q_OBJECT
public:
    explicit CalendarPanel(QWidget* parent = nullptr);

public slots:
    // Follows the active chart / Market Watch selection. Only changes anything
    // while the country filter is set to "This symbol".
    void setSymbol(const QString& symbol);
    void applyTheme();

private:
    void reload();

    // Country codes the widget should show, as its comma-separated
    // `countryFilter`. Derived from the symbol when the filter asks for it.
    QString countryFilter() const;
    // Proline Markets ticker -> the economies behind it. "EURUSD" -> "eu,us".
    static QString countriesForSymbol(const QString& symbol);

    QWebEngineView* m_view   = nullptr;
    QLabel*         m_status = nullptr;
    QComboBox*      m_impact  = nullptr;
    QComboBox*      m_scope   = nullptr;
    QString         m_symbol;
    bool            m_loaded = false;
    // Safety net for a load that never reports back. Everything visible in
    // this panel is gated on loadFinished, so one missing signal used to
    // mean the tab said "Loading…" until the terminal was restarted.
    QTimer*         m_watchdog = nullptr;

protected:
    void showEvent(QShowEvent* e) override;
};
