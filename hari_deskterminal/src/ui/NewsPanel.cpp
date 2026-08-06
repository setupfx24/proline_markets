#include "ui/NewsPanel.h"
#include "ui/Theme.h"
#include <QWebEngineView>
#include <QWebEngineSettings>
#include <QVBoxLayout>
#include <QLabel>
#include <QShowEvent>
#include <QUrl>
#include <QUrlQuery>
#include <QJsonObject>
#include <QJsonDocument>
#include <QHash>

namespace {

// Mirrors TRADINGVIEW_SYMBOL_MAP in
// frontend/trader/src/lib/tradingViewSymbols.ts. Kept in step by hand — there
// is no shared source between a Qt binary and a Next.js bundle — so if a
// symbol is added there, add it here too or the news tab falls back to
// FX:<TICKER> and shows "symbol doesn't exist" for anything that is not a
// currency pair.
const QHash<QString, QString>& symbolMap() {
    static const QHash<QString, QString> m = {
        {"EURUSD", "FX:EURUSD"},   {"GBPUSD", "FX:GBPUSD"},
        {"USDJPY", "FX:USDJPY"},   {"AUDUSD", "FX:AUDUSD"},
        {"USDCAD", "FX:USDCAD"},   {"USDCHF", "FX:USDCHF"},
        {"NZDUSD", "FX:NZDUSD"},   {"EURGBP", "FX:EURGBP"},
        {"EURJPY", "FX:EURJPY"},   {"GBPJPY", "FX:GBPJPY"},
        // OANDA rather than TVC for metals/oil: the TVC symbols are CFD ratios
        // that sit visibly away from the spot feed the order ticket quotes.
        {"XAUUSD", "OANDA:XAUUSD"},{"XAGUSD", "OANDA:XAGUSD"},
        {"USOIL",  "OANDA:WTICOUSD"},
        {"US30",   "TVC:DJI"},     {"US500",  "SP:SPX"},
        {"NAS100", "NASDAQ:NDX"},  {"US100",  "NASDAQ:NDX"},
        {"UK100",  "TVC:UKX"},     {"GER40",  "TVC:DEU40"},
        {"JPN225", "TVC:NI225"},   {"AUS200", "TVC:AS51"},
        {"BTCUSD", "BINANCE:BTCUSDT"}, {"ETHUSD", "BINANCE:ETHUSDT"},
        {"DOGUSD", "BINANCE:DOGEUSDT"},{"DOGEUSD","BINANCE:DOGEUSDT"},
        {"SOLUSD", "BINANCE:SOLUSDT"}, {"LTCUSD", "BINANCE:LTCUSDT"},
        {"XRPUSD", "BINANCE:XRPUSDT"},
    };
    return m;
}

} // namespace

QString NewsPanel::toTradingViewSymbol(const QString& symbol) {
    const QString s = symbol.trimmed().toUpper();
    if (s.isEmpty()) return QStringLiteral("FX:EURUSD");
    const auto it = symbolMap().constFind(s);
    // FX: is the right guess for an unmapped ticker because everything else the
    // broker lists (indices, metals, crypto) IS mapped above; an unknown one is
    // almost certainly a currency pair.
    return it != symbolMap().constEnd() ? it.value() : QStringLiteral("FX:") + s;
}

NewsPanel::NewsPanel(QWidget* parent) : QWidget(parent) {
    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->setSpacing(0);

    m_status = new QLabel(tr("Loading news…"));
    m_status->setAlignment(Qt::AlignCenter);
    lay->addWidget(m_status);

    m_view = new QWebEngineView(this);
    m_view->setVisible(false);
    lay->addWidget(m_view, 1);

    // The widget is a third-party page: give it nothing beyond what it needs to
    // render. No local file access, no clipboard, no window.open.
    auto* s = m_view->settings();
    s->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls, false);
    s->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, false);
    s->setAttribute(QWebEngineSettings::JavascriptCanOpenWindows, false);
    s->setAttribute(QWebEngineSettings::JavascriptCanAccessClipboard, false);

    connect(m_view, &QWebEngineView::loadFinished, this, [this](bool ok) {
        m_view->setVisible(ok);
        m_status->setVisible(!ok);
        if (!ok) {
            m_status->setText(tr("News unavailable — could not reach the news "
                                 "provider. Check the internet connection; the "
                                 "rest of the terminal is unaffected."));
        }
    });

    connect(Theme::notifier(), &Theme::Notifier::changed, this, &NewsPanel::applyTheme);
    applyTheme();
}

void NewsPanel::showEvent(QShowEvent* e) {
    QWidget::showEvent(e);
    // First reveal of the tab is what pays for the renderer process.
    if (!m_loaded) {
        m_loaded = true;
        reload();
    }
}

void NewsPanel::setSymbol(const QString& symbol) {
    const QString s = symbol.trimmed().toUpper();
    if (s.isEmpty() || s == m_symbol) return;
    m_symbol = s;
    // Only re-fetch if the tab has actually been opened; otherwise the next
    // showEvent picks up the current symbol anyway. Switching instruments with
    // News closed must not spawn a page load per click.
    if (m_loaded) reload();
}

void NewsPanel::applyTheme() {
    const auto& c = Theme::p();
    setStyleSheet(QString("background:%1;").arg(c.panel));
    m_status->setStyleSheet(QString("color:%1; font-size:12px; padding:24px;").arg(c.muted));
    if (m_loaded) reload();   // the embed's theme is baked into its URL
}

void NewsPanel::reload() {
    const QString tv = toTradingViewSymbol(m_symbol);

    // Settings ride in the URL FRAGMENT as raw JSON. They must not be
    // percent-encoded: TradingView parses the fragment itself and silently
    // falls back to its defaults if the braces are escaped — which is how the
    // web terminal ended up stuck on the dark embed in light mode.
    QJsonObject settings{
        {"feedMode",    "symbol"},
        {"symbol",      tv},
        {"colorTheme",  Theme::isDark() ? "dark" : "light"},
        {"isTransparent", false},
        {"displayMode", "regular"},
        {"locale",      "en"},
        {"width",       "100%"},
        {"height",      "100%"},
    };

    QUrl u(QStringLiteral("https://www.tradingview-widget.com/embed-widget/timeline/"));
    QUrlQuery q;
    q.addQueryItem(QStringLiteral("locale"), QStringLiteral("en"));
    q.addQueryItem(QStringLiteral("symbol"), tv);
    u.setQuery(q);
    u.setFragment(QString::fromUtf8(QJsonDocument(settings).toJson(QJsonDocument::Compact)),
                  QUrl::DecodedMode);

    m_status->setText(tr("Loading news for %1…").arg(m_symbol));
    m_status->setVisible(true);
    m_view->setVisible(false);
    m_view->setUrl(u);
}
