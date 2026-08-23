#include "ui/PositionsPanel.h"
#include "ui/NewsPanel.h"
#include "ui/CalendarPanel.h"
#include "ui/Theme.h"
#include "ui/Icons.h"
#include <QTabWidget>
#include <QTableWidget>
#include <QHeaderView>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QEvent>
#include <QIcon>
#include <QComboBox>
#include <QSet>
#include <QDateEdit>
#include <QLabel>
#include <QDateTime>
#include <QLocale>
#include <QApplication>
#include <QFont>
#include <QColor>

static const char* MASK = "••••";

namespace {

// Swaps a button's icon while the pointer is over it.
//
// Needed because the close ✕ fills with the sell red on hover and its icon is
// drawn in that same red — the glyph vanished into its own background exactly
// when the user was pointing at it. A style sheet cannot recolour an icon, and
// enterEvent/leaveEvent need a subclass, so this rides along as an event filter
// parented to the button (destroyed with it — the blotter rebuilds its rows
// every four seconds).
class HoverIconSwap : public QObject {
public:
    HoverIconSwap(QPushButton* btn, QIcon normal, QIcon hovered)
        : QObject(btn), m_btn(btn), m_normal(std::move(normal)),
          m_hovered(std::move(hovered)) {
        btn->installEventFilter(this);
    }

protected:
    bool eventFilter(QObject* o, QEvent* e) override {
        if (o == m_btn) {
            if (e->type() == QEvent::Enter)      m_btn->setIcon(m_hovered);
            else if (e->type() == QEvent::Leave) m_btn->setIcon(m_normal);
        }
        return QObject::eventFilter(o, e);
    }

private:
    QPushButton* m_btn;
    QIcon m_normal, m_hovered;
};

} // namespace

static QTableWidget* makeTable(const QStringList& headers) {
    auto* t = new QTableWidget;
    t->setColumnCount(headers.size());
    t->setHorizontalHeaderLabels(headers);
    t->verticalHeader()->setVisible(false);
    t->verticalHeader()->setDefaultSectionSize(20);   // MT5-tight rows
    t->setEditTriggers(QAbstractItemView::NoEditTriggers);
    t->setSelectionBehavior(QAbstractItemView::SelectRows);
    t->setShowGrid(true);
    t->setAlternatingRowColors(true);
    t->setWordWrap(false);
    // Share the width across every column instead of sizing each to its content
    // and dumping all the slack into the last one — that left a wide empty band
    // down the right of the blotter.
    t->horizontalHeader()->setStretchLastSection(false);
    t->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    return t;
}

static QTableWidgetItem* cell(const QString& text, Qt::Alignment a = Qt::AlignLeft | Qt::AlignVCenter) {
    auto* it = new QTableWidgetItem(text);
    it->setTextAlignment(a);
    it->setFlags(it->flags() & ~Qt::ItemIsEditable);
    return it;
}

// An S/L or T/P cell the trader can type into. Carries the position id and the
// level it was rendered with, so a commit knows which position it belongs to
// and whether the value actually changed — the table is rebuilt every four
// seconds, and a rebuild must not read as an edit.
static QTableWidgetItem* bracketCell(double level, const QString& positionId, int digits) {
    auto* it = new QTableWidgetItem(level > 0 ? QString::number(level, 'f', digits) : QString());
    it->setTextAlignment(Qt::AlignRight | Qt::AlignVCenter);
    it->setData(Qt::UserRole, positionId);
    it->setData(Qt::UserRole + 1, level);
    it->setToolTip(QObject::tr("Double-click to edit. Clear the cell to remove "
                               "the level."));
    return it;
}

static QString fmt(double v, int d = 2) { return QString::number(v, 'f', d); }

// Is this ledger row money moving IN or OUT of the account, as opposed to the
// result of trading it?
//
// A trading account has no "deposit" or "withdrawal" rows of its own — those
// live on the main wallet. It is funded by a transfer from that wallet and
// drained by a transfer back, plus whatever the desk credits or adjusts. So
// funding is decided by the type being a balance operation, and the direction
// by the sign; classifying on the literal words "deposit" and "withdrawal"
// reports zero for every account on the platform.
static bool isFunding(const QString& type) {
    static const QSet<QString> kFunding = {
        QStringLiteral("deposit"),    QStringLiteral("withdrawal"),
        QStringLiteral("transfer"),   QStringLiteral("credit"),
        QStringLiteral("bonus"),      QStringLiteral("adjustment"),
        QStringLiteral("refund"),
    };
    return kFunding.contains(type.toLower());
}

static QString shortTime(const QString& iso) {
    // "2026-07-17T18:35:00+00:00" -> "2026.07.17 18:35" (MT5's format)
    if (iso.size() < 16) return iso;
    return iso.left(10).replace('-', '.') + " " + iso.mid(11, 5);
}

// MT5 writes the side in lower case in the Type column ("buy" / "sell").
static QString typeText(const QString& side) { return side.toLower(); }

// MT5 tickets are short numbers; this backend issues UUIDs, and showing one in
// full made the Ticket column wider than every other column combined. Show the
// tail (which is what distinguishes them) and keep the whole id in a tooltip.
static QTableWidgetItem* ticketCell(const QString& id) {
    auto* it = cell(id.size() > 12 ? "…" + id.right(8) : id);
    it->setToolTip(id);
    return it;
}

// The API sends "2026-07-17T18:35:00+00:00", sometimes with milliseconds.
// Qt::ISODate rejects the fractional-second form, so try both.
static QDateTime parseIso(const QString& iso) {
    QDateTime dt = QDateTime::fromString(iso, Qt::ISODate);
    if (!dt.isValid()) dt = QDateTime::fromString(iso, Qt::ISODateWithMs);
    return dt;
}

