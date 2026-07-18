#include "ui/ChartView.h"
#include "net/Api.h"

#include <QtCharts/QChart>
#include <QtCharts/QChartView>
#include <QtCharts/QCandlestickSeries>
#include <QtCharts/QCandlestickSet>
#include <QtCharts/QBarCategoryAxis>
#include <QtCharts/QValueAxis>
#include <QComboBox>
#include <QLabel>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QDateTime>
#include <QColor>
#include <QPainter>
#include <algorithm>

ChartView::ChartView(Api *api, QWidget *parent)
    : QWidget(parent)
    , m_api(api)
{
    m_timeframes = {
        { tr("1m"),  QStringLiteral("1"),   60 },
        { tr("5m"),  QStringLiteral("5"),   300 },
        { tr("15m"), QStringLiteral("15"),  900 },
        { tr("1H"),  QStringLiteral("60"),  3600 },
        { tr("4H"),  QStringLiteral("240"), 14400 },
        { tr("1D"),  QStringLiteral("1D"),  86400 },
    };

    m_title = new QLabel(tr("Select a symbol"));
    m_title->setStyleSheet(QStringLiteral("font-weight:600;"));

    m_tfBox = new QComboBox;
    for (const Timeframe &tf : m_timeframes)
        m_tfBox->addItem(tf.label);
    m_tfBox->setCurrentIndex(1); // 5m

    auto *top = new QHBoxLayout;
    top->addWidget(m_title);
    top->addStretch();
    top->addWidget(new QLabel(tr("Timeframe:")));
    top->addWidget(m_tfBox);

    // Chart scaffolding.
    m_chart = new QChart;
    m_chart->legend()->hide();
    m_chart->setMargins(QMargins(2, 2, 2, 2));

    m_series = new QCandlestickSeries;
    m_series->setIncreasingColor(QColor(0x2e, 0xa0, 0x43));
    m_series->setDecreasingColor(QColor(0xe5, 0x48, 0x4d));
    m_chart->addSeries(m_series);

    m_axisX = new QBarCategoryAxis;
    m_axisY = new QValueAxis;
    m_chart->addAxis(m_axisX, Qt::AlignBottom);
    m_chart->addAxis(m_axisY, Qt::AlignLeft);
    m_series->attachAxis(m_axisX);
    m_series->attachAxis(m_axisY);

    auto *chartView = new QChartView(m_chart);
    chartView->setRenderHint(QPainter::Antialiasing);

    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(4, 4, 4, 4);
    root->addLayout(top);
    root->addWidget(chartView, 1);

    connect(m_tfBox, &QComboBox::currentIndexChanged,
            this, &ChartView::onTimeframeChanged);
}

void ChartView::setSymbol(const QString &symbol)
{
    if (symbol.isEmpty() || symbol == m_symbol)
        return;
    m_symbol = symbol;
    m_title->setText(symbol);
    reload();
}

void ChartView::onTimeframeChanged()
{
    reload();
}

void ChartView::reload()
{
    if (m_symbol.isEmpty())
        return;
    const Timeframe &tf = m_timeframes.at(std::clamp(
        m_tfBox->currentIndex(), 0, int(m_timeframes.size()) - 1));

    const qint64 now = QDateTime::currentSecsSinceEpoch();
    const qint64 from = now - tf.seconds * 300; // ~300 candles

    m_api->fetchBars(m_symbol, tf.resolution, from, now,
                     [this](bool ok, const QList<Bar> &bars, const QString &) {
        if (ok)
            rebuildSeries(bars);
    });
}

void ChartView::rebuildSeries(const QList<Bar> &bars)
{
    // QCandlestickSeries has no clear(); recreate it cleanly.
    m_chart->removeSeries(m_series);
    delete m_series;
    m_series = new QCandlestickSeries;
    m_series->setIncreasingColor(QColor(0x2e, 0xa0, 0x43));
    m_series->setDecreasingColor(QColor(0xe5, 0x48, 0x4d));

    QStringList categories;
    double lo = 0.0, hi = 0.0;
    bool first = true;
    for (const Bar &b : bars) {
        auto *set = new QCandlestickSet(b.open, b.high, b.low, b.close,
                                        double(b.time));
        m_series->append(set);
        const QString label = QDateTime::fromSecsSinceEpoch(b.time)
                                  .toString(QStringLiteral("MM-dd HH:mm"));
        categories << label;
        if (first) { lo = b.low; hi = b.high; first = false; }
        else { lo = std::min(lo, b.low); hi = std::max(hi, b.high); }
    }

    m_chart->addSeries(m_series);
    m_series->attachAxis(m_axisX);
    m_series->attachAxis(m_axisY);
    m_axisX->setCategories(categories);
    if (!categories.isEmpty()) {
        // Show only the most recent ~60 candles.
        const int visible = 60;
        const int startIdx = std::max(0, int(categories.size()) - visible);
        m_axisX->setRange(categories.at(startIdx), categories.last());
        m_axisX->setLabelsAngle(-60);
    }
    if (!bars.isEmpty()) {
        const double pad = (hi - lo) * 0.05;
        m_axisY->setRange(lo - pad, hi + pad);
        const Bar &last = bars.last();
        m_lastBarTime = last.time;
        m_lastHigh = last.high;
        m_lastLow = last.low;
    }
}

void ChartView::onTick(const Tick &t)
{
    if (t.symbol != m_symbol || m_series->count() == 0)
        return;
    const double price = t.bid > 0.0 ? t.bid : t.ask;
    if (price <= 0.0)
        return;

    const Timeframe &tf = m_timeframes.at(std::clamp(
        m_tfBox->currentIndex(), 0, int(m_timeframes.size()) - 1));
    const qint64 now = QDateTime::currentSecsSinceEpoch();

    // Roll into a new candle when the bucket advances.
    if (m_lastBarTime > 0 && now >= m_lastBarTime + tf.seconds) {
        const qint64 bucket = now - (now % tf.seconds);
        auto *set = new QCandlestickSet(price, price, price, price, double(bucket));
        m_series->append(set);
        m_lastBarTime = bucket;
        m_lastHigh = m_lastLow = price;
        m_axisX->append(QDateTime::fromSecsSinceEpoch(bucket)
                            .toString(QStringLiteral("MM-dd HH:mm")));
        return;
    }

    // Update the forming candle in place.
    const auto sets = m_series->sets();
    if (sets.isEmpty())
        return;
    QCandlestickSet *last = sets.last();
    last->setClose(price);
    if (price > m_lastHigh) { m_lastHigh = price; last->setHigh(price); }
    if (price < m_lastLow || m_lastLow == 0.0) { m_lastLow = price; last->setLow(price); }

    // Keep Y in view if price runs past the current range.
    if (price > m_axisY->max()) m_axisY->setMax(price * 1.001);
    if (price < m_axisY->min()) m_axisY->setMin(price * 0.999);
}
