#include "ui/WatchlistWidget.h"
#include "ui/Theme.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QPushButton>
#include <QTableWidget>
#include <QHeaderView>
#include <QMenu>
#include <QMap>
#include <QPoint>
#include <QTimer>
#include <QTime>
#include <QFont>
#include <QColor>
#include <cmath>

// MT5 marks direction with a small arrow beside the symbol.
static const char* ARROW_UP   = "\xE2\x96\xB2";   // ▲
static const char* ARROW_DOWN = "\xE2\x96\xBC";   // ▼
static const char* ARROW_FLAT = "\xE2\x97\x8B";   // ○
static const char* STAR_ON    = "\xE2\x98\x85";   // star

// Not a segment name: no admin-defined segment can begin with '*', so this can
// never collide with a real group in the filter menu.
const QString WatchlistWidget::kFavGroup = QStringLiteral("*fav");

QString WatchlistWidget::marketGroup(const QString& category) {
    const QString c = category.toLower();
    if (c.startsWith("forex"))                              return "Forex";
    if (c.contains("crypto"))                               return "Crypto";
    if (c.contains("commodit") || c.contains("metal"))      return "Commodities";
    if (c.contains("index") || c.contains("indices"))       return "Indices";
    if (c.contains("stock") || c.contains("equity") || c.contains("share")) return "Stocks";
    return "Other";
}

WatchlistWidget::WatchlistWidget(QWidget* parent) : QWidget(parent) {
    // "Market Watch: 16:22:00" — the clock is part of MT5's panel title and is
    // the quickest confirmation that the terminal is still ticking.
    m_title = new QLabel;
    m_clock = new QTimer(this);
    m_clock->setInterval(1000);
    connect(m_clock, &QTimer::timeout, this, [this]() {
        m_title->setText(tr("Market Watch: %1").arg(QTime::currentTime().toString("HH:mm:ss")));
    });
    m_clock->start();
    m_title->setText(tr("Market Watch: %1").arg(QTime::currentTime().toString("HH:mm:ss")));

    m_search = new QLineEdit;
    m_search->setPlaceholderText(tr("Search…"));
    m_search->setClearButtonEnabled(true);
    connect(m_search, &QLineEdit::textChanged, this, [this]() { applyFilter(); });

    m_marketBtn = new QPushButton(tr("All  ▾"));
    m_marketBtn->setCursor(Qt::PointingHandCursor);
    connect(m_marketBtn, &QPushButton::clicked, this, &WatchlistWidget::openMarketMenu);

    auto* controls = new QHBoxLayout;
    controls->setContentsMargins(4, 3, 4, 3);
    controls->setSpacing(4);
    controls->addWidget(m_search, 1);
    controls->addWidget(m_marketBtn);

    m_table = new QTableWidget;
    m_table->setColumnCount(4);
    m_table->setHorizontalHeaderLabels({tr("Symbol"), tr("Bid"), tr("Ask"), tr("Spread")});
    m_table->verticalHeader()->setVisible(false);
    m_table->verticalHeader()->setDefaultSectionSize(20);   // MT5-tight rows
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setShowGrid(true);
    m_table->setAlternatingRowColors(true);
    m_table->setWordWrap(false);
    // No scrollbars: the columns are sized to fit the panel, and the list is
    // driven by the wheel / keyboard. Both bars were pure chrome here.
    m_table->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_table->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    // Plain interactive widths that add up to the default panel width, with
    // Spread taking the slack — and the user free to drag any of them.
    // Automatic modes were tried and both failed: Stretch-on-all elided symbols
    // to "EUR…", and Stretch-on-symbol + Fixed left the fixed widths unapplied
    // and collapsed the symbol column to "…".
    // Symbol fixed, the three number columns SHARE whatever is left.
    //
    // They were all Interactive with hand-picked widths, so their total was
    // whatever those numbers happened to add up to — and when that exceeded the
    // panel, the last column ran off the right edge. Hiding the scrollbar did
    // not stop the overflow, it only hid the evidence: the Spread values were
    // still out there, reachable by scrolling sideways, which is exactly what
    // was reported. Stretch makes the sum equal the viewport by construction,
    // so no column can ever fall off it again.
    auto* hh = m_table->horizontalHeader();
    hh->setStretchLastSection(false);
    // Spread's header follows its values into the centre.
    m_table->horizontalHeaderItem(3)->setTextAlignment(Qt::AlignHCenter | Qt::AlignVCenter);
    hh->setSectionResizeMode(0, QHeaderView::Fixed);     // Symbol
    hh->setSectionResizeMode(1, QHeaderView::Stretch);   // Bid
    hh->setSectionResizeMode(2, QHeaderView::Stretch);   // Ask
    hh->setSectionResizeMode(3, QHeaderView::Stretch);   // Spread
    // 96 holds "star + arrow + EURUSD" without eliding; the rest of the panel is
    // divided equally between Bid, Ask and Spread, which at a 300px panel gives
    // them ~68px each — enough for a 5-decimal quote in the monospace face they
    // are drawn in, and more than enough for a spread in points.
    m_table->setColumnWidth(0, 96);
    connect(m_table, &QTableWidget::itemSelectionChanged,
            this, &WatchlistWidget::onSelectionChanged);
    // Row index maps straight into m_all — applyFilter() rebuilds the table in
    // that order, so the two stay aligned.
    connect(m_table, &QTableWidget::cellDoubleClicked, this, [this](int row, int) {
        if (row < 0 || row >= m_all.size()) return;
        emit symbolDoubleClicked(m_all.at(row).symbol);
    });
    // Right-click a row to star it. A context menu rather than a star column:
    // the panel is ~300px wide and every pixel spent on chrome comes out of the
    // symbol name, which is already the first thing to elide.
    m_table->setContextMenuPolicy(Qt::CustomContextMenu);
    connect(m_table, &QTableWidget::customContextMenuRequested,
            this, &WatchlistWidget::openRowMenu);

    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->setSpacing(0);
    lay->addWidget(m_title);
    lay->addLayout(controls);
    lay->addWidget(m_table, 1);

    applyTheme();
    connect(Theme::notifier(), &Theme::Notifier::changed, this, &WatchlistWidget::applyTheme);
}

