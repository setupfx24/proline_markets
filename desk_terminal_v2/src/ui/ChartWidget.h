#pragma once
#include <QWidget>
#include "core/Models.h"

QT_BEGIN_NAMESPACE
class QComboBox;
class QLabel;
QT_END_NAMESPACE

class QChart;
class QChartView;
class QCandlestickSeries;
class QBarCategoryAxis;
class QValueAxis;

// Candlestick chart with a timeframe selector. Does not fetch data itself —
// it asks (requestBars) and is fed (setBars) by the owner.
class ChartWidget : public QWidget {
    Q_OBJECT
public:
    explicit ChartWidget(QWidget* parent = nullptr);

    void showSymbol(const QString& symbol);   // switches symbol + requests bars
    QString timeframe() const;

public slots:
    // bars arrive newest-first (as the API returns them)
    void setBars(const QString& symbol, const QString& timeframe, const QVector<Bar>& bars);
    void applyTick(const Quote& q);            // live-update last candle's close

signals:
    void requestBars(const QString& symbol, const QString& timeframe);

private:
    void requestReload();

    QString m_symbol;
    QComboBox* m_tf;
    QLabel*    m_title;
    QChart*    m_chart;
    QChartView* m_view;
    QCandlestickSeries* m_series = nullptr;
    QBarCategoryAxis*   m_axisX  = nullptr;
    QValueAxis*         m_axisY  = nullptr;
    double m_lastClose = 0.0;
};
