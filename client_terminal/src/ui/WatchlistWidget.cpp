#include "ui/WatchlistWidget.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QPushButton>
#include <QMenu>
#include <QMap>
#include <QPoint>
#include <QFrame>
#include <QScrollArea>
#include <QEvent>
#include <QMouseEvent>
#include <cmath>

// Scope to the card frame ONLY via the #card id selector — a bare `QFrame`
// selector also hits every QLabel (QLabel derives from QFrame), which drew
// borders around the bid/ask/badge. #card keeps the border on the outer card.
static const char* CARD_BASE =
    "QFrame#card{background:#14161b; border:1px solid #23262e; border-radius:10px;}"
    "QFrame#card:hover{border-color:#3a4358;}";
static const char* CARD_SEL =
    "QFrame#card{background:#172033; border:1px solid #3b82f6; border-radius:10px;}";

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
    auto* title = new QLabel(tr("WATCHLIST"));
    title->setStyleSheet("color:#7c828c; font-weight:700; font-size:10px; letter-spacing:1.5px; padding:10px 12px 6px 12px;");

    m_search = new QLineEdit;
    m_search->setPlaceholderText(tr("Search instruments…"));
    m_search->setClearButtonEnabled(true);
    m_search->setStyleSheet(
        "QLineEdit{background:#1a1d23; border:1px solid #2a2e36; border-radius:8px;"
        "padding:7px 10px; color:#e6e9ee; font-size:12px;}"
        "QLineEdit:focus{border:1px solid #3b82f6;}");
    connect(m_search, &QLineEdit::textChanged, this, [this]() { applyFilter(); });

    m_marketBtn = new QPushButton(tr("All Markets  ▾"));
    m_marketBtn->setCursor(Qt::PointingHandCursor);
    m_marketBtn->setStyleSheet(
        "QPushButton{background:#1f2937; color:#cbd5e1; border:1px solid #2f3a4d;"
        "border-radius:8px; padding:7px 12px; font-weight:600; font-size:12px;}"
        "QPushButton:hover{background:#25324a; border-color:#3b82f6; color:#fff;}");
    connect(m_marketBtn, &QPushButton::clicked, this, &WatchlistWidget::openMarketMenu);

    auto* controls = new QHBoxLayout;
    controls->setContentsMargins(12, 0, 12, 8);
    controls->setSpacing(8);
    controls->addWidget(m_search, 1);
    controls->addWidget(m_marketBtn);

    // Scrollable card list.
    auto* scroll = new QScrollArea;
    scroll->setWidgetResizable(true);
    scroll->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    scroll->setFrameShape(QFrame::NoFrame);
    auto* holder = new QWidget;
    holder->setStyleSheet("background:transparent;");
    m_cardsLayout = new QVBoxLayout(holder);
    m_cardsLayout->setContentsMargins(10, 2, 10, 10);
    m_cardsLayout->setSpacing(8);
    m_cardsLayout->addStretch();
    scroll->setWidget(holder);

    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->setSpacing(0);
    lay->addWidget(title);
    lay->addLayout(controls);
    lay->addWidget(scroll, 1);
}

void WatchlistWidget::setSymbols(const QVector<SymbolSpec>& symbols) {
    m_all = symbols;
    // Clear existing cards.
    for (const Card& c : m_cards) if (c.frame) c.frame->deleteLater();
    m_cards.clear();
    m_cardSymbol.clear();
    m_selected.clear();

    const int insertAt = 0;   // above the trailing stretch
    int idx = insertAt;
    for (const SymbolSpec& s : symbols) {
        auto* frame = new QFrame;
        frame->setObjectName("card");
        frame->setStyleSheet(CARD_BASE);
        frame->setCursor(Qt::PointingHandCursor);
        frame->installEventFilter(this);

        auto* h = new QHBoxLayout(frame);
        h->setContentsMargins(12, 9, 12, 9);
        h->setSpacing(8);

        // Left: symbol + % change
        auto* left = new QVBoxLayout;
        left->setSpacing(2);
        auto* sym = new QLabel(s.symbol);
        sym->setStyleSheet("color:#e8eaed; font-size:14px; font-weight:700;");
        auto* chg = new QLabel("+0.00%");
        chg->setStyleSheet("color:#26a269; font-size:11px; font-weight:600;");
        left->addWidget(sym);
        left->addWidget(chg);

        // Bid column
        auto* bidBox = new QVBoxLayout;
        bidBox->setSpacing(1);
        auto* bid = new QLabel("—");
        bid->setStyleSheet("color:#e01b24; font-size:13px; font-weight:600; font-family:Consolas,monospace;");
        bid->setAlignment(Qt::AlignRight);
        auto* bidCap = new QLabel(tr("Bid"));
        bidCap->setStyleSheet("color:#6b7280; font-size:9px;");
        bidCap->setAlignment(Qt::AlignRight);
        bidBox->addWidget(bid);
        bidBox->addWidget(bidCap);

        // Spread badge
        auto* badge = new QLabel("—");
        badge->setAlignment(Qt::AlignCenter);
        badge->setFixedSize(38, 34);
        badge->setStyleSheet("background:#2563eb; color:#fff; font-size:11px; font-weight:700; border-radius:7px;");

        // Ask column
        auto* askBox = new QVBoxLayout;
        askBox->setSpacing(1);
        auto* ask = new QLabel("—");
        ask->setStyleSheet("color:#26a269; font-size:13px; font-weight:600; font-family:Consolas,monospace;");
        ask->setAlignment(Qt::AlignLeft);
        auto* askCap = new QLabel(tr("Ask"));
        askCap->setStyleSheet("color:#6b7280; font-size:9px;");
        askBox->addWidget(ask);
        askBox->addWidget(askCap);

        h->addLayout(left);
        h->addStretch();
        h->addLayout(bidBox);
        h->addWidget(badge);
        h->addLayout(askBox);

        // Clicks must reach the frame, not the child labels.
        for (QWidget* w : frame->findChildren<QWidget*>())
            w->setAttribute(Qt::WA_TransparentForMouseEvents, true);

        m_cardsLayout->insertWidget(idx++, frame);

        Card c;
        c.frame = frame; c.change = chg; c.bid = bid; c.ask = ask; c.badge = badge;
        c.digits = s.digits; c.group = marketGroup(s.category);
        m_cards.insert(s.symbol, c);
        m_cardSymbol.insert(frame, s.symbol);
    }
    applyFilter();
    if (!symbols.isEmpty()) selectSymbol(symbols.front().symbol);
}

