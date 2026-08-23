#pragma once
#include <QWidget>
#include <QVector>
#include <QStringList>
#include "core/Models.h"

class ApiClient;
class PriceStream;
class WebChartWidget;
class QGridLayout;
class QFrame;
class QLabel;
class QToolButton;

// Holds 1, 2 or 4 charts in a grid, MT5-style.
//
// Each WebChartWidget already builds its own ChartBridge, so the panes are
// genuinely independent: separate symbol, timeframe, drawings and datafeed. The
// watchlist drives only the ACTIVE pane, which is the one with the accent
// border — otherwise picking a symbol would overwrite every chart at once.
//
// Panes are created on demand and then kept, even when the layout shrinks back
// to one. Each is a full QWebEngineView with its own renderer process (~150 MB),
// so four charts cost real memory; they are kept rather than destroyed because
// rebuilding one throws away the symbol, timeframe and any drawings on it.
class ChartArea : public QWidget {
    Q_OBJECT
public:
    ChartArea(ApiClient* api, PriceStream* stream, QWidget* parent = nullptr);

    // 1..4. The menu only offers 1 / 2 / 4, but closing a pane from a 2x2 can
    // land on 3, which relayout() tiles as two on top and one across the
    // bottom. Values outside 1..4 are clamped.
    void setChartCount(int count);
    int  chartCount() const { return m_count; }

    // Closes one pane via the ✕ in its header. The last remaining chart cannot
    // be closed — an empty chart area has nothing to put in its place.
    //
    // The pane is not destroyed: it is moved to the end of m_panes so its
    // symbol, timeframe and drawings survive, and re-opening a larger layout
    // brings it back as it was. Destroying it would also mean tearing down a
    // QWebEngineView and its renderer process, only to pay to rebuild both.
    void closePane(int index);

    WebChartWidget* activeChart() const;

    // The instrument the ACTIVE pane is showing. Not the same thing as the
    // Market Watch selection once a trader clicks between panes — the one-click
    // strip and the order window follow this, or they would quote a different
    // instrument from the chart they are sitting on.
    QString activeSymbol() const;

    // Per-pane symbols, left to right, for the panes currently visible. Saved
    // to Config so a 2x2 comes back as it was left rather than as one chart.
    QStringList visibleSymbols() const;

    // Select a pane programmatically. Exists for restoring a saved layout:
    // showSymbol() only ever targets the ACTIVE pane, so seeding four of them
    // means stepping the selection across each in turn.
    void setActivePane(int index);

    // Fan-outs — every pane needs the symbol table, the open positions and the
    // theme; only the active one follows the watchlist.
    void setSymbols(const QVector<SymbolSpec>& symbols);
    void setPositions(const QVector<OpenPosition>& positions);
    void setTheme(const QString& theme);
    void showSymbol(const QString& symbol);

    // The one-click strip floats over whichever pane is active and moves with it.
    void setOverlayWidget(QWidget* overlay);

    void applyTheme();

signals:
    void activeChartChanged(int index);
    // Fires whenever the pane count changes, including from a ✕ rather than
    // the menu, so the View > Chart layout radio group can follow it.
    void chartCountChanged(int count);
    // The active pane's symbol was changed from inside the chart, so anything
    // tracking "what am I looking at" (the price stream subscription, the
    // saved layout) can follow without the trader having to use Market Watch.
    void symbolPickedInChart(const QString& symbol);

protected:
    // Clicks on a pane's header select it; the header carries a "paneIndex".
    bool eventFilter(QObject* watched, QEvent* event) override;

private:
    struct Pane {
        QFrame*         frame  = nullptr;
        QWidget*        header = nullptr;   // title + ✕, the pane's click target
        QLabel*         title  = nullptr;
        QToolButton*    closeBtn = nullptr;
        WebChartWidget* chart  = nullptr;
        QString         symbol;
    };

    Pane& ensurePane(int index);          // builds it the first time it is shown
    void  relayout();
    void  setActive(int index);
    void  paintPaneStates();
    // Panes shift position when one is closed, so the "Chart N" text and the
    // paneIndex property the event filter reads must be rewritten from the
    // pane's CURRENT slot rather than the one it was built in.
    void  refreshPaneHeaders();
    // Walks up from the focused widget to find which pane it belongs to, so
    // clicking anywhere on a chart activates that pane. The web view swallows
    // mouse events, so focus is the only signal the host reliably sees.
    void  onFocusChanged(QWidget* now);

    ApiClient*   m_api;
    PriceStream* m_stream;
    QGridLayout* m_grid;
    QVector<Pane> m_panes;
    QWidget* m_overlay = nullptr;
    int m_count  = 1;
    int m_active = 0;
    QVector<SymbolSpec> m_symbols;      // replayed into panes built later
    QVector<OpenPosition> m_positions;
};