void WatchlistWidget::applyTheme() {
    const auto& c = Theme::p();
    m_title->setStyleSheet(QString("background:%1; color:%2; font-weight:600; font-size:11px;"
                                   "padding:4px 6px; border-bottom:1px solid %3;")
                           .arg(c.panelAlt, c.text, c.border));
    m_search->setStyleSheet(QString(
        "QLineEdit{background:%1; border:1px solid %2; border-radius:3px;"
        "padding:3px 6px; color:%3;}"
        "QLineEdit:focus{border:1px solid %4;}")
        .arg(c.inputBg, c.inputBorder, c.textStrong, c.accent));
    m_marketBtn->setStyleSheet(QString(
        "QPushButton{background:%1; color:%2; border:1px solid %3;"
        "border-radius:3px; padding:3px 8px; font-weight:600;}"
        "QPushButton:hover{background:%4; color:%5;}")
        .arg(c.btnBg, c.text, c.btnBorder, c.btnHover, c.textStrong));

    // Row colours live in the items, so replay the last tick for each row.
    for (auto it = m_rows.begin(); it != m_rows.end(); ++it) {
        const Row& r = it.value();
        if (r.row < 0) continue;
        if (auto* bid = m_table->item(r.row, 1))
            bid->setForeground(QColor(r.dir > 0 ? c.up : r.dir < 0 ? c.down : c.text));
        if (auto* ask = m_table->item(r.row, 2))
            ask->setForeground(QColor(r.dir > 0 ? c.up : r.dir < 0 ? c.down : c.text));
        if (auto* sym = m_table->item(r.row, 0))
            sym->setForeground(QColor(r.dir > 0 ? c.up : r.dir < 0 ? c.down : c.muted));
        if (auto* sp = m_table->item(r.row, 3))
            sp->setForeground(QColor(c.muted));
    }
}

void WatchlistWidget::setSymbols(const QVector<SymbolSpec>& symbols) {
    m_all = symbols;
    m_rows.clear();
    m_selected.clear();

    const auto& c = Theme::p();
    QFont mono("Consolas");
    mono.setStyleHint(QFont::Monospace);

    m_selecting = true;
    m_table->setRowCount(symbols.size());
    int r = 0;
    for (const SymbolSpec& s : symbols) {
        // Stars are restored from Config before the symbol list arrives, so they
        // have to be painted in as the rows are built, not only on toggle.
        const QString star = isFavourite(s.symbol) ? QString::fromUtf8(STAR_ON) + " " : QString();
        auto* sym = new QTableWidgetItem(
            QString("%1%2  %3").arg(star, QString::fromUtf8(ARROW_FLAT), s.symbol));
        sym->setForeground(QColor(c.muted));

        for (int col = 1; col <= 3; ++col) {
            auto* it = new QTableWidgetItem("—");
            // Bid and Ask are right-aligned so their decimal points line up
            // down the column, which is how a price list is read. Spread is a
            // one- or two-character figure with nothing to align against, so it
            // is centred in its own column instead of hugging the panel edge.
            it->setTextAlignment(col == 3 ? (Qt::AlignHCenter | Qt::AlignVCenter)
                                          : (Qt::AlignRight   | Qt::AlignVCenter));
            it->setFont(mono);
            m_table->setItem(r, col, it);
        }
        m_table->setItem(r, 0, sym);

        Row row;
        row.row = r; row.digits = s.digits; row.group = marketGroup(s.category);
        m_rows.insert(s.symbol, row);
        ++r;
    }
    m_selecting = false;

    applyFilter();
    if (!symbols.isEmpty()) selectSymbol(symbols.front().symbol);
}

