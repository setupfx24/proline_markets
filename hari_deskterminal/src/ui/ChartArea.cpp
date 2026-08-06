#include "ui/ChartArea.h"
#include "ui/WebChartWidget.h"
#include "ui/Theme.h"
#include <QGridLayout>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFrame>
#include <QLabel>
#include <QToolButton>
#include <QApplication>
#include <QMouseEvent>

ChartArea::ChartArea(ApiClient* api, PriceStream* stream, QWidget* parent)
    : QWidget(parent), m_api(api), m_stream(stream) {
    m_grid = new QGridLayout(this);
    m_grid->setContentsMargins(0, 0, 0, 0);
    m_grid->setSpacing(2);

    m_panes.resize(4);
    ensurePane(0);
    relayout();

    connect(qApp, &QApplication::focusChanged, this,
            [this](QWidget*, QWidget* now) { onFocusChanged(now); });
    connect(Theme::notifier(), &Theme::Notifier::changed, this, &ChartArea::applyTheme);
}

ChartArea::Pane& ChartArea::ensurePane(int index) {
    Pane& p = m_panes[index];
    if (p.chart) return p;

    p.frame = new QFrame(this);
    // Named so paintPaneStates() can target THIS frame and nothing else. A bare
    // `QFrame{...}` selector also matches every QFrame-derived descendant — and
    // QLabel derives from QFrame — so the active pane's accent border was being
    // painted around every label inside it, including the one-click strip's
    // price tiles and spread readout. That looked like a blue box drawn on the
    // BUY/SELL buttons. See the selector in paintPaneStates().
    p.frame->setObjectName(QStringLiteral("chartPane"));
    auto* v = new QVBoxLayout(p.frame);
    v->setContentsMargins(1, 1, 1, 1);
    v->setSpacing(0);

    // A one-line header per pane: it names the chart, marks which one the
    // watchlist will drive, carries the ✕, and gives a click target that is not
    // the web view (which never forwards clicks to the host).
    p.header = new QWidget(p.frame);
    p.header->setFixedHeight(18);
    auto* h = new QHBoxLayout(p.header);
    h->setContentsMargins(6, 0, 2, 0);
    h->setSpacing(4);

    p.title = new QLabel(tr("Chart %1").arg(index + 1), p.header);

    p.closeBtn = new QToolButton(p.header);
    p.closeBtn->setText(QStringLiteral("✕"));      // ✕
    p.closeBtn->setFixedSize(14, 14);
    p.closeBtn->setCursor(Qt::ArrowCursor);
    p.closeBtn->setToolTip(tr("Close this chart"));
    p.closeBtn->setFocusPolicy(Qt::NoFocus);            // must not steal pane focus
    p.closeBtn->setAutoRaise(true);

    h->addWidget(p.title);
    h->addStretch(1);
    h->addWidget(p.closeBtn);

    // The whole header selects the pane; the ✕ closes it. Both read their slot
    // from the paneIndex property, which refreshPaneHeaders() keeps current —
    // `index` is only correct until the first close shifts things.
    p.header->installEventFilter(this);
    p.title->installEventFilter(this);
    p.header->setProperty("paneIndex", index);
    p.title->setProperty("paneIndex", index);
    p.closeBtn->setProperty("paneIndex", index);
    connect(p.closeBtn, &QToolButton::clicked, this, [this, btn = p.closeBtn]() {
        closePane(btn->property("paneIndex").toInt());
    });

    p.chart = new WebChartWidget(m_api, m_stream, p.frame);
    p.chart->setMinimumSize(220, 160);

    v->addWidget(p.header);
    v->addWidget(p.chart, 1);

    // Panes built after startup have missed every fan-out so far; replay them.
    if (!m_symbols.isEmpty())   p.chart->setSymbols(m_symbols);
    if (!m_positions.isEmpty()) p.chart->setPositions(m_positions);
    p.chart->setTheme(Theme::name());
    // A new pane opens on whatever the active one is showing, which is almost
    // always what a trader comparing timeframes wants as a starting point.
    const QString seed = m_panes[m_active].symbol;
    if (!seed.isEmpty()) {
        p.symbol = seed;
        p.chart->showSymbol(seed);
        // Title text is not set here — refreshPaneHeaders() owns it, and it is
        // the only place that knows the pane's current slot after a close.
    }
    return p;
}

