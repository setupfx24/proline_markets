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

private:
    static QString resolveIndexHtml();   // locate web/index.html

    ChartBridge*    m_bridge;
    QWebEngineView* m_view;
    QWebChannel*    m_channel;
};