bool PositionsPanel::passes(int tab, const QString& iso) const {
    const QComboBox* box = m_range[tab];
    if (!box) return true;                       // called before the bar is built
    const int mode = box->currentIndex();
    if (mode == RangeAll) return true;

    const QDateTime dt = parseIso(iso);
    if (!dt.isValid()) return true;              // see the note in the header

    // Compared in UTC because the Time column displays the server's UTC string
    // verbatim. Filtering in local time would let "Today" hide a row whose
    // visible date is today, which reads as data loss rather than a filter.
    const QDate d     = dt.toUTC().date();
    const QDate today = QDateTime::currentDateTimeUtc().date();

    switch (mode) {
    case RangeToday: return d == today;
    case RangeWeek:  return d >= today.addDays(-(today.dayOfWeek() - 1)) && d <= today;
    case RangeDay:   return m_date[tab] && d == m_date[tab]->date();
    }
    return true;
}

QWidget* PositionsPanel::buildFilterBar(int tab) {
    auto* bar = new QWidget;
    auto* h = new QHBoxLayout(bar);
    h->setContentsMargins(6, 3, 6, 3);
    h->setSpacing(6);

    auto* label = new QLabel(tr("Period:"));

    auto* box = new QComboBox;
    box->setCursor(Qt::PointingHandCursor);
    box->addItems({tr("Today"), tr("This week"), tr("All"), tr("Date")});
    // Defaults to All, NOT Today. On the Trade tab a date filter hides open
    // positions, and a position opened yesterday is still very much open — a
    // blotter that silently omits live risk on first paint is not acceptable.
    box->setCurrentIndex(RangeAll);

    auto* date = new QDateEdit(QDate::currentDate());
    date->setCalendarPopup(true);
    date->setDisplayFormat(QStringLiteral("yyyy.MM.dd"));
    date->setVisible(false);                     // only meaningful for "Date"

    m_range[tab] = box;
    m_date[tab]  = date;

    auto rerender = [this, tab]() {
        // Re-render from the last snapshot: the stored data is unfiltered, so
        // widening the range never needs another round-trip.
        if (tab == 0)      setPositions(m_lastPositions);
        else if (tab == 1) setOrders(m_lastOrders);
        else if (tab == 2) setHistory(m_lastHistory);
        else               setTransactions(m_lastTxns);
    };
    connect(box, &QComboBox::currentIndexChanged, this, [date, rerender](int i) {
        date->setVisible(i == RangeDay);
        rerender();
    });
    connect(date, &QDateEdit::dateChanged, this, [rerender]() { rerender(); });

    h->addWidget(label);
    h->addWidget(box);
    h->addWidget(date);
    h->addStretch();

    // ── Bulk close, Trade tab only ──
    // Closing out one ✕ at a time across a dozen rows is exactly when a
    // mis-click costs money. The three sets MT5 offers are the ones that
    // matter: everything, the winners, the losers. Each is disabled when its
    // set is empty, so the bar also answers "is anything green right now?".
    if (tab == 0) {
        const auto& tc = Theme::p();
        auto mkClose = [&](const QString& text, const QString& colour, const QString& tip) {
            auto* b = new QPushButton(text);
            b->setMinimumHeight(22);
            b->setCursor(Qt::PointingHandCursor);
            b->setFocusPolicy(Qt::NoFocus);
            b->setToolTip(tip);
            b->setStyleSheet(QString(
                "QPushButton{background:transparent; color:%1; border:1px solid %1;"
                "border-radius:4px; padding:1px 9px; font-size:11px; font-weight:700;}"
                "QPushButton:hover:!disabled{background:%1; color:#ffffff;}"
                "QPushButton:disabled{color:%2; border-color:%3;}")
                .arg(colour, tc.dim, tc.btnBorder));
            return b;
        };
        m_closeAll    = mkClose(tr("Close all"),    tc.down,
                                tr("Close every open position at market"));
        m_closeProfit = mkClose(tr("Close profit"), tc.up,
                                tr("Close only the positions currently in profit"));
        m_closeLoss   = mkClose(tr("Close loss"),   tc.down,
                                tr("Close only the positions currently at a loss"));

        // Built from the same filtered set the table is showing, so a Period
        // filter narrows what these close too — closing rows the trader cannot
        // see would be indefensible.
        auto emitBatch = [this](int which) {
            QVector<OpenPosition> batch;
            for (const OpenPosition& p : m_lastPositions) {
                if (!passes(0, p.openedAt)) continue;
                if (which == 1 && !(p.profit > 0)) continue;
                if (which == 2 && !(p.profit < 0)) continue;
                batch.append(p);
            }
            if (batch.isEmpty()) return;
            emit closeBatch(batch, which == 0 ? tr("all %1 open position(s)").arg(batch.size())
                                 : which == 1 ? tr("%1 position(s) in profit").arg(batch.size())
                                              : tr("%1 losing position(s)").arg(batch.size()));
        };
        connect(m_closeAll,    &QPushButton::clicked, this, [emitBatch]() { emitBatch(0); });
        connect(m_closeProfit, &QPushButton::clicked, this, [emitBatch]() { emitBatch(1); });
        connect(m_closeLoss,   &QPushButton::clicked, this, [emitBatch]() { emitBatch(2); });

        h->addWidget(m_closeProfit);
        h->addWidget(m_closeLoss);
        h->addWidget(m_closeAll);
        updateCloseButtons({});
    }

    // Pagination, Transactions only. The other three tabs hold a working set a
    // trader wants to see whole — open positions and live pending orders are
    // risk, and hiding half of them behind a page control would be wrong. The
    // ledger is different: it only grows, and nothing on page 4 is urgent.
    if (tab == 3) {
        const auto& c = Theme::p();

        // Funding is the reason a trader opens this tab, and on a busy account
        // it is buried: every close writes a profit or loss row, so 15 real
        // deposits and withdrawals sit under 120 trading rows and three pages
        // of scrolling. This pulls them straight out.
        m_txnKind = new QComboBox;
        m_txnKind->setCursor(Qt::PointingHandCursor);
        m_txnKind->addItem(tr("All types"),                KindAll);
        m_txnKind->addItem(tr("Deposits & withdrawals"),   KindFunding);
        m_txnKind->addItem(tr("Trading only"),             KindTrading);
        connect(m_txnKind, &QComboBox::currentIndexChanged, this, [this](int) {
            m_txnPage = 0;                        // the old page may not exist now
            setTransactions(m_lastTxns);
        });
        h->insertWidget(3, m_txnKind);            // after Period, before the stretch

        m_txnPageSize = new QComboBox;
        m_txnPageSize->setCursor(Qt::PointingHandCursor);
        for (int n : {5, 10, 15, 20, 25, 50}) m_txnPageSize->addItem(tr("%1 / page").arg(n), n);
        m_txnPageSize->setCurrentIndex(0);       // 5
        connect(m_txnPageSize, &QComboBox::currentIndexChanged, this, [this](int) {
            m_txnPage = 0;                        // page 3 of 5-per-page is page 1 of 25
            setTransactions(m_lastTxns);
        });

        auto mkNav = [&](const QString& glyph) {
            auto* b = new QPushButton(glyph);
            b->setFixedSize(26, 22);
            b->setCursor(Qt::PointingHandCursor);
            b->setFocusPolicy(Qt::NoFocus);
            b->setStyleSheet(QString(
                "QPushButton{background:%1; color:%2; border:1px solid %3;"
                "border-radius:4px; font-weight:800;}"
                "QPushButton:hover:!disabled{border-color:%4; color:%4;}"
                "QPushButton:disabled{color:%5;}")
                .arg(c.btnBg, c.textStrong, c.btnBorder, c.accent, c.dim));
            return b;
        };
        m_txnPrev = mkNav(QStringLiteral("‹"));
        m_txnNext = mkNav(QStringLiteral("›"));
        connect(m_txnPrev, &QPushButton::clicked, this, [this]() {
            if (m_txnPage > 0) { --m_txnPage; setTransactions(m_lastTxns); }
        });
        connect(m_txnNext, &QPushButton::clicked, this, [this]() {
            ++m_txnPage; setTransactions(m_lastTxns);   // clamped on render
        });

        m_txnPageLbl = new QLabel;
        m_txnPageLbl->setStyleSheet(QString("color:%1; font-size:11px;"
                                            "font-family:Consolas,monospace;").arg(c.muted));

        h->addWidget(m_txnPageSize);
        h->addSpacing(4);
        h->addWidget(m_txnPrev);
        h->addWidget(m_txnPageLbl);
        h->addWidget(m_txnNext);
    }
    return bar;
}