bool WatchlistWidget::eventFilter(QObject* obj, QEvent* ev) {
    if (ev->type() == QEvent::MouseButtonPress) {
        auto it = m_cardSymbol.constFind(obj);
        if (it != m_cardSymbol.constEnd()) {
            selectSymbol(it.value());
            return false;
        }
    }
    return QWidget::eventFilter(obj, ev);
}

void WatchlistWidget::restyleCard(const QString& symbol, bool selected) {
    auto it = m_cards.constFind(symbol);
    if (it != m_cards.constEnd() && it->frame)
        it->frame->setStyleSheet(selected ? CARD_SEL : CARD_BASE);
}

void WatchlistWidget::selectSymbol(const QString& symbol) {
    if (symbol.isEmpty() || symbol == m_selected) return;
    if (!m_cards.contains(symbol)) return;
    if (!m_selected.isEmpty()) restyleCard(m_selected, false);
    m_selected = symbol;
    restyleCard(symbol, true);
    emit symbolActivated(symbol);
}

void WatchlistWidget::openMarketMenu() {
    QMap<QString, int> counts;
    for (const SymbolSpec& s : m_all) counts[marketGroup(s.category)]++;

    QMenu menu(this);
    menu.setStyleSheet(
        "QMenu{background:#16181d; border:1px solid #2a2e36; border-radius:10px; padding:6px;}"
        "QMenu::item{padding:9px 26px 9px 16px; border-radius:6px; color:#d6d9de; font-size:12px;}"
        "QMenu::item:selected{background:#1e2a44; color:#fff;}");

    QAction* all = menu.addAction(tr("All Markets   (%1)").arg(m_all.size()));
    connect(all, &QAction::triggered, this, [this]() { setMarket(QString()); });
    menu.addSeparator();

    const QStringList order = {"Forex", "Crypto", "Commodities", "Indices", "Stocks", "Other"};
    for (const QString& g : order) {
        if (!counts.contains(g)) continue;
        QAction* a = menu.addAction(QString("%1   (%2)").arg(g).arg(counts[g]));
        connect(a, &QAction::triggered, this, [this, g]() { setMarket(g); });
    }
    menu.exec(m_marketBtn->mapToGlobal(QPoint(0, m_marketBtn->height() + 4)));
}

void WatchlistWidget::setMarket(const QString& group) {
    m_activeGroup = group;
    m_marketBtn->setText((group.isEmpty() ? tr("All Markets") : group) + "  ▾");
    applyFilter();
}

void WatchlistWidget::applyFilter() {
    const QString q = m_search->text().trimmed().toUpper();
    for (const SymbolSpec& s : m_all) {
        auto it = m_cards.constFind(s.symbol);
        if (it == m_cards.constEnd() || !it->frame) continue;
        const bool groupOk  = m_activeGroup.isEmpty() || it->group == m_activeGroup;
        const bool searchOk = q.isEmpty()
            || s.symbol.toUpper().contains(q)
            || s.displayName.toUpper().contains(q);
        it->frame->setVisible(groupOk && searchOk);
    }
}

void WatchlistWidget::updateQuote(const Quote& q) {
    auto it = m_cards.find(q.symbol);
    if (it == m_cards.end()) return;
    Card& c = it.value();

    // Bid / Ask
    c.bid->setText(QString::number(q.bid, 'f', c.digits));
    c.ask->setText(QString::number(q.ask, 'f', c.digits));

    // Colour bid by tick direction.
    if (q.bid > c.lastBid)      c.bid->setStyleSheet("color:#2ec27e; font-size:13px; font-weight:600; font-family:Consolas,monospace;");
    else if (q.bid < c.lastBid) c.bid->setStyleSheet("color:#e01b24; font-size:13px; font-weight:600; font-family:Consolas,monospace;");
    c.lastBid = q.bid;

    // Spread badge — in pips (spread * 10^(digits-1)).
    const double pips = q.spread * std::pow(10.0, c.digits - 1);
    c.badge->setText(QString::number(pips, 'f', 1));

    // % change vs first bid seen this session.
    if (!c.hasRef && q.bid > 0) { c.refBid = q.bid; c.hasRef = true; }
    if (c.hasRef && c.refBid > 0) {
        const double pct = (q.bid - c.refBid) / c.refBid * 100.0;
        c.change->setText(QString("%1%2%").arg(pct >= 0 ? "+" : "").arg(pct, 0, 'f', 2));
        c.change->setStyleSheet(QString("color:%1; font-size:11px; font-weight:600;")
                                .arg(pct >= 0 ? "#26a269" : "#e01b24"));
    }
}
