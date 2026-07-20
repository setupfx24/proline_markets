#include "ui/WebChartWidget.h"
#include "core/ChartBridge.h"
#include <QWebEngineView>
#include <QWebEnginePage>
#include <QWebEngineSettings>
#include <QWebEngineProfile>
#include <QWebChannel>
#include <QVBoxLayout>
#include <QCoreApplication>
#include <QFileInfo>
#include <QFile>
#include <QDir>
#include <QDateTime>
#include <QUrl>

#ifndef SC_SOURCE_WEB_DIR
#define SC_SOURCE_WEB_DIR ""
#endif

// Logs JS console output + page errors so chart issues are diagnosable without
// opening devtools. Writes to <exe-dir>/chart-diag.log.
class DiagPage : public QWebEnginePage {
public:
    using QWebEnginePage::QWebEnginePage;
protected:
    void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level, const QString& msg,
                                  int line, const QString& source) override {
        const char* lv = level == InfoMessageLevel ? "INFO"
                       : level == WarningMessageLevel ? "WARN" : "ERROR";
        QFile f(QCoreApplication::applicationDirPath() + "/chart-diag.log");
        if (f.open(QIODevice::Append | QIODevice::Text)) {
            QString src = source.section('/', -1);
            f.write(QString("%1 [%2] %3:%4  %5\n")
                    .arg(QDateTime::currentDateTime().toString("hh:mm:ss"), lv, src)
                    .arg(line).arg(msg).toUtf8());
        }
    }
};

WebChartWidget::WebChartWidget(ApiClient* api, PriceStream* stream, QWidget* parent)
    : QWidget(parent) {
    m_bridge  = new ChartBridge(api, stream, this);
    m_view    = new QWebEngineView(this);

    // Off-the-record profile → no persistent cache, so JS/HTML updates ALWAYS
    // load fresh (a stale cached datafeed was showing the old exchange label).
    auto* profile = new QWebEngineProfile(this);   // unnamed = off-the-record
    profile->setHttpCacheType(QWebEngineProfile::NoCache);
    m_view->setPage(new DiagPage(profile, m_view));

    m_channel = new QWebChannel(this);
    m_channel->registerObject(QStringLiteral("sc"), m_bridge);
    m_view->page()->setWebChannel(m_channel);

    // Truncate the diagnostic log at startup, then record load status.
    const QString diag = QCoreApplication::applicationDirPath() + "/chart-diag.log";
    QFile::remove(diag);
    connect(m_view, &QWebEngineView::loadFinished, this, [diag](bool ok) {
        QFile f(diag);
        if (f.open(QIODevice::Append | QIODevice::Text))
            f.write(QString("%1 [LOAD] finished ok=%2\n")
                    .arg(QDateTime::currentDateTime().toString("hh:mm:ss"))
                    .arg(ok ? "true" : "false").toUtf8());
    });

    // Allow the local index.html to load its sibling JS/vendor assets.
    auto* s = m_view->settings();
    s->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls, true);
    s->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, true);
    s->setAttribute(QWebEngineSettings::JavascriptEnabled, true);
    m_view->page()->setBackgroundColor(QColor("#0e0f13"));

    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->addWidget(m_view);

    const QString index = resolveIndexHtml();
    if (!index.isEmpty())
        m_view->setUrl(QUrl::fromLocalFile(index));
}

QString WebChartWidget::resolveIndexHtml() {
    // 1) next to the executable (deployed layout: <exe>/web/index.html)
    const QString beside = QCoreApplication::applicationDirPath() + "/web/index.html";
    if (QFileInfo::exists(beside)) return beside;
    // 2) source tree (dev)
    const QString src = QStringLiteral(SC_SOURCE_WEB_DIR) + "/index.html";
    if (QFileInfo::exists(src)) return src;
    return {};
}

void WebChartWidget::setSymbols(const QVector<SymbolSpec>& symbols) {
    m_bridge->setSymbols(symbols);
}

void WebChartWidget::showSymbol(const QString& symbol) {
    m_bridge->setCurrentSymbol(symbol);
}

void WebChartWidget::setPositions(const QVector<OpenPosition>& positions) {
    m_bridge->setPositions(positions);
}
