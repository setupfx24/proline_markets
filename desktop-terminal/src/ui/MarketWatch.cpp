#include "ui/MarketWatch.h"

#include <QTableWidget>
#include <QTableWidgetItem>
#include <QHeaderView>
#include <QLineEdit>
#include <QVBoxLayout>
#include <QLabel>
#include <QColor>
#include <cmath>

enum Col { ColSymbol = 0, ColBid, ColAsk, ColSpread, ColCount };

MarketWatch::MarketWatch(QWidget *parent)
    : QWidget(parent)
{
    m_filter = new QLineEdit;
    m_filter->setPlaceholderText(tr("Filter symbols…"));
    m_filter->setClearButtonEnabled(true);

    m_table = new QTableWidget(0, ColCount);
    m_table->setHorizontalHeaderLabels(
        { tr("Symbol"), tr("Bid"), tr("Ask"), tr("Spread") });
    m_table->verticalHeader()->setVisible(false);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->setAlternatingRowColors(true);
    m_table->horizontalHeader()->setSectionResizeMode(ColSymbol, QHeaderView::Stretch);
    m_table->horizontalHeader()->setSectionResizeMode(ColBid, QHeaderView::ResizeToContents);
    m_table->horizontalHeader()->setSectionResizeMode(ColAsk, QHeaderView::ResizeToContents);
    m_table->horizontalHeader()->setSectionResizeMode(ColSpread, QHeaderView::ResizeToContents);

    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 0, 0, 0);
    root->setSpacing(4);
    auto *header = new QLabel(tr("Market Watch"));
    header->setStyleSheet(QStringLiteral("font-weight:600;padding:4px 6px;"));
    root->addWidget(header);
    root->addWidget(m_filter);
    root->addWidget(m_table, 1);

    connect(m_filter, &QLineEdit::textChanged, this, &MarketWatch::applyFilter);
    connect(m_table, &QTableWidget::itemSelectionChanged,
            this, &MarketWatch::emitCurrentSymbol);
}

void MarketWatch::setInstruments(const QList<Instrument> &instruments)
{
    m_table->setRowCount(0);
    m_rowBySymbol.clear();
    m_instruments.clear();

    m_table->setRowCount(instruments.size());
    int row = 0;
    for (const Instrument &inst : instruments) {
        m_instruments.insert(inst.symbol, inst);
        m_rowBySymbol.insert(inst.symbol, row);

        auto *sym = new QTableWidgetItem(inst.symbol);
        sym->setToolTip(inst.displayName);
        m_table->setItem(row, ColSymbol, sym);
        for (int c = ColBid; c < ColCount; ++c) {
            auto *it = new QTableWidgetItem(QStringLiteral("—"));
            it->setTextAlignment(Qt::AlignRight | Qt::AlignVCenter);
            m_table->setItem(row, c, it);
        }
        ++row;
    }
}

int MarketWatch::rowFor(const QString &symbol) const
{
    return m_rowBySymbol.value(symbol, -1);
}

void MarketWatch::setPriceCell(int row, int col, double value, int digits, double prev)
{
    QTableWidgetItem *it = m_table->item(row, col);
    if (!it)
        return;
    it->setText(QString::number(value, 'f', digits));
    if (prev > 0.0 && value != prev) {
        it->setForeground(value > prev ? QColor(0x2e, 0xa0, 0x43)   // up green
                                       : QColor(0xe5, 0x48, 0x4d)); // down red
    }
}

void MarketWatch::onTick(const Tick &t)
{
    int row = rowFor(t.symbol);
    if (row < 0) {
        // Instrument not in the list (e.g. feed has extra symbols) — append it.
        row = m_table->rowCount();
        m_table->insertRow(row);
        m_rowBySymbol.insert(t.symbol, row);
        auto *sym = new QTableWidgetItem(t.symbol);
        m_table->setItem(row, ColSymbol, sym);
        for (int c = ColBid; c < ColCount; ++c) {
            auto *cell = new QTableWidgetItem(QStringLiteral("—"));
            cell->setTextAlignment(Qt::AlignRight | Qt::AlignVCenter);
            m_table->setItem(row, c, cell);
        }
    }

    const Instrument inst = m_instruments.value(t.symbol);
    const int digits = m_instruments.contains(t.symbol) ? inst.digits : 5;

    setPriceCell(row, ColBid, t.bid, digits, m_lastBid.value(t.symbol, 0.0));
    setPriceCell(row, ColAsk, t.ask, digits, m_lastAsk.value(t.symbol, 0.0));
    m_lastBid.insert(t.symbol, t.bid);
    m_lastAsk.insert(t.symbol, t.ask);

    // Spread in points (server also sends a spread field; prefer computed).
    if (auto *sp = m_table->item(row, ColSpread)) {
        const double pointSize = m_instruments.contains(t.symbol)
                                     ? inst.pointSize()
                                     : std::pow(10.0, -digits);
        const int points = pointSize > 0.0
                               ? int(std::llround((t.ask - t.bid) / pointSize))
                               : 0;
        sp->setText(QString::number(points));
    }
}

void MarketWatch::applyFilter(const QString &text)
{
    const QString needle = text.trimmed();
    for (int r = 0; r < m_table->rowCount(); ++r) {
        auto *sym = m_table->item(r, ColSymbol);
        const bool show = needle.isEmpty() ||
            (sym && sym->text().contains(needle, Qt::CaseInsensitive));
        m_table->setRowHidden(r, !show);
    }
}

void MarketWatch::emitCurrentSymbol()
{
    const int row = m_table->currentRow();
    if (row < 0)
        return;
    if (auto *sym = m_table->item(row, ColSymbol))
        emit symbolSelected(sym->text());
}
