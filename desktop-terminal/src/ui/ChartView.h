#pragma once

#include <QWidget>
#include <QList>

#include "models/Bar.h"
#include "models/Tick.h"

QT_BEGIN_NAMESPACE
class QChart;
class QCandlestickSeries;
class QBarCategoryAxis;
class QValueAxis;
QT_END_NAMESPACE

class Api;
class QComboBox;
class QLabel;

// Candlestick chart for one symbol. Loads history via Api::fetchBars for the
// selected timeframe and updates the last (forming) candle live from ticks,
// rolling into a new candle when the timeframe bucket advances.
class ChartView : public QWidget
{
    Q_OBJECT
public:
    explicit ChartView(Api *api, QWidget *parent = nullptr);

public slots:
    void setSymbol(const QString &symbol);
    void onTick(const Tick &tick);

private slots:
    void onTimeframeChanged();

private:
    struct Timeframe { QString label; QString resolution; qint64 seconds; };

    void reload();
    void rebuildSeries(const QList<Bar> &bars);
    void rescaleY();

    Api *m_api;
    QComboBox *m_tfBox = nullptr;
    QLabel *m_title = nullptr;

    QChart *m_chart = nullptr;
    QCandlestickSeries *m_series = nullptr;
    QBarCategoryAxis *m_axisX = nullptr;
    QValueAxis *m_axisY = nullptr;

    QList<Timeframe> m_timeframes;
    QString m_symbol;
    qint64 m_lastBarTime = 0;   // bucket start of the forming candle (epoch sec)
    double m_lastHigh = 0.0;
    double m_lastLow = 0.0;
};