void WatchlistWidget::setFavourites(const QStringList& symbols) {
    m_favourites = symbols;
    for (const SymbolSpec& s : m_all) refreshSymbolCell(s.symbol);
    applyFilter();
}

// "★ ▲ EURUSD" / "▲ EURUSD". The star leads so a starred row is findable by
// eye down the left edge of the column, which is the whole point of starring.
void WatchlistWidget::refreshSymbolCell(const QString& symbol) {
    auto it = m_rows.constFind(symbol);
    if (it == m_rows.constEnd() || it->row < 0) return;
    auto* cell = m_table->item(it->row, 0);
    if (!cell) return;
    const char* arrow = it->dir > 0 ? ARROW_UP : it->dir < 0 ? ARROW_DOWN : ARROW_FLAT;
    const QString star = isFavourite(symbol) ? QString::fromUtf8(STAR_ON) + " " : QString();
    cell->setText(QString("%1%2  %3").arg(star, QString::fromUtf8(arrow), symbol));
}

void WatchlistWidget::toggleFavourite(const QString& symbol) {
    if (m_favourites.contains(symbol)) m_favourites.removeAll(symbol);
    else                               m_favourites.append(symbol);
    refreshSymbolCell(symbol);
    // Un-starring the last favourite while the Favourites filter is on would
    // leave an empty panel with no obvious way out; fall back to All.
    if (m_activeGroup == kFavGroup && m_favourites.isEmpty()) setMarket(QString());
    else                                                      applyFilter();
    emit favouritesChanged(m_favourites);
}

void WatchlistWidget::openRowMenu(const QPoint& pos) {
    const int row = m_table->rowAt(pos.y());
    if (row < 0 || row >= m_all.size()) return;
    const QString symbol = m_all.at(row).symbol;

    const auto& c = Theme::p();
    QMenu menu(this);
    menu.setStyleSheet(QString(
        "QMenu{background:%1; border:1px solid %2; padding:3px;}"
        "QMenu::item{padding:5px 18px 5px 12px; color:%3;}"
        "QMenu::item:selected{background:%4; color:%5;}")
        .arg(c.menuBg, c.menuBorder, c.text, c.menuSel, c.textStrong));

    const bool fav = isFavourite(symbol);
    QAction* star = menu.addAction(fav ? tr("Remove %1 from favourites").arg(symbol)
                                       : tr("★  Add %1 to favourites").arg(symbol));
    connect(star, &QAction::triggered, this, [this, symbol]() { toggleFavourite(symbol); });

    if (!m_favourites.isEmpty()) {
        menu.addSeparator();
        QAction* only = menu.addAction(tr("Show favourites only  (%1)").arg(m_favourites.size()));
        connect(only, &QAction::triggered, this, [this]() { setMarket(kFavGroup); });
    }
    menu.addSeparator();
    QAction* trade = menu.addAction(tr("New order…"));
    connect(trade, &QAction::triggered, this, [this, symbol]() { emit symbolDoubleClicked(symbol); });

    menu.exec(m_table->viewport()->mapToGlobal(pos));
}

void WatchlistWidget::onSelectionChanged() {
    if (m_selecting) return;
    const int r = m_table->currentRow();
    if (r < 0 || r >= m_all.size()) return;
    const QString sym = m_all.at(r).symbol;
    if (sym == m_selected) return;
    m_selected = sym;
    emit symbolActivated(sym);
}

void WatchlistWidget::selectSymbol(const QString& symbol) {
    auto it = m_rows.constFind(symbol);
    if (it == m_rows.constEnd() || it->row < 0) return;
    if (symbol == m_selected) return;
    m_selected = symbol;
    m_selecting = true;
    m_table->selectRow(it->row);
    m_selecting = false;
    emit symbolActivated(symbol);
}

