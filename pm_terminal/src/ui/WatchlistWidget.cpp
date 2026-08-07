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
#include <QRegularExpression>
#include <QStringList>
#include <QTimer>
#include <QTime>
#include <QFont>
#include <QColor>
#include <cmath>

// MT5 marks direction with a small arrow beside the symbol.
static const char* ARROW_UP   = "\xE2\x96\xB2";   // ▲
static const char* ARROW_DOWN = "\xE2\x96\xBC";   // ▼
static const char* ARROW_FLAT = "\xE2\x97\x8B";   // ○

// The platform's segments are admin-managed rows in `instrument_segments`, not
// a fixed list — /api/algo/symbols reports each instrument's own segment name in
// `category`, from the same table the website groups by. So show THAT, tidied
// only for capitalisation.
//
// This used to fold `category` into five hardcoded buckets, which is why the
// terminal disagreed with the website: any segment whose name didn't happen to
// contain "forex"/"crypto"/"commodit"/"index"/"stock" collapsed into "Other",
// and a segment an admin added later could never appear at all.
QString WatchlistWidget::marketGroup(const QString& category) {
    const QString c = category.trimmed();
    if (c.isEmpty()) return tr("Other");

    // "precious metals" -> "Precious Metals". Only the first letter of each word
    // is touched, so a name the admin already capitalised survives unchanged.
    QStringList words = c.split(QRegularExpression("[\\s_]+"), Qt::SkipEmptyParts);
    for (QString& w : words)
        w[0] = w[0].toUpper();
    return words.join(QLatin1Char(' '));
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
    m_table->horizontalHeader()->setStretchLastSection(true);
    m_table->horizontalHeader()->setSectionResizeMode(QHeaderView::Interactive);
    m_table->setColumnWidth(0, 104);
    m_table->setColumnWidth(1, 80);
    m_table->setColumnWidth(2, 80);
    connect(m_table, &QTableWidget::itemSelectionChanged,
            this, &WatchlistWidget::onSelectionChanged);
    // Row index maps straight into m_all — applyFilter() rebuilds the table in
    // that order, so the two stay aligned.
    connect(m_table, &QTableWidget::cellDoubleClicked, this, [this](int row, int) {
        if (row < 0 || row >= m_all.size()) return;
        emit symbolDoubleClicked(m_all.at(row).symbol);
    });

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
        auto* sym = new QTableWidgetItem(QString("%1  %2").arg(QString::fromUtf8(ARROW_FLAT), s.symbol));
        sym->setForeground(QColor(c.muted));

        for (int col = 1; col <= 3; ++col) {
            auto* it = new QTableWidgetItem("—");
            it->setTextAlignment(Qt::AlignRight | Qt::AlignVCenter);
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
    menu.addSeparator();

    // Built from the segments actually present, not a fixed list — the previous
    // version skipped any group missing from a hardcoded array, so a segment the
    // platform defines but this file had never heard of was unreachable even
    // once marketGroup() started reporting it.
    //
    // The familiar four lead (traders look for them in this order), then
    // everything else alphabetically, with "Other" pinned last.
    const QString otherLabel = tr("Other");
    QStringList order;
    for (const char* g : {"Forex", "Crypto", "Commodities", "Indices"})
        if (counts.contains(QLatin1String(g))) order << QLatin1String(g);

    QStringList rest;
    for (auto it = counts.constBegin(); it != counts.constEnd(); ++it)
        if (!order.contains(it.key()) && it.key() != otherLabel) rest << it.key();
    rest.sort(Qt::CaseInsensitive);
    order += rest;
    if (counts.contains(otherLabel)) order << otherLabel;

    for (const QString& g : order) {
        QAction* a = menu.addAction(QString("%1   (%2)").arg(g).arg(counts[g]));
        connect(a, &QAction::triggered, this, [this, g]() { setMarket(g); });
    }
    menu.exec(m_marketBtn->mapToGlobal(QPoint(0, m_marketBtn->height() + 2)));
}

void WatchlistWidget::setMarket(const QString& group) {
    m_activeGroup = group;
    m_marketBtn->setText((group.isEmpty() ? tr("All") : group) + "  ▾");
    applyFilter();
}

void WatchlistWidget::applyFilter() {
    const QString q = m_search->text().trimmed().toUpper();
    for (const SymbolSpec& s : m_all) {
        auto it = m_rows.constFind(s.symbol);
        if (it == m_rows.constEnd() || it->row < 0) continue;
        const bool groupOk  = m_activeGroup.isEmpty() || it->group == m_activeGroup;
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
        sym->setText(QString("%1  %2").arg(QString::fromUtf8(arrow), q.symbol));
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
    }
}
