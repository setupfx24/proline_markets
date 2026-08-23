#include "ui/WebChartWidget.h"
#include "core/ChartBridge.h"
#include "ui/OrderTicket.h"
#include "ui/Theme.h"
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
#include <QStandardPaths>
#include <QDateTime>
#include <QResizeEvent>
#include <QUrl>

#ifndef PM_SOURCE_WEB_DIR
#define PM_SOURCE_WEB_DIR ""
#endif

// Where the JS diagnostic log goes.
//
// On Windows the terminal is installed per-user and the exe directory is
// writable, so the log sits next to terminal.exe — easy to find and to attach
// to a bug report.
//
// A mac app bundle in /Applications is NOT writable without admin rights, and
// Contents/MacOS is inside the code signature: writing there would either fail
// silently (leaving no diagnostics at all) or break the signature. So the log
// moves to Application Support, which is per-user and writable.
static QString diagLogPath() {
#ifdef Q_OS_MACOS
    const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    if (!dir.isEmpty()) {
        QDir().mkpath(dir);
        return dir + "/chart-diag.log";
    }
#endif
    return QCoreApplication::applicationDirPath() + "/chart-diag.log";
}

// Logs JS console output + page errors so chart issues are diagnosable without
// opening devtools. See diagLogPath() for where it lands.
class DiagPage : public QWebEnginePage {
public:
    using QWebEnginePage::QWebEnginePage;
protected:
    void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level, const QString& msg,
                                  int line, const QString& source) override {
        const char* lv = level == InfoMessageLevel ? "INFO"
                       : level == WarningMessageLevel ? "WARN" : "ERROR";
        QFile f(diagLogPath());
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

    // The page reports when a TradingView dialog opens. A native child widget
    // always paints above the web view, so the only way to stop the one-click
    // strip covering those dialogs is to take it off screen while they are up.
    connect(m_bridge, &ChartBridge::symbolPickedInChart,
            this, &WebChartWidget::symbolPickedInChart);
    connect(m_bridge, &ChartBridge::overlayHiddenChanged, this, [this](bool hidden) {
        if (m_overlay) m_overlay->setVisible(!hidden);
    });

    // Truncate the diagnostic log at startup, then record load status.
    const QString diag = diagLogPath();
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

    // Boot the page in the active theme — app.js reads `sc.theme` on startup.
    m_bridge->setTheme(Theme::name());
    m_view->page()->setBackgroundColor(QColor(Theme::isDark() ? "#0e0f13" : "#ffffff"));

    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->addWidget(m_view);

    const QString index = resolveIndexHtml();
    if (!index.isEmpty())
        m_view->setUrl(QUrl::fromLocalFile(index));
}

QString WebChartWidget::resolveIndexHtml() {
    const QString appDir = QCoreApplication::applicationDirPath();
#ifdef Q_OS_MACOS
    // 0) inside the app bundle. applicationDirPath() is Contents/MacOS, and
    //    CMake's POST_BUILD step puts the web layer in Contents/Resources/web —
    //    the only location Apple treats as bundle data rather than as code.
    const QString bundled =
        QDir::cleanPath(appDir + "/../Resources/web/index.html");
    if (QFileInfo::exists(bundled)) return bundled;
#endif
    // 1) next to the executable (deployed Windows layout: <exe>/web/index.html)
    const QString beside = appDir + "/web/index.html";
    if (QFileInfo::exists(beside)) return beside;
    // 2) source tree (dev)
    const QString src = QStringLiteral(PM_SOURCE_WEB_DIR) + "/index.html";
    if (QFileInfo::exists(src)) return src;
    return {};
}

void WebChartWidget::setOverlayWidget(QWidget* w) {
    if (!w) return;
    m_overlay = w;
    // The strip re-sizes itself when a longer price arrives (BTCUSD's six
    // figures against EURUSD's five decimals). Nothing else would notice — it
    // is placed by hand, not by a layout — so it says so and we re-place it.
    // Unique connection: setOverlayWidget runs again on every pane switch.
    if (auto* t = qobject_cast<OrderTicket*>(w))
        connect(t, &OrderTicket::sizeHintChanged, this,
                &WebChartWidget::positionOverlay, Qt::UniqueConnection);
    // Deliberately NOT added to the layout: it has to sit on top of the web
    // view, not beside it. raise() puts it above the view in the stacking order.
    w->setParent(this);
    w->raise();
    w->show();
    positionOverlay();
}

void WebChartWidget::positionOverlay() {
    if (!m_overlay) return;
    // A reparented widget keeps whatever geometry it had (a parentless widget
    // defaults to 640x480), and with no layout governing it nothing ever
    // corrects that — the strip stretched its BUY/SELL tiles right across the
    // chart. Size it to its own sizeHint on every reposition instead.
    m_overlay->adjustSize();
    // Parked in the chart's top toolbar band, in the empty run between the
    // Indicators/undo controls and the icon cluster on the right. The inset has
    // to clear BOTH that cluster and the price axis beyond it, which together
    // occupy a little over 200px. Clamped so a narrow chart pushes the strip
    // back toward the left toolbar rather than under the icons or off screen.
    const int rightInset = 145;
    const int x = qMax(56, width() - m_overlay->width() - rightInset);
    // Flush with the top of the chart area — no inset, so the strip sits level
    // with the toolbar row rather than hanging below it.
    m_overlay->move(x, 0);
    m_overlay->raise();
}

void WebChartWidget::resizeEvent(QResizeEvent* e) {
    QWidget::resizeEvent(e);
    positionOverlay();
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

void WebChartWidget::setCompact(bool compact) {
    m_bridge->setCompact(compact);
}

void WebChartWidget::setTheme(const QString& theme) {
    m_bridge->setTheme(theme);
    // The page paints its own background before the widget boots; keep the
    // WebEngine backdrop in step so there's no white/black flash on switch.
    m_view->page()->setBackgroundColor(QColor(theme == "light" ? "#ffffff" : "#0e0f13"));
}