bool ChartArea::eventFilter(QObject* o, QEvent* e) {
    if (e->type() == QEvent::MouseButtonPress) {
        const QVariant idx = o->property("paneIndex");
        if (idx.isValid()) setActive(idx.toInt());
    }
    return QWidget::eventFilter(o, e);
}

void ChartArea::setChartCount(int count) {
    const int n = qBound(1, count, 4);
    if (n == m_count) return;
    m_count = n;
    for (int i = 0; i < n; ++i) ensurePane(i);
    if (m_active >= n) setActive(0);
    relayout();
    emit chartCountChanged(m_count);
}

void ChartArea::closePane(int index) {
    // Refuse to close the last one: the chart area would be blank with no
    // affordance to get a chart back except the menu.
    if (m_count <= 1) return;
    if (index < 0 || index >= m_count) return;

    // Move rather than delete, so the pane keeps its symbol/timeframe/drawings
    // and its QWebEngineView is not torn down and rebuilt. Parking it past
    // m_count is enough to hide it — relayout() only shows the first m_count.
    const Pane closed = m_panes[index];
    m_panes.remove(index);
    m_panes.append(closed);
    --m_count;

    // Keep the selection pointing at the same PANE where possible. Closing the
    // active one falls to whatever slid into its slot (or the new last pane if
    // it was the tail); closing one before it means everything after shifted
    // down by one.
    if (m_active == index)     m_active = qMin(index, m_count - 1);
    else if (m_active > index) --m_active;
    m_active = qBound(0, m_active, m_count - 1);

    relayout();
    emit activeChartChanged(m_active);
    emit chartCountChanged(m_count);
}

void ChartArea::relayout() {
    // Detach everything first: QGridLayout keeps an item at its old cell
    // otherwise, and 4 -> 2 would leave the bottom row occupying dead space.
    for (Pane& p : m_panes) {
        if (!p.frame) continue;
        m_grid->removeWidget(p.frame);
        p.frame->hide();
    }
    for (int i = 0; i < m_count; ++i) {
        Pane& p = m_panes[i];
        // 1 -> one cell across both columns
        // 2 -> side by side
        // 3 -> two on top, the third spanning the bottom row
        // 4 -> 2x2
        // The 3 case only arises by closing a pane out of a 2x2; spanning the
        // odd one out beats leaving a dead quarter of the area empty.
        int row = 0, col = 0, colSpan = 1;
        if (m_count == 1) {
            colSpan = 2;
        } else if (m_count == 2) {
            col = i;
        } else if (m_count == 3) {
            if (i < 2) { col = i; }
            else       { row = 1; colSpan = 2; }
        } else {
            row = i / 2;
            col = i % 2;
        }
        m_grid->addWidget(p.frame, row, col, 1, colSpan);
        p.frame->show();
    }
    const bool twoRows = (m_count >= 3);
    for (int r = 0; r < 2; ++r)
        m_grid->setRowStretch(r, (twoRows || r == 0) ? 1 : 0);
    for (int c = 0; c < 2; ++c)
        m_grid->setColumnStretch(c, 1);

    // The header row is noise when there is only one chart — and with a single
    // pane the ✕ would be a dead control anyway, since closePane() refuses it.
    for (Pane& p : m_panes)
        if (p.header) p.header->setVisible(m_count > 1);

    // Split view: strip the chart's drawing toolbar and bottom date-range bar.
    // At full size they are worth their room; in a half or quarter pane they
    // eat most of it. setCompact() is a no-op when the value is unchanged, so
    // this does not rebuild charts on every relayout — only when the grid
    // actually crosses between one pane and several.
    for (Pane& p : m_panes)
        if (p.chart) p.chart->setCompact(m_count > 1);

    refreshPaneHeaders();
    paintPaneStates();
    if (m_overlay) setOverlayWidget(m_overlay);   // re-home it on the active pane
}