int PositionsPanel::txnPageSize() const {
    // 5 before the bar exists — setTransactions can run from applyTheme() during
    // construction, ahead of the filter bar it reads this from.
    if (!m_txnPageSize) return 5;
    const int n = m_txnPageSize->currentData().toInt();
    return n > 0 ? n : 5;
}

// Enabled only when the set is non-empty — the bar doubles as a read on what
// is currently open, and a button that closes nothing is a trap.
void PositionsPanel::updateCloseButtons(const QVector<OpenPosition>& shown) {
    if (!m_closeAll) return;
    int profit = 0, loss = 0;
    for (const OpenPosition& p : shown) {
        if (p.profit > 0) ++profit;
        else if (p.profit < 0) ++loss;
    }
    m_closeAll->setEnabled(!shown.isEmpty());
    m_closeProfit->setEnabled(profit > 0);
    m_closeLoss->setEnabled(loss > 0);
}

// Everything about a row except the numbers that move with the market. The
// brackets are in it because an S/L cell carries its own level and must be
// rewritten when the server's value changes.
QString PositionsPanel::rowsSignature(const QVector<OpenPosition>& v) {
    QString s;
    s.reserve(v.size() * 48);
    for (const OpenPosition& p : v)
        s += p.id + QLatin1Char('|') + QString::number(p.sl, 'f', 5)
                  + QLatin1Char('|') + QString::number(p.tp, 'f', 5)
                  + QLatin1Char('|') + QString::number(p.lots, 'f', 4) + QLatin1Char(';');
    return s;
}

QWidget* PositionsPanel::wrapTable(int tab, QTableWidget* table) {
    auto* page = new QWidget;
    auto* v = new QVBoxLayout(page);
    v->setContentsMargins(0, 0, 0, 0);
    v->setSpacing(0);
    v->addWidget(buildFilterBar(tab));
    v->addWidget(table, 1);
    // History alone closes with a summary. It is the only tab that answers
    // "how did the account get from there to here", and a list of closed
    // trades without its totals is the half of that question nobody wants.
    if (tab == 2) v->addWidget(buildHistorySummary());
    return page;
}

