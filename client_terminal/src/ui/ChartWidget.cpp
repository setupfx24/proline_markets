#include "ui/ChartWidget.h"
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
#include <QPainter>

ChartWidget::ChartWidget(QWidget* parent) : QWidget(parent) {
    m_title = new QLabel(tr("No symbol"));
    m_title->setStyleSheet("font-weight:bold; font-size:14px; padding:2px 6px;");

    m_tf = new QComboBox;
    m_tf->addItems({"1m", "5m", "15m", "30m", "1h", "4h", "1d"});
    m_tf->setCurrentText("5m");
    connect(m_tf, &QComboBox::currentTextChanged, this, [this](const QString&) {
        requestReload();
    });

    auto* top = new QHBoxLayout;
    top->addWidget(m_title);
    top->addStretch();
    top->addWidget(new QLabel(tr("Timeframe:")));
    top->addWidget(m_tf);

    m_chart = new QChart;
    m_chart->legend()->hide();
    m_chart->setBackgroundBrush(QColor("#1b1d22"));
    m_chart->setTitleBrush(QColor("#e0e0e0"));
    m_chart->setMargins(QMargins(4, 4, 4, 4));

    m_view = new QChartView(m_chart);
    m_view->setRenderHint(QPainter::Antialiasing);

    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->addLayout(top);
    lay->addWidget(m_view, 1);
}

QString ChartWidget::timeframe() const { return m_tf->currentText(); }

void ChartWidget::showSymbol(const QString& symbol) {
    if (symbol.isEmpty()) return;
    m_symbol = symbol;
    m_title->setText(symbol);
    requestReload();
}

void ChartWidget::requestReload() {
    if (!m_symbol.isEmpty())
        emit requestBars(m_symbol, m_tf->currentText());
}

void ChartWidget::setBars(const QString& symbol, const QString& timeframe,
                          const QVector<Bar>& bars) {
    // Ignore stale responses for a symbol/timeframe we no longer show.
    if (symbol != m_symbol || timeframe != m_tf->currentText())
        return;

    m_chart->removeAllSeries();
    for (QAbstractAxis* a : m_chart->axes())
        m_chart->removeAxis(a);

    m_series = new QCandlestickSeries;
    m_series->setName(symbol);
    m_series->setIncreasingColor(QColor("#26a269"));
    m_series->setDecreasingColor(QColor("#e01b24"));
    m_series->setBodyOutlineVisible(false);

    QStringList categories;
    double lo = 1e18, hi = -1e18;

    // API returns newest-first; iterate reversed for chronological order.
    for (int i = bars.size() - 1; i >= 0; --i) {
        const Bar& b = bars[i];
        auto* set = new QCandlestickSet(b.open, b.high, b.low, b.close,
                                        b.time.toMSecsSinceEpoch());
        m_series->append(set);
        categories << b.time.toString("MM-dd hh:mm");
        lo = qMin(lo, b.low);
        hi = qMax(hi, b.high);
    }

    if (m_series->count() == 0) {
        m_title->setText(tr("%1 — no data").arg(symbol));
        return;
    }
    m_lastClose = bars.isEmpty() ? 0.0 : bars.front().close; // newest bar

    m_chart->addSeries(m_series);

    m_axisX = new QBarCategoryAxis;
    m_axisX->setCategories(categories);
    m_axisX->setLabelsColor(QColor("#8a8f98"));
    m_axisX->setGridLineColor(QColor("#2a2d34"));
    // Thin out labels: only show ~8 across the axis.
    m_axisX->setLabelsAngle(-60);

    const double pad = (hi - lo) * 0.08 + 1e-9;
    m_axisY = new QValueAxis;
    m_axisY->setRange(lo - pad, hi + pad);
    m_axisY->setLabelsColor(QColor("#8a8f98"));
    m_axisY->setGridLineColor(QColor("#2a2d34"));

    m_chart->addAxis(m_axisX, Qt::AlignBottom);
    m_chart->addAxis(m_axisY, Qt::AlignRight);
    m_series->attachAxis(m_axisX);
    m_series->attachAxis(m_axisY);

    m_title->setText(tr("%1 · %2   last %3")
                     .arg(symbol, timeframe)
                     .arg(m_lastClose));
}

void ChartWidget::applyTick(const Quote& q) {
    if (q.symbol != m_symbol || !m_series || m_series->count() == 0)
        return;
    // Update the most-recent candle's close (and high/low) with the live mid.
    const double mid = (q.bid + q.ask) / 2.0;
    QCandlestickSet* last = m_series->sets().last();
    last->setClose(mid);
    if (mid > last->high()) last->setHigh(mid);
    if (mid < last->low())  last->setLow(mid);
    m_lastClose = mid;
}