void ChartArea::refreshPaneHeaders() {
    for (int i = 0; i < m_panes.size(); ++i) {
        Pane& p = m_panes[i];
        if (!p.title) continue;
        p.title->setText(p.symbol.isEmpty()
                             ? tr("Chart %1").arg(i + 1)
                             : tr("Chart %1 — %2").arg(i + 1).arg(p.symbol));
        // Re-stamp the slot on every header part. Stale values here are how a
        // ✕ ends up closing the wrong chart after an earlier close shifted the
        // panes along.
        if (p.header)   p.header->setProperty("paneIndex", i);
        p.title->setProperty("paneIndex", i);
        if (p.closeBtn) p.closeBtn->setProperty("paneIndex", i);
    }
}

void ChartArea::setActive(int index) {
    if (index < 0 || index >= m_count || index == m_active) return;
    m_active = index;
    paintPaneStates();
    if (m_overlay) setOverlayWidget(m_overlay);
    emit activeChartChanged(index);
}

void ChartArea::onFocusChanged(QWidget* now) {
    for (QWidget* w = now; w; w = w->parentWidget()) {
        for (int i = 0; i < m_count; ++i) {
            if (m_panes[i].frame && w == m_panes[i].frame) { setActive(i); return; }
        }
    }
}

void ChartArea::paintPaneStates() {
    const auto& c = Theme::p();
    for (int i = 0; i < m_panes.size(); ++i) {
        Pane& p = m_panes[i];
        if (!p.frame) continue;
        const bool active = (i == m_active) && m_count > 1;
        // #chartPane, not a bare QFrame: the type selector matches subclasses,
        // and QLabel is one, so this border used to be drawn around every label
        // parented into the pane — the one-click strip's price tiles ended up
        // with a blue rectangle inside each button.
        p.frame->setStyleSheet(QString("QFrame#chartPane{background:%1; border:1px solid %2;}")
                               .arg(c.bg, active ? c.accent : c.border));
        if (p.header)
            p.header->setStyleSheet(QString("background:%1; border:none;")
                                    .arg(active ? c.cardSelBg : c.panelAlt));
        if (p.title)
            p.title->setStyleSheet(QString(
                "background:transparent; border:none; color:%1; font-size:10px; font-weight:700;")
                .arg(active ? c.textStrong : c.muted));
        if (p.closeBtn)
            // Muted until hovered, then `down` (the sell/red semantic) so the
            // destructive action reads as destructive without shouting for
            // attention in four headers at once.
            p.closeBtn->setStyleSheet(QString(
                "QToolButton{background:transparent; border:none; color:%1;"
                " font-size:10px; font-weight:700; padding:0;}"
                "QToolButton:hover{color:%2;}")
                .arg(c.muted, c.down));
    }
}

void ChartArea::applyTheme() { paintPaneStates(); }

WebChartWidget* ChartArea::activeChart() const {
    return m_panes[m_active].chart;
}

void ChartArea::setActivePane(int index) { setActive(index); }

QString ChartArea::activeSymbol() const {
    return m_panes[m_active].symbol;
}

QStringList ChartArea::visibleSymbols() const {
    QStringList out;
    for (int i = 0; i < m_count && i < m_panes.size(); ++i)
        out << m_panes[i].symbol;
    return out;
}

void ChartArea::setSymbols(const QVector<SymbolSpec>& symbols) {
    m_symbols = symbols;
    for (Pane& p : m_panes) if (p.chart) p.chart->setSymbols(symbols);
}

void ChartArea::setPositions(const QVector<OpenPosition>& positions) {
    m_positions = positions;
    // Every pane draws the position overlay, not just the active one: a
    // position on the symbol a background pane shows still has to be visible
    // and draggable there.
    for (Pane& p : m_panes) if (p.chart) p.chart->setPositions(positions);
}

void ChartArea::setTheme(const QString& theme) {
    for (Pane& p : m_panes) if (p.chart) p.chart->setTheme(theme);
}

void ChartArea::showSymbol(const QString& symbol) {
    Pane& p = m_panes[m_active];
    if (!p.chart) return;
    p.symbol = symbol;
    p.chart->showSymbol(symbol);
    refreshPaneHeaders();
}

void ChartArea::setOverlayWidget(QWidget* overlay) {
    m_overlay = overlay;
    if (!overlay) return;
    // setOverlayWidget() reparents, so handing it to the new pane is enough to
    // take it off the old one.
    if (WebChartWidget* c = activeChart()) c->setOverlayWidget(overlay);
}