// The strip under the History table: what the period earned, what was paid in
// and taken out over it, and where the balance stands now.
//
// Profit is summed from the rows on screen, so it always agrees with the
// column above it — change the period and both move together. Deposits and
// withdrawals come from the transaction ledger filtered by the SAME period,
// not by the Transactions tab's own selector; two different periods feeding
// one row of figures would be unreadable. Balance is the live account figure
// and deliberately not period-scoped: it is a position, not a flow.
QWidget* PositionsPanel::buildHistorySummary() {
    auto* bar = new QWidget;
    bar->setObjectName(QStringLiteral("historySummary"));
    m_histSummary = bar;
    auto* h = new QHBoxLayout(bar);
    h->setContentsMargins(10, 5, 10, 5);
    h->setSpacing(18);

    auto field = [&](const QString& caption, QLabel** out) {
        auto* wrap = new QWidget;
        auto* row = new QHBoxLayout(wrap);
        row->setContentsMargins(0, 0, 0, 0);
        row->setSpacing(6);
        auto* cap = new QLabel(caption);
        cap->setObjectName(QStringLiteral("sumCaption"));
        auto* val = new QLabel(QStringLiteral("—"));
        val->setObjectName(QStringLiteral("sumValue"));
        row->addWidget(cap);
        row->addWidget(val);
        *out = val;
        h->addWidget(wrap);
    };

    field(tr("Profit / loss"), &m_sumProfit);
    field(tr("Deposit"),       &m_sumDeposit);
    field(tr("Withdrawal"),    &m_sumWithdrawal);
    h->addStretch(1);
    field(tr("Balance"),       &m_sumBalance);
    return bar;
}

void PositionsPanel::refreshHistorySummary() {
    if (!m_sumProfit) return;                    // called before the bar is built
    const auto& c = Theme::p();

    // Restyled here rather than once at construction because this runs on the
    // theme-change path too — applyTheme() re-renders every tab through
    // setHistory(), which lands back in this function.
    // #historySummary, not a bare QWidget: a type selector would match every
    // child, and the top border would be drawn around each label as well.
    m_histSummary->setStyleSheet(QString("QWidget#historySummary{background:%1;"
                                         "border-top:1px solid %2;}")
                                 .arg(c.panelAlt, c.border));
    for (QLabel* l : m_histSummary->findChildren<QLabel*>(QStringLiteral("sumCaption")))
        l->setStyleSheet(QString("color:%1; font-size:10px; font-weight:800;"
                                 "letter-spacing:0.6px;").arg(c.muted));

    // Swap and commission are part of what the period cost: a trade that made
    // 12.00 gross and paid 14.00 in swap lost money, and a "Profit" that says
    // otherwise is worse than no figure at all.
    double profit = 0.0;
    for (const HistoryTrade& t : m_lastHistory)
        if (passes(2, t.closedAt)) profit += t.profit + t.swap + t.commission;

    // Split by direction, not by the type word — see isFunding(). The ledger is
    // signed, so money in is simply the positive side of the balance operations
    // and money out the negative one.
    double deposit = 0.0, withdrawal = 0.0;
    for (const Transaction& t : m_lastTxns) {
        if (!passes(2, t.createdAt) || !isFunding(t.type)) continue;
        (t.amount >= 0 ? deposit : withdrawal) += t.amount;
    }

    auto money = [&](double v) {
        return m_privacy ? QString::fromUtf8(MASK)
                         : QString("%1 %2").arg(fmt(v), m_lastAccount.currency);
    };
    auto paint = [&](QLabel* l, double v, bool colour) {
        l->setText(money(v));
        l->setStyleSheet(QString("font-weight:800; color:%1;")
                         .arg(!colour || m_privacy ? c.textStrong
                                                   : (v >= 0 ? c.up : c.down)));
    };

    paint(m_sumProfit,     profit,     true);
    paint(m_sumDeposit,    deposit,    false);
    paint(m_sumWithdrawal, withdrawal, false);
    // Balance is not coloured: it is not a gain or a loss, and a red balance
    // on a losing period would read as an account in deficit.
    paint(m_sumBalance,    m_lastAccount.balance, false);
}

void PositionsPanel::setAccount(const AccountInfo& account) {
    if (!account.valid) return;
    m_lastAccount = account;
    refreshHistorySummary();
}

