#include "ui/CalendarPanel.h"
#include "ui/Theme.h"
#include "ui/EmbedProfile.h"
#include <QWebEngineView>
#include <QWebEnginePage>
#include <QWebEngineSettings>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QComboBox>
#include <QLabel>
#include <QShowEvent>
#include <QUrl>
#include <QUrlQuery>
#include <QJsonObject>
#include <QJsonDocument>
#include <QHash>
#include <QSet>
#include <QStringList>
#include <QSizePolicy>
#include <QTimer>

namespace {

// TradingView's country codes for the calendar's `countryFilter`. The default
// view — every economy whose releases actually move a major pair, an index or
// gold. Deliberately not the widget's own full list: it reaches to ~40
// countries and buries an ECB decision under Colombian retail sales.
const char* kMajorCountries = "us,eu,gb,jp,au,ca,ch,nz,cn,de,fr";

// Currency -> the economy that publishes for it. Only the currencies this
// broker actually quotes; anything else falls through to the majors.
const QHash<QString, QString>& currencyCountry() {
    static const QHash<QString, QString> m = {
        {"USD", "us"}, {"EUR", "eu"}, {"GBP", "gb"}, {"JPY", "jp"},
        {"AUD", "au"}, {"CAD", "ca"}, {"CHF", "ch"}, {"NZD", "nz"},
        {"CNY", "cn"}, {"CNH", "cn"},
    };
    return m;
}

// Instruments that are not a six-letter currency pair. Metals and crypto are
// priced in dollars and take their cue from US data; an index takes its own
// economy's.
const QHash<QString, QString>& instrumentCountry() {
    static const QHash<QString, QString> m = {
        {"XAUUSD", "us"}, {"XAGUSD", "us"}, {"USOIL", "us"},
        {"US30", "us"},   {"US500", "us"},  {"NAS100", "us"}, {"US100", "us"},
        {"UK100", "gb"},  {"GER40", "de,eu"},
        {"JPN225", "jp"}, {"AUS200", "au"},
        // Crypto has no macro calendar of its own, but it trades the Fed like
        // everything else priced in dollars.
        {"BTCUSD", "us"}, {"ETHUSD", "us"}, {"SOLUSD", "us"},
        {"XRPUSD", "us"}, {"LTCUSD", "us"}, {"DOGUSD", "us"}, {"DOGEUSD", "us"},
    };
    return m;
}

} // namespace

QString CalendarPanel::countriesForSymbol(const QString& symbol) {
    const QString s = symbol.trimmed().toUpper();
    if (s.isEmpty()) return QString::fromLatin1(kMajorCountries);

    const auto inst = instrumentCountry().constFind(s);
    if (inst != instrumentCountry().constEnd()) return inst.value();

    // A six-letter ticker is a currency pair: take both halves. Kept as an
    // ordered de-duplicated list so EURUSD reads "eu,us" and USDUSD-style
    // nonsense cannot emit the same code twice.
    if (s.length() == 6) {
        QStringList out;
        for (const QString& ccy : {s.left(3), s.mid(3, 3)}) {
            const auto it = currencyCountry().constFind(ccy);
            if (it != currencyCountry().constEnd() && !out.contains(it.value()))
                out << it.value();
        }
        if (!out.isEmpty()) return out.join(',');
    }

    return QString::fromLatin1(kMajorCountries);
}

QString CalendarPanel::countryFilter() const {
    // scope 0 = majors, 1 = follow the symbol.
    if (m_scope && m_scope->currentData().toInt() == 1)
        return countriesForSymbol(m_symbol);
    return QString::fromLatin1(kMajorCountries);
}

