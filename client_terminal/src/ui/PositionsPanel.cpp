#include "ui/PositionsPanel.h"
#include <QTabWidget>
#include <QTableWidget>
#include <QHeaderView>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QLabel>
#include <QFont>
#include <QColor>

static QTableWidget* makeTable(const QStringList& headers) {
    auto* t = new QTableWidget;
    t->setColumnCount(headers.size());
    t->setHorizontalHeaderLabels(headers);
    t->verticalHeader()->setVisible(false);
    t->verticalHeader()->setDefaultSectionSize(34);
    t->setEditTriggers(QAbstractItemView::NoEditTriggers);
    t->setSelectionBehavior(QAbstractItemView::SelectRows);
    t->setShowGrid(false);
    t->setAlternatingRowColors(true);
    t->horizontalHeader()->setStretchLastSection(true);
    t->horizontalHeader()->setSectionResizeMode(0, QHeaderView::ResizeToContents);
    return t;
}

static QTableWidgetItem* cell(const QString& text, Qt::Alignment a = Qt::AlignLeft | Qt::AlignVCenter) {
    auto* it = new QTableWidgetItem(text);
    it->setTextAlignment(a);
    return it;
}

static QString fmt(double v, int d = 2) { return QString::number(v, 'f', d); }
static QString shortTime(const QString& iso) {
    // "2026-07-17T18:35:00+00:00" -> "07-17 18:35"
    if (iso.size() < 16) return iso;
    return iso.mid(5, 5) + " " + iso.mid(11, 5);
}

PositionsPanel::PositionsPanel(QWidget* parent) : QWidget(parent) {
    m_tabs = new QTabWidget;

    m_posTable = makeTable({tr("Symbol"), tr("Side"), tr("Lots"), tr("Open"), tr("Current"),
                            tr("S/L"), tr("T/P"), tr("Swap"), tr("P/L"), tr("")});
    m_orderTable = makeTable({tr("Symbol"), tr("Type"), tr("Side"), tr("Lots"), tr("Price"),
                              tr("S/L"), tr("T/P"), tr("Placed")});
    m_histTable = makeTable({tr("Symbol"), tr("Side"), tr("Lots"), tr("Open"), tr("Close"),
                             tr("Swap"), tr("Comm."), tr("P/L"), tr("Closed")});

    m_tabs->addTab(m_posTable,   tr("Open Positions"));
    m_tabs->addTab(m_orderTable, tr("Pending"));
    m_tabs->addTab(m_histTable,  tr("History"));


    auto* lay = new QVBoxLayout(this);
    lay->setContentsMargins(0, 0, 0, 0);
    lay->addWidget(m_tabs);

    // Sized by the central splitter; tables scroll internally when rows overflow.
}

void PositionsPanel::setCollapsed(bool collapsed) {
    m_collapsed = collapsed;
    // Hide the tab area → the splitter reclaims the space for the chart above.
    m_tabs->setVisible(!collapsed);
}

void PositionsPanel::setPositions(const QVector<OpenPosition>& positions) {
    m_tabs->setTabText(0, tr("Open Positions (%1)").arg(positions.size()));
    m_posTable->setRowCount(positions.size());
    int r = 0;
    const auto R = Qt::AlignRight | Qt::AlignVCenter;
    for (const OpenPosition& p : positions) {
        m_posTable->setItem(r, 0, cell(p.symbol));
        auto* sideItem = cell(p.side);
        sideItem->setForeground(p.side == "BUY" ? QColor("#26a269") : QColor("#e01b24"));
        m_posTable->setItem(r, 1, sideItem);
        m_posTable->setItem(r, 2, cell(fmt(p.lots), R));
        m_posTable->setItem(r, 3, cell(fmt(p.openPrice, 5), R));
        m_posTable->setItem(r, 4, cell(p.currentPrice > 0 ? fmt(p.currentPrice, 5) : "—", R));
        m_posTable->setItem(r, 5, cell(p.sl > 0 ? fmt(p.sl, 5) : "—", R));
        m_posTable->setItem(r, 6, cell(p.tp > 0 ? fmt(p.tp, 5) : "—", R));
        m_posTable->setItem(r, 7, cell(fmt(p.swap), R));
        auto* pnl = cell(fmt(p.profit), R);
        pnl->setForeground(p.profit >= 0 ? QColor("#26a269") : QColor("#e01b24"));
        QFont bf = pnl->font(); bf.setBold(true); pnl->setFont(bf);
        m_posTable->setItem(r, 8, pnl);

        auto* closeBtn = new QPushButton(tr("Close"));
        closeBtn->setStyleSheet("QPushButton{background:#e01b24;color:white;border:none;border-radius:4px;padding:3px 10px;font-size:11px;font-weight:600;}"
                                "QPushButton:hover{background:#f04148;}");
        const QString sym = p.symbol;
        connect(closeBtn, &QPushButton::clicked, this, [this, sym]() { emit closeSymbol(sym); });
        m_posTable->setCellWidget(r, 9, closeBtn);
        ++r;
    }
}

void PositionsPanel::setOrders(const QVector<PendingOrder>& orders) {
    m_tabs->setTabText(1, tr("Pending (%1)").arg(orders.size()));
    m_orderTable->setRowCount(orders.size());
    int r = 0;
    const auto R = Qt::AlignRight | Qt::AlignVCenter;
    for (const PendingOrder& o : orders) {
        m_orderTable->setItem(r, 0, cell(o.symbol));
        m_orderTable->setItem(r, 1, cell(o.type));
        auto* sideItem = cell(o.side);
        sideItem->setForeground(o.side == "BUY" ? QColor("#26a269") : QColor("#e01b24"));
        m_orderTable->setItem(r, 2, sideItem);
        m_orderTable->setItem(r, 3, cell(fmt(o.lots), R));
        m_orderTable->setItem(r, 4, cell(o.price > 0 ? fmt(o.price, 5) : "—", R));
        m_orderTable->setItem(r, 5, cell(o.sl > 0 ? fmt(o.sl, 5) : "—", R));
        m_orderTable->setItem(r, 6, cell(o.tp > 0 ? fmt(o.tp, 5) : "—", R));
        m_orderTable->setItem(r, 7, cell(shortTime(o.createdAt), R));
        ++r;
    }
}

void PositionsPanel::setHistory(const QVector<HistoryTrade>& history) {
    m_tabs->setTabText(2, tr("History (%1)").arg(history.size()));
    m_histTable->setRowCount(history.size());
    int r = 0;
    const auto R = Qt::AlignRight | Qt::AlignVCenter;
    for (const HistoryTrade& h : history) {
        m_histTable->setItem(r, 0, cell(h.symbol));
        auto* sideItem = cell(h.side);
        sideItem->setForeground(h.side == "BUY" ? QColor("#26a269") : QColor("#e01b24"));
        m_histTable->setItem(r, 1, sideItem);
        m_histTable->setItem(r, 2, cell(fmt(h.lots), R));
        m_histTable->setItem(r, 3, cell(fmt(h.openPrice, 5), R));
        m_histTable->setItem(r, 4, cell(fmt(h.closePrice, 5), R));
        m_histTable->setItem(r, 5, cell(fmt(h.swap), R));
        m_histTable->setItem(r, 6, cell(fmt(h.commission), R));
        auto* pnl = cell(fmt(h.profit), R);
        pnl->setForeground(h.profit >= 0 ? QColor("#26a269") : QColor("#e01b24"));
        m_histTable->setItem(r, 7, pnl);
        m_histTable->setItem(r, 8, cell(shortTime(h.closedAt), R));
        ++r;
    }
}