PositionsPanel::PositionsPanel(QWidget* parent) : QWidget(parent) {
    m_tabs = new QTabWidget;
    m_tabs->setDocumentMode(true);

    m_posTable = makeTable({tr("Symbol"), tr("Ticket"), tr("Time"), tr("Type"), tr("Volume"),
                            tr("Price"), tr("S/L"), tr("T/P"), tr("Price"), tr("Swap"),
                            tr("Profit"), tr("Action")});
    m_orderTable = makeTable({tr("Symbol"), tr("Ticket"), tr("Time"), tr("Type"), tr("Volume"),
                              tr("Price"), tr("S/L"), tr("T/P"), tr("Action")});
    m_histTable = makeTable({tr("Symbol"), tr("Ticket"), tr("Time"), tr("Type"), tr("Volume"),
                             tr("Price"), tr("Price"), tr("Swap"), tr("Commission"), tr("Profit")});
    m_txnTable = makeTable({tr("Time"), tr("Type"), tr("Method"), tr("Description"),
                            tr("Amount"), tr("Currency")});

    // Action holds a control, not data: pin it narrow so it does not take an
    // equal share of the width like the value columns do — just wide enough for
    // the header word and a centred button.
    // 68px fits the two 22px icon buttons (edit + close) with their spacing and
    // the header word. It was 92 while the edit control was a wider "S/L" text
    // button; that has since become a pencil icon.
    const int closeCol = m_posTable->columnCount() - 1;
    m_posTable->horizontalHeader()->setSectionResizeMode(closeCol, QHeaderView::Fixed);
    // 96, not 68: the cell holds three 24px buttons now (share, edit, close)
    // with their spacing, and at 68 the third one was clipped out of sight.
    m_posTable->setColumnWidth(closeCol, 96);
    // 68px, matching the Trade tab: this cell now holds the same edit + cancel
    // pair rather than a lone ✕.
    const int cancelCol = m_orderTable->columnCount() - 1;
    m_orderTable->horizontalHeader()->setSectionResizeMode(cancelCol, QHeaderView::Fixed);
    m_orderTable->setColumnWidth(cancelCol, 68);

    // Only the open-positions table takes edits, and only its S/L and T/P
    // cells are marked editable — every other item has the flag cleared.
    m_posTable->setEditTriggers(QAbstractItemView::DoubleClicked
                                | QAbstractItemView::EditKeyPressed);
    connect(m_posTable, &QTableWidget::itemChanged, this, &PositionsPanel::onBracketEdited);

    // Each tab is table + its own filter bar, so a range chosen on History does
    // not silently reach into the open-positions tab.
    m_tabTrade   = m_tabs->addTab(wrapTable(0, m_posTable),   tr("Trade"));
    m_tabPending = m_tabs->addTab(wrapTable(1, m_orderTable), tr("Pending"));
    m_tabHistory = m_tabs->addTab(wrapTable(2, m_histTable),  tr("History"));
    // No filter bar on News — the feed is the provider's, not a table we page
    // through, so a Period selector would have nothing to filter.
    m_news = new NewsPanel;
    m_tabs->addTab(m_news, tr("News"));
    // Economic calendar, next to News for the same reason: both answer "why is
    // it moving?" rather than "what do I hold?". It carries its own impact and
    // country filters, so it is added directly too.
    m_calendar = new CalendarPanel;
    m_tabs->addTab(m_calendar, tr("Economic"));
    // Ledger for THIS account: deposits, withdrawals, transfers, commission,
    // swap, admin adjustments. Separate from History, which lists closed
    // POSITIONS — a trade writes ledger rows but is not one itself.
    m_tabTxn = m_tabs->addTab(wrapTable(3, m_txnTable), tr("Transactions"));

    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->addWidget(m_tabs);

    connect(Theme::notifier(), &Theme::Notifier::changed, this, &PositionsPanel::applyTheme);
}

void PositionsPanel::applyTheme() {
    // The rows are unchanged but have to be REPAINTED, which is the one thing
    // the fast path in setPositions() skips — so drop the signature first.
    m_posSig.clear();
    // Colours live in the row items, so the tables are simply re-rendered.
    setPositions(m_lastPositions);
    setOrders(m_lastOrders);
    setHistory(m_lastHistory);
    setTransactions(m_lastTxns);
}

void PositionsPanel::setPrivacy(bool on) {
    m_privacy = on;
    applyTheme();   // same path: re-render every table
}

void PositionsPanel::setCollapsed(bool collapsed) {
    m_collapsed = collapsed;
    // Hide the tab area → the splitter reclaims the space for the chart above.
    m_tabs->setVisible(!collapsed);
}

// Tab caption: plain count normally, "shown/total" while a filter is hiding
// rows — otherwise a filtered tab reads as "you have no positions".
static QString tabCaption(const QString& name, int shown, int total) {
    return shown == total ? QString("%1 (%2)").arg(name).arg(total)
                          : QString("%1 (%2/%3)").arg(name).arg(shown).arg(total);
}

// True while a cell editor is open on `t`.
//
// QAbstractItemView::state() would answer this directly but is protected. The
// editor the default delegate creates for a text item is a QLineEdit parented
// into the viewport and holding focus, so that is what is looked for — and the
// type is checked, not just the ancestry, because the Action column's buttons
// live in the same viewport and keep focus after a click. Treating those as
// "editing" would freeze the blotter permanently.
static bool editorOpen(QTableWidget* t) {
    QWidget* f = QApplication::focusWidget();
    return f && f->inherits("QLineEdit") && t->viewport()->isAncestorOf(f);
}

void PositionsPanel::onBracketEdited(QTableWidgetItem* item) {
    // itemChanged fires while the table is being filled too, so every
    // setPositions() run raises it once per cell. m_populating tells a real
    // edit from a repaint.
    if (m_populating || !item) return;
    const int col = item->column();
    if (col != 6 && col != 7) return;

    const QString id = item->data(Qt::UserRole).toString();
    if (id.isEmpty()) return;

    const double was = item->data(Qt::UserRole + 1).toDouble();
    const QString text = item->text().trimmed();
    bool parsed = false;
    // An empty cell is the instruction to remove the bracket; the server reads
    // 0 as "clear it".
    const double now = text.isEmpty() ? 0.0 : QLocale().toDouble(text, &parsed);

    // Clearing the cell removes the bracket. This used to be restored instead
    // of sent, because the endpoint could not clear one — it now can, so an
    // empty cell goes through as level 0 and ApiClient turns that into an
    // explicit JSON null.
    if (!text.isEmpty() && !parsed) {
        // Unparseable: put the old value back rather than sending nonsense.
        m_populating = true;
        item->setText(was > 0 ? QString::number(was, 'f', 5) : QString());
        m_populating = false;
        return;
    }
    if (qFuzzyCompare(now + 1.0, was + 1.0)) return;   // typed the same value

    item->setData(Qt::UserRole + 1, now);
    emit bracketEdited(id, col == 6 ? QStringLiteral("sl") : QStringLiteral("tp"), now);
}

