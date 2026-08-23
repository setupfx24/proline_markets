#pragma once
#include <QWidget>
#include "core/Models.h"

class ApiClient;
class PriceStream;
class ChartBridge;
class QWebEngineView;
class QWebChannel;

// Hosts the TradingView Advanced Charts library inside a QWebEngineView.
// Data flows through a ChartBridge exposed over QWebChannel as `sc`.
class WebChartWidget : public QWidget {
    Q_OBJECT
public:
    WebChartWidget(ApiClient* api, PriceStream* stream, QWidget* parent = nullptr);

    void setSymbols(const QVector<SymbolSpec>& symbols);
    void showSymbol(const QString& symbol);
    void setPositions(const QVector<OpenPosition>& positions);   // feeds broker adapter
    void setTheme(const QString& theme);   // "dark" | "light" -> TradingView + overlay

    // Floats a widget over the top-left of the chart canvas — MT5 parks its
    // one-click trading panel there. The widget is reparented onto this one and
    // kept above the web view; it is NOT put in the layout, so it never steals
    // space from the chart.
    void setOverlayWidget(QWidget* w);

    // Reduced chrome for a pane sharing the window with others — see
    // ChartBridge::compact.
    void setCompact(bool compact);

signals:
    // The trader picked a symbol inside the chart itself. Relayed so the pane
    // header can follow, and so the choice survives a restart.
    void symbolPickedInChart(const QString& symbol);

protected:
    void resizeEvent(QResizeEvent* e) override;

private slots:
    // Also invoked when the overlay reports a new size hint, so it must be a
    // slot rather than a plain private helper.
    void positionOverlay();

private:
    static QString resolveIndexHtml();   // locate web/index.html

    ChartBridge*    m_bridge;
    QWebEngineView* m_view;
    QWebChannel*    m_channel;
    QWidget*        m_overlay = nullptr;
};