CalendarPanel::CalendarPanel(QWidget* parent) : QWidget(parent) {
    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->setSpacing(0);

    // ── filter bar ──
    auto* bar = new QWidget(this);
    auto* barLay = new QHBoxLayout(bar);
    barLay->setContentsMargins(8, 6, 8, 6);
    barLay->setSpacing(8);

    barLay->addWidget(new QLabel(tr("Impact:"), bar));
    m_impact = new QComboBox(bar);
    // TradingView grades importance -1 low / 0 medium / 1 high, and the filter
    // takes the set to SHOW. "High only" is the setting that earns its keep.
    m_impact->addItem(tr("All"),            QStringLiteral("-1,0,1"));
    m_impact->addItem(tr("Medium & high"),  QStringLiteral("0,1"));
    m_impact->addItem(tr("High impact"),    QStringLiteral("1"));
    m_impact->setCurrentIndex(1);
    barLay->addWidget(m_impact);

    barLay->addSpacing(6);
    barLay->addWidget(new QLabel(tr("Countries:"), bar));
    m_scope = new QComboBox(bar);
    m_scope->addItem(tr("Majors"), 0);
    m_scope->addItem(tr("This symbol"), 1);
    barLay->addWidget(m_scope);
    barLay->addStretch(1);

    // The bar is pinned to the TOP. Both of these are needed and neither is
    // decoration: a QVBoxLayout whose items all have stretch 0 splits the
    // leftover height equally between them, so while the web view was hidden
    // the filter row drifted into the middle of an empty panel. Fixing the
    // bar's height stops it absorbing any of that space, and giving the status
    // label the stretch below hands the remainder to something that is
    // supposed to be centred.
    bar->setSizePolicy(QSizePolicy::Preferred, QSizePolicy::Fixed);
    lay->addWidget(bar, 0);

    m_status = new QLabel(tr("Loading calendar…"));
    m_status->setAlignment(Qt::AlignCenter);
    lay->addWidget(m_status, 1);

    m_view = new QWebEngineView(this);
    // Built on the shared, disk-cached embed profile rather than the default
    // one, which is off-the-record and therefore re-downloads the widget's
    // whole JS bundle on every launch. See EmbedProfile.h.
    m_view->setPage(new QWebEnginePage(embedProfile(), m_view));

    m_view->setVisible(false);
    lay->addWidget(m_view, 1);

    // Third-party page: give it nothing beyond what it needs to render.
    auto* s = m_view->settings();
    s->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls, false);
    s->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, false);
    s->setAttribute(QWebEngineSettings::JavascriptCanOpenWindows, false);
    s->setAttribute(QWebEngineSettings::JavascriptCanAccessClipboard, false);

    // 25 s is generous: a cold load measured ~8 s on a fresh cache and ~1 s
    // once warm. This only ever fires when something has gone wrong enough that
    // loadFinished is not coming, and its job is to replace a lie ("Loading…")
    // with something the trader can act on.
    m_watchdog = new QTimer(this);
    m_watchdog->setSingleShot(true);
    m_watchdog->setInterval(25000);
    connect(m_watchdog, &QTimer::timeout, this, [this]() {
        if (m_view->isVisible()) return;
        m_status->setText(tr("The calendar is taking longer than usual to load. "
                             "Change a filter above to try again."));
    });

    connect(m_view, &QWebEngineView::loadFinished, this, [this](bool ok) {
        m_watchdog->stop();
        m_view->setVisible(ok);
        m_status->setVisible(!ok);
        if (!ok) {
            m_status->setText(tr("Calendar unavailable — could not reach the "
                                 "data provider. Check the internet connection; "
                                 "the rest of the terminal is unaffected."));
        }
    });

    // Only reload once the tab has actually been opened — changing a filter
    // while Calendar is closed must not spawn a page load.
    const auto refilter = [this]() { if (m_loaded) reload(); };
    connect(m_impact, &QComboBox::currentIndexChanged, this, refilter);
    connect(m_scope,  &QComboBox::currentIndexChanged, this, refilter);

    connect(Theme::notifier(), &Theme::Notifier::changed, this, &CalendarPanel::applyTheme);
    applyTheme();
}

void CalendarPanel::showEvent(QShowEvent* e) {
    QWidget::showEvent(e);
    // First reveal of the tab is what pays for the renderer process.
    if (!m_loaded) {
        m_loaded = true;
        reload();
    }
}