void PositionsPanel::setPositions(const QVector<OpenPosition>& positions) {
    m_lastPositions = positions;
    // A 4s poll lands while someone is halfway through typing a stop loss. The
    // snapshot is kept, but the table is left alone until the editor closes —
    // otherwise the cell is rebuilt and the half-typed value disappears.
    if (editorOpen(m_posTable)) return;

    m_populating = true;
    QVector<OpenPosition> shown;
    for (const OpenPosition& p : positions)
        if (passes(0, p.openedAt)) shown.append(p);

    const auto& c = Theme::p();
    updateCloseButtons(shown);
    m_tabs->setTabText(m_tabTrade, tabCaption(tr("Trade"), shown.size(), positions.size()));

    // ── Fast path: same rows, new numbers ──
    //
    // This runs every four seconds. The slow path below builds the action
    // buttons per row, each with a freshly rendered SVG icon and an event
    // filter, and throws away the previous set — for a trader with a dozen
    // positions open that is dozens of widgets destroyed and recreated, every
    // four seconds, for the whole session. It showed up exactly as reported: a
    // terminal that gets sluggish while you are working in it.
    //
    // Between opens and closes only the live cells actually move, so when the
    // row structure is untouched they are written in place and every widget
    // stays where it is.
    const QString sig = rowsSignature(shown);
    if (sig == m_posSig && m_posTable->rowCount() == shown.size()) {
        auto live = [this](double v) { return m_privacy ? QString::fromUtf8(MASK) : fmt(v); };
        const auto RA = Qt::AlignRight | Qt::AlignVCenter;
        for (int i = 0; i < shown.size(); ++i) {
            const OpenPosition& p = shown.at(i);
            if (auto* it = m_posTable->item(i, 8))
                // Same per-instrument precision the slow path uses, or the
                // price would change shape between a rebuild and a refresh.
                it->setText(p.currentPrice > 0 ? fmt(p.currentPrice, digitsFor(p.symbol))
                                               : QString());
            if (auto* it = m_posTable->item(i, 9)) it->setText(live(p.swap));
            if (auto* it = m_posTable->item(i, 10)) {
                it->setText(live(p.profit));
                it->setForeground(p.profit >= 0 ? QColor(c.up) : QColor(c.down));
                it->setTextAlignment(RA);
            }
        }
        m_populating = false;
        return;
    }
    m_posSig = sig;

    m_posTable->setRowCount(shown.size());
    int r = 0;
    const auto R = Qt::AlignRight | Qt::AlignVCenter;
    // Money columns are masked in privacy mode; prices are not sensitive.
    auto cash = [this](double v) {
        return m_privacy ? QString::fromUtf8(MASK) : fmt(v);
    };
    for (const OpenPosition& p : shown) {
        m_posTable->setItem(r, 0, cell(p.symbol));
        m_posTable->setItem(r, 1, ticketCell(p.id));
        m_posTable->setItem(r, 2, cell(shortTime(p.openedAt)));
        auto* typeItem = cell(typeText(p.side));
        typeItem->setForeground(p.side.compare("sell", Qt::CaseInsensitive) == 0
                                ? QColor(c.down) : QColor(c.up));
        m_posTable->setItem(r, 3, typeItem);
        m_posTable->setItem(r, 4, cell(fmt(p.lots), R));
        // Gold is quoted to 2 decimals and US30 to 1 — a flat 5 rendered them
        // as 4255.00000 / 54486.60000, and made the edit dialogs (which use the
        // instrument's real precision) look like they were truncating.
        const int d = digitsFor(p.symbol);
        m_posTable->setItem(r, 5, cell(fmt(p.openPrice, d), R));
        m_posTable->setItem(r, 6, bracketCell(p.sl, p.id, d));
        m_posTable->setItem(r, 7, bracketCell(p.tp, p.id, d));
        m_posTable->setItem(r, 8, cell(p.currentPrice > 0 ? fmt(p.currentPrice, d) : QString(), R));
        m_posTable->setItem(r, 9, cell(cash(p.swap), R));
        auto* pnl = cell(cash(p.profit), R);
        pnl->setForeground(p.profit >= 0 ? QColor(c.up) : QColor(c.down));
        QFont bf = pnl->font(); bf.setBold(true); pnl->setFont(bf);
        m_posTable->setItem(r, 10, pnl);

        // A real ✕ icon rather than the glyph: several UI fonts render "✕" as a
        // hairline that all but disappears at this size.
        auto* closeBtn = new QPushButton;
        closeBtn->setFixedSize(24, 20);
        closeBtn->setCursor(Qt::PointingHandCursor);
        closeBtn->setToolTip(tr("Close this %1 position (%2 lots)").arg(p.symbol).arg(fmt(p.lots)));
        closeBtn->setIcon(Icons::close(QColor(c.down), 14));
        closeBtn->setIconSize(QSize(14, 14));
        closeBtn->setStyleSheet(QString(
            "QPushButton{background:transparent; border:1px solid %1; border-radius:3px;}"
            "QPushButton:hover{background:%2; border-color:%2;}")
            .arg(c.btnBorder, c.down));
        // The hover fill IS the sell red, so the red glyph has to go white or it
        // disappears into it. See HoverIconSwap.
        new HoverIconSwap(closeBtn, Icons::close(QColor(c.down), 14),
                                    Icons::close(QColor("#ffffff"), 14));
        // Capture this row's own position: it closes one position, not the symbol.
        const OpenPosition row = p;
        connect(closeBtn, &QPushButton::clicked, this,
                [this, row]() { emit closePosition(row); });

        // A pencil, matching the ✕ beside it. The old "S/L" text button was the
        // odd one out in a cell of icons, and it named only half of what the
        // dialog does — it edits the take profit too.
        auto* editBtn = new QPushButton;
        editBtn->setFixedSize(24, 20);
        editBtn->setCursor(Qt::PointingHandCursor);
        editBtn->setToolTip(tr("Modify stop loss / take profit"));
        // accent, not muted: a 2px-stroke glyph drawn in the muted grey at 12px
        // was near-invisible on the light theme's row background. It also reads
        // as a pair with the red ✕ beside it — blue edits, red closes.
        editBtn->setIcon(Icons::pencil(QColor(c.accent), 14));
        editBtn->setIconSize(QSize(14, 14));
        editBtn->setStyleSheet(QString(
            "QPushButton{background:transparent; border:1px solid %1; border-radius:3px;}"
            "QPushButton:hover{border-color:%2;}")
            .arg(c.btnBorder, c.accent));
        connect(editBtn, &QPushButton::clicked, this,
                [this, row]() { emit modifyBrackets(row); });

        // Centred in the cell — a fixed-size widget handed straight to
        // setCellWidget() sticks to the left edge.
        // Share — hands out a public card for this trade. Sits with edit and
        // close because it belongs to the same row, but drawn in the muted
        // colour: it is the only one of the three that changes nothing.
        auto* shareBtn = new QPushButton;
        shareBtn->setFixedSize(24, 20);
        shareBtn->setCursor(Qt::PointingHandCursor);
        shareBtn->setToolTip(tr("Share this trade — copies a public link"));
        shareBtn->setIcon(Icons::share(QColor(c.muted), 13));
        shareBtn->setIconSize(QSize(13, 13));
        shareBtn->setStyleSheet(QString(
            "QPushButton{background:transparent; border:1px solid %1; border-radius:3px;}"
            "QPushButton:hover{border-color:%2;}")
            .arg(c.btnBorder, c.accent));
        connect(shareBtn, &QPushButton::clicked, this,
                [this, row]() { emit sharePosition(row); });

        auto* cellWrap = new QWidget;
        auto* wrapLay = new QHBoxLayout(cellWrap);
        wrapLay->setContentsMargins(0, 0, 0, 0);
        wrapLay->setSpacing(3);
        wrapLay->addStretch();
        wrapLay->addWidget(shareBtn);
        wrapLay->addWidget(editBtn);
        wrapLay->addWidget(closeBtn);
        wrapLay->addStretch();
        m_posTable->setCellWidget(r, 11, cellWrap);
        ++r;
    }
    m_populating = false;
}