void WatchlistWidget::openMarketMenu() {
    QMap<QString, int> counts;
    for (const SymbolSpec& s : m_all) counts[marketGroup(s.category)]++;

    const auto& c = Theme::p();
    QMenu menu(this);
    menu.setStyleSheet(QString(
        "QMenu{background:%1; border:1px solid %2; padding:3px;}"
        "QMenu::item{padding:5px 18px 5px 12px; color:%3;}"
        "QMenu::item:selected{background:%4; color:%5;}")
        .arg(c.menuBg, c.menuBorder, c.text, c.menuSel, c.textStrong));

    QAction* all = menu.addAction(tr("All Markets   (%1)").arg(m_all.size()));
    connect(all, &QAction::triggered, this, [this]() { setMarket(QString()); });

    // Favourites sits with All at the top, above the segments — it is the entry
    // a trader who has starred anything reaches for most. Hidden entirely while
    // nothing is starred rather than shown as a dead "(0)".
    if (!m_favourites.isEmpty()) {
        QAction* fav = menu.addAction(tr("★  Favourites   (%1)").arg(m_favourites.size()));
        connect(fav, &QAction::triggered, this, [this]() { setMarket(kFavGroup); });
    }
    menu.addSeparator();

    const QStringList order = {"Forex", "Crypto", "Commodities", "Indices", "Stocks", "Other"};
    for (const QString& g : order) {
        if (!counts.contains(g)) continue;
        QAction* a = menu.addAction(QString("%1   (%2)").arg(g).arg(counts[g]));
        connect(a, &QAction::triggered, this, [this, g]() { setMarket(g); });
    }
    menu.exec(m_marketBtn->mapToGlobal(QPoint(0, m_marketBtn->height() + 2)));
}

void WatchlistWidget::setMarket(const QString& group) {
    m_activeGroup = group;
    const QString label = group.isEmpty()    ? tr("All")
                        : group == kFavGroup ? QString::fromUtf8(STAR_ON)
                                             : group;
    m_marketBtn->setText(label + "  ▾");
    applyFilter();
}

void WatchlistWidget::applyFilter() {
    const QString q = m_search->text().trimmed().toUpper();
    for (const SymbolSpec& s : m_all) {
        auto it = m_rows.constFind(s.symbol);
        if (it == m_rows.constEnd() || it->row < 0) continue;
        const bool groupOk  = m_activeGroup.isEmpty()
            || (m_activeGroup == kFavGroup ? isFavourite(s.symbol)
                                           : it->group == m_activeGroup);
        const bool searchOk = q.isEmpty()
            || s.symbol.toUpper().contains(q)
            || s.displayName.toUpper().contains(q);
        // Instruments the feed never quotes would sit here as a column of "—"
        // forever. Hide until a price arrives; updateQuote() reveals the row on
        // the first quote, so nothing tradable stays hidden.
        m_table->setRowHidden(it->row, !(groupOk && searchOk && it->hasPrice));
    }
}

void WatchlistWidget::updateQuote(const Quote& q) {
    auto it = m_rows.find(q.symbol);
    if (it == m_rows.end() || it->row < 0) return;
    Row& row = it.value();
    const auto& t = Theme::p();

    // First real quote for this symbol — it earns its place in the list.
    if (!row.hasPrice && (q.bid > 0.0 || q.ask > 0.0)) {
        row.hasPrice = true;
        applyFilter();
    }

    if (q.bid > row.lastBid)      row.dir = 1;
    else if (q.bid < row.lastBid) row.dir = -1;
    row.lastBid = q.bid;

    const QColor dirColor(row.dir > 0 ? t.up : row.dir < 0 ? t.down : t.text);

    if (auto* sym = m_table->item(row.row, 0)) {
        const char* arrow = row.dir > 0 ? ARROW_UP : row.dir < 0 ? ARROW_DOWN : ARROW_FLAT;
        // Re-applied on every tick, not just on toggle — this line rewrites the
        // whole cell, so leaving it out would quietly strip the star off any
        // symbol that is actually moving.
        const QString star = isFavourite(q.symbol) ? QString::fromUtf8(STAR_ON) + " " : QString();
        sym->setText(QString("%1%2  %3").arg(star, QString::fromUtf8(arrow), q.symbol));
        sym->setForeground(dirColor);
    }
    if (auto* bid = m_table->item(row.row, 1)) {
        bid->setText(QString::number(q.bid, 'f', row.digits));
        bid->setForeground(dirColor);
    }
    if (auto* ask = m_table->item(row.row, 2)) {
        ask->setText(QString::number(q.ask, 'f', row.digits));
        ask->setForeground(dirColor);
    }
    // Spread in points, the unit MT5 shows it in.
    if (auto* sp = m_table->item(row.row, 3)) {
        const double points = q.spread * std::pow(10.0, row.digits - 1);
        sp->setText(QString::number(points, 'f', 1));
        // Colour it explicitly. Bid and Ask are recoloured on every tick but
        // this one never was, so it kept the style's default item colour — which
        // on the dark theme is near enough to the row background that the value
        // was invisible. It read as "the spread column is empty", and the column
        // was blamed for it. Muted, not full-strength: it is context, not a
        // price.
        sp->setForeground(QColor(t.muted));
    }
}