void CalendarPanel::setSymbol(const QString& symbol) {
    const QString s = symbol.trimmed().toUpper();
    if (s.isEmpty() || s == m_symbol) return;
    m_symbol = s;
    // A symbol change only alters what is on screen while the country filter is
    // following it. On "Majors" the calendar is the same either way, and
    // reloading would throw away the trader's scroll position for nothing.
    if (m_loaded && m_scope && m_scope->currentData().toInt() == 1) reload();
}

void CalendarPanel::applyTheme() {
    const auto& c = Theme::p();
    setStyleSheet(QString("background:%1;").arg(c.panel));
    m_status->setStyleSheet(QString("color:%1; font-size:12px; padding:24px;").arg(c.muted));
    if (m_loaded) reload();   // the embed's theme is baked into its URL
}

void CalendarPanel::reload() {
    // Settings ride in the URL FRAGMENT as raw JSON and must NOT be
    // percent-encoded — TradingView parses the fragment itself and silently
    // falls back to its defaults if the braces are escaped. That is how the web
    // terminal once ended up stuck on the dark embed in light mode.
    // width/height MUST be NUMBERS, never the string "100%" that the news
    // timeline gets away with. TradingView's events bootstrap runs
    // decodeURIComponent() over this fragment, and "100%" leaves a literal `%`
    // followed by `"` — not valid percent-encoding — so it throws URIError and
    // the widget never boots. The page still answers 200 and renders nothing,
    // which looks exactly like a network problem and is not one.
    //
    // The iframe is sized by its parent widget anyway; these are placeholders
    // that tell the widget it may draw full-bleed. Same values, and the same
    // reason, as frontend/trader/src/components/charts/TradingViewEventsCalendar.tsx.
    QJsonObject settings{
        {"colorTheme",       Theme::isDark() ? "dark" : "light"},
        {"isTransparent",    false},
        {"autosize",         true},
        {"width",            1400},
        {"height",           900},
        {"locale",           "en"},
        {"importanceFilter", m_impact ? m_impact->currentData().toString()
                                      : QStringLiteral("0,1")},
        {"countryFilter",    countryFilter()},
    };

    QUrl u(QStringLiteral("https://www.tradingview-widget.com/embed-widget/events/"));
    QUrlQuery q;
    q.addQueryItem(QStringLiteral("locale"), QStringLiteral("en"));
    // The settings are repeated into the QUERY, and that is load-bearing — not
    // belt-and-braces.
    //
    // TradingView reads its config from the fragment, and the fragment alone is
    // what changed when a filter moved. A URL that differs only after the '#'
    // is a SAME-DOCUMENT navigation: the browser fires hashchange and nothing
    // else. QWebEngineView therefore never emits loadFinished, so the panel sat
    // on "Loading economic calendar…" for ever with the view still hidden — and
    // the widget would not have re-read the new filter anyway, because it only
    // parses the fragment at boot.
    //
    // Putting the same values in the query makes each filter combination a
    // genuinely different document, which forces a real navigation. The names
    // are ours and TradingView ignores them. The web terminal solves the
    // identical problem by keying the iframe on its src
    // (TradingViewEventsCalendar.tsx) — same fix, same reason.
    //
    // This costs nothing worth having: only the small HTML document misses the
    // cache, while the JS bundle behind it keeps its own stable URLs.
    q.addQueryItem(QStringLiteral("tx_impact"),
                   settings.value("importanceFilter").toString());
    q.addQueryItem(QStringLiteral("tx_countries"),
                   settings.value("countryFilter").toString());
    q.addQueryItem(QStringLiteral("tx_theme"),
                   settings.value("colorTheme").toString());
    u.setQuery(q);
    u.setFragment(QString::fromUtf8(QJsonDocument(settings).toJson(QJsonDocument::Compact)),
                  QUrl::DecodedMode);

    m_status->setText(tr("Loading economic calendar…"));
    m_status->setVisible(true);
    m_view->setVisible(false);
    m_watchdog->start();
    m_view->setUrl(u);
}