void PositionsPanel::setOrders(const QVector<PendingOrder>& orders) {
    m_lastOrders = orders;
    QVector<PendingOrder> shown;
    for (const PendingOrder& o : orders)
        if (passes(1, o.createdAt)) shown.append(o);

    const auto& c = Theme::p();
    m_tabs->setTabText(m_tabPending, tabCaption(tr("Pending"), shown.size(), orders.size()));
    m_orderTable->setRowCount(shown.size());
    int r = 0;
    const auto R = Qt::AlignRight | Qt::AlignVCenter;
    for (const PendingOrder& o : shown) {
        m_orderTable->setItem(r, 0, cell(o.symbol));
        m_orderTable->setItem(r, 1, ticketCell(o.id));
        m_orderTable->setItem(r, 2, cell(shortTime(o.createdAt)));
        // Pending orders carry both a side and an order type (limit / stop);
        // MT5 shows them as one "buy limit"-style string.
        auto* typeItem = cell((typeText(o.side) + " " + o.type.toLower()).trimmed());
        typeItem->setForeground(o.side.compare("sell", Qt::CaseInsensitive) == 0
                                ? QColor(c.down) : QColor(c.up));
        m_orderTable->setItem(r, 3, typeItem);
        m_orderTable->setItem(r, 4, cell(fmt(o.lots), R));
        const int d = digitsFor(o.symbol);
        m_orderTable->setItem(r, 5, cell(o.price > 0 ? fmt(o.price, d) : QString(), R));
        m_orderTable->setItem(r, 6, cell(o.sl > 0 ? fmt(o.sl, d) : QString(), R));
        m_orderTable->setItem(r, 7, cell(o.tp > 0 ? fmt(o.tp, d) : QString(), R));

        auto* cancelBtn = new QPushButton;
        cancelBtn->setFixedSize(24, 20);   // matches the Trade tab's action pair
        cancelBtn->setCursor(Qt::PointingHandCursor);
        cancelBtn->setToolTip(tr("Cancel this pending order"));
        cancelBtn->setIcon(Icons::close(QColor(c.down), 14));
        cancelBtn->setIconSize(QSize(14, 14));
        cancelBtn->setStyleSheet(QString(
            "QPushButton{background:transparent; border:1px solid %1; border-radius:3px;}"
            "QPushButton:hover{background:%2; border-color:%2;}")
            .arg(c.btnBorder, c.down));
        // Same red-on-red hover as the Trade tab's ✕.
        new HoverIconSwap(cancelBtn, Icons::close(QColor(c.down), 14),
                                     Icons::close(QColor("#ffffff"), 14));
        const PendingOrder ord = o;
        connect(cancelBtn, &QPushButton::clicked, this,
                [this, ord]() { emit cancelOrder(ord); });

        // Edit — same pencil/✕ pair as the Trade tab. A pending order can still
        // have its price, volume and brackets changed (PUT /orders/{id}), which
        // beats cancelling and re-placing just to move a level.
        auto* editBtn = new QPushButton;
        editBtn->setFixedSize(24, 20);
        editBtn->setCursor(Qt::PointingHandCursor);
        editBtn->setToolTip(tr("Modify this pending order"));
        editBtn->setIcon(Icons::pencil(QColor(c.accent), 14));
        editBtn->setIconSize(QSize(14, 14));
        editBtn->setStyleSheet(QString(
            "QPushButton{background:transparent; border:1px solid %1; border-radius:3px;}"
            "QPushButton:hover{border-color:%2;}")
            .arg(c.btnBorder, c.accent));
        connect(editBtn, &QPushButton::clicked, this,
                [this, ord]() { emit modifyOrder(ord); });

        auto* wrap = new QWidget;
        auto* wl = new QHBoxLayout(wrap);
        wl->setContentsMargins(0, 0, 0, 0);
        wl->setSpacing(3);
        wl->addStretch();
        wl->addWidget(editBtn);
        wl->addWidget(cancelBtn);
        wl->addStretch();
        m_orderTable->setCellWidget(r, 8, wrap);
        ++r;
    }
}

void PositionsPanel::setTransactions(const QVector<Transaction>& txns) {
    m_lastTxns = txns;
    const int kind = m_txnKind ? m_txnKind->currentData().toInt() : KindAll;
    QVector<Transaction> shown;
    for (const Transaction& t : txns) {
        if (!passes(3, t.createdAt)) continue;
        if (kind == KindFunding && !isFunding(t.type)) continue;
        if (kind == KindTrading && isFunding(t.type))  continue;
        shown.append(t);
    }

    const auto& c = Theme::p();
    m_tabs->setTabText(m_tabTxn, tabCaption(tr("Transactions"), shown.size(), txns.size()));

    // Clamp before slicing: the Period filter (or a shorter refresh) can leave
    // the user on a page that no longer exists, and an out-of-range offset
    // would render an empty table with no way back.
    const int size  = txnPageSize();
    const int pages = shown.isEmpty() ? 1 : (shown.size() + size - 1) / size;
    m_txnPage = qBound(0, m_txnPage, pages - 1);
    const int from  = m_txnPage * size;
    const int count = qMin(size, shown.size() - from);

    if (m_txnPageLbl) {
        m_txnPageLbl->setText(shown.isEmpty()
            ? tr(" 0 of 0 ")
            : tr(" %1–%2 of %3 ").arg(from + 1).arg(from + count).arg(shown.size()));
    }
    if (m_txnPrev) m_txnPrev->setEnabled(m_txnPage > 0);
    if (m_txnNext) m_txnNext->setEnabled(m_txnPage < pages - 1);

    m_txnTable->setRowCount(count);
    int r = 0;
    const auto R = Qt::AlignRight | Qt::AlignVCenter;
    for (int i = from; i < from + count; ++i) {
        const Transaction& t = shown.at(i);
        m_txnTable->setItem(r, 0, cell(shortTime(t.createdAt)));
        // "credit_adjustment" -> "credit adjustment": the API's snake_case is a
        // wire format, not something to put in front of a trader.
        m_txnTable->setItem(r, 1, cell(QString(t.type).replace('_', ' ')));
        m_txnTable->setItem(r, 2, cell(QString(t.method).replace('_', ' ')));
        m_txnTable->setItem(r, 3, cell(t.description));

        // Signed and coloured: a ledger's whole point is which way the money
        // went, and +/- reads faster than the type word.
        auto* amt = cell(m_privacy ? QString(MASK)
                                   : QString("%1%2").arg(t.amount >= 0 ? "+" : "").arg(fmt(t.amount)),
                         R);
        if (!m_privacy)
            amt->setForeground(QColor(t.amount >= 0 ? c.up : c.down));
        QFont f = amt->font(); f.setBold(true); amt->setFont(f);
        m_txnTable->setItem(r, 4, amt);

        m_txnTable->setItem(r, 5, cell(t.currency));
        ++r;
    }
    // The ledger is where the summary's deposit and withdrawal figures come
    // from, so it has to be recomputed when the ledger arrives — the History
    // tab is often already rendered by then.
    refreshHistorySummary();
}

void PositionsPanel::setSymbolDigits(const QHash<QString, int>& digits) {
    m_digits = digits;
    applyTheme();   // same path as a theme change: re-render every table
}

void PositionsPanel::setNewsSymbol(const QString& symbol) {
    if (m_news) m_news->setSymbol(symbol);
}

void PositionsPanel::setCalendarSymbol(const QString& symbol) {
    if (m_calendar) m_calendar->setSymbol(symbol);
}

void PositionsPanel::setHistory(const QVector<HistoryTrade>& history) {
    m_lastHistory = history;
    QVector<HistoryTrade> shown;
    for (const HistoryTrade& h : history)
        if (passes(2, h.closedAt)) shown.append(h);   // closed time, not open

    const auto& c = Theme::p();
    m_tabs->setTabText(m_tabHistory, tabCaption(tr("History"), shown.size(), history.size()));
    m_histTable->setRowCount(shown.size());
    int r = 0;
    const auto R = Qt::AlignRight | Qt::AlignVCenter;
    auto cash = [this](double v) {
        return m_privacy ? QString::fromUtf8(MASK) : fmt(v);
    };
    for (const HistoryTrade& h : shown) {
        m_histTable->setItem(r, 0, cell(h.symbol));
        m_histTable->setItem(r, 1, ticketCell(h.id));
        m_histTable->setItem(r, 2, cell(shortTime(h.closedAt)));
        auto* typeItem = cell(typeText(h.side));
        typeItem->setForeground(h.side.compare("sell", Qt::CaseInsensitive) == 0
                                ? QColor(c.down) : QColor(c.up));
        m_histTable->setItem(r, 3, typeItem);
        m_histTable->setItem(r, 4, cell(fmt(h.lots), R));
        const int d = digitsFor(h.symbol);
        m_histTable->setItem(r, 5, cell(fmt(h.openPrice, d), R));
        m_histTable->setItem(r, 6, cell(fmt(h.closePrice, d), R));
        m_histTable->setItem(r, 7, cell(cash(h.swap), R));
        m_histTable->setItem(r, 8, cell(cash(h.commission), R));
        auto* pnl = cell(cash(h.profit), R);
        pnl->setForeground(h.profit >= 0 ? QColor(c.up) : QColor(c.down));
        m_histTable->setItem(r, 9, pnl);
        ++r;
    }
    refreshHistorySummary();
}
