#include "ui/PositionsTable.h"
#include "net/Api.h"

#include <QTableWidget>
#include <QTableWidgetItem>
#include <QHeaderView>
#include <QPushButton>
#include <QLabel>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QDialog>
#include <QFormLayout>
#include <QDoubleSpinBox>
#include <QDialogButtonBox>
#include <QMessageBox>
#include <QColor>

enum PCol { PSymbol = 0, PSide, PLots, POpen, PCur, PSL, PTP, PSwap, PComm, PProfit, PColCount };

PositionsTable::PositionsTable(Api *api, QWidget *parent)
    : QWidget(parent)
    , m_api(api)
{
    m_table = new QTableWidget(0, PColCount);
    m_table->setHorizontalHeaderLabels(
        { tr("Symbol"), tr("Side"), tr("Lots"), tr("Open"), tr("Current"),
          tr("S/L"), tr("T/P"), tr("Swap"), tr("Comm"), tr("Profit") });
    m_table->verticalHeader()->setVisible(false);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);

    auto *closeBtn = new QPushButton(tr("Close position"));
    auto *modifyBtn = new QPushButton(tr("Modify SL/TP…"));
    auto *refreshBtn = new QPushButton(tr("Refresh"));
    m_totalPnl = new QLabel(tr("PnL: —"));
    m_totalPnl->setStyleSheet(QStringLiteral("font-weight:600;"));

    auto *bar = new QHBoxLayout;
    bar->addWidget(closeBtn);
    bar->addWidget(modifyBtn);
    bar->addWidget(refreshBtn);
    bar->addStretch();
    bar->addWidget(m_totalPnl);

    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 0, 0, 0);
    root->addWidget(m_table, 1);
    root->addLayout(bar);

    connect(closeBtn, &QPushButton::clicked, this, &PositionsTable::closeSelected);
    connect(modifyBtn, &QPushButton::clicked, this, &PositionsTable::modifySelected);
    connect(refreshBtn, &QPushButton::clicked, this, &PositionsTable::refreshRequested);
    connect(m_table, &QTableWidget::cellDoubleClicked, this,
            [this](int, int) { modifySelected(); });
}

static QTableWidgetItem *num(double v, int dec, Qt::Alignment align = Qt::AlignRight | Qt::AlignVCenter)
{
    auto *it = new QTableWidgetItem(v != 0.0 ? QString::number(v, 'f', dec)
                                             : QStringLiteral("—"));
    it->setTextAlignment(align);
    return it;
}

void PositionsTable::setPositions(const QList<Position> &positions)
{
    m_positions = positions;
    m_table->setRowCount(positions.size());
    double total = 0.0;

    for (int r = 0; r < positions.size(); ++r) {
        const Position &p = positions.at(r);
        total += p.profit;

        m_table->setItem(r, PSymbol, new QTableWidgetItem(p.symbol));
        auto *side = new QTableWidgetItem(p.side.toUpper());
        side->setForeground(p.isBuy() ? QColor(0x2e, 0xa0, 0x43)
                                      : QColor(0xe5, 0x48, 0x4d));
        m_table->setItem(r, PSide, side);
        m_table->setItem(r, PLots, num(p.lots, 2));
        m_table->setItem(r, POpen, num(p.openPrice, 5));
        m_table->setItem(r, PCur, num(p.currentPrice, 5));
        m_table->setItem(r, PSL, num(p.stopLoss, 5));
        m_table->setItem(r, PTP, num(p.takeProfit, 5));
        m_table->setItem(r, PSwap, num(p.swap, 2));
        m_table->setItem(r, PComm, num(p.commission, 2));

        auto *profit = num(p.profit, 2);
        profit->setForeground(p.profit >= 0 ? QColor(0x2e, 0xa0, 0x43)
                                            : QColor(0xe5, 0x48, 0x4d));
        m_table->setItem(r, PProfit, profit);

        if (p.isReadOnly())
            m_table->item(r, PSymbol)->setToolTip(tr("Read-only (%1)").arg(p.tradeType));
    }

    m_totalPnl->setText(tr("PnL: %1").arg(QString::number(total, 'f', 2)));
    m_totalPnl->setStyleSheet(total >= 0
        ? QStringLiteral("font-weight:600;color:#2ea043;")
        : QStringLiteral("font-weight:600;color:#e5484d;"));
}

Position *PositionsTable::selectedPosition()
{
    const int row = m_table->currentRow();
    if (row < 0 || row >= m_positions.size())
        return nullptr;
    return &m_positions[row];
}

void PositionsTable::closeSelected()
{
    Position *p = selectedPosition();
    if (!p) {
        emit actionResult(false, tr("Select a position to close."));
        return;
    }
    if (p->isReadOnly()) {
        emit actionResult(false, tr("This position is read-only (%1).").arg(p->tradeType));
        return;
    }
    const auto btn = QMessageBox::question(
        this, tr("Close position"),
        tr("Close %1 %2 %3 lots at market?")
            .arg(p->side.toUpper(), p->symbol, QString::number(p->lots)));
    if (btn != QMessageBox::Yes)
        return;

    m_api->closePosition(p->id, std::nullopt, [this](bool ok, const QString &error) {
        emit actionResult(ok, ok ? tr("Position closed.") : error);
        if (ok)
            emit refreshRequested();
    });
}

void PositionsTable::modifySelected()
{
    Position *p = selectedPosition();
    if (!p) {
        emit actionResult(false, tr("Select a position to modify."));
        return;
    }
    if (p->isReadOnly()) {
        emit actionResult(false, tr("This position is read-only (%1).").arg(p->tradeType));
        return;
    }

    QDialog dlg(this);
    dlg.setWindowTitle(tr("Modify %1").arg(p->symbol));
    auto *sl = new QDoubleSpinBox;
    auto *tp = new QDoubleSpinBox;
    for (QDoubleSpinBox *s : { sl, tp }) {
        s->setDecimals(5);
        s->setRange(0.0, 1'000'000.0);
        s->setSpecialValueText(tr("none"));
    }
    sl->setValue(p->stopLoss);
    tp->setValue(p->takeProfit);

    auto *form = new QFormLayout;
    form->addRow(tr("Stop loss"), sl);
    form->addRow(tr("Take profit"), tp);
    auto *box = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel);
    QObject::connect(box, &QDialogButtonBox::accepted, &dlg, &QDialog::accept);
    QObject::connect(box, &QDialogButtonBox::rejected, &dlg, &QDialog::reject);
    auto *lay = new QVBoxLayout(&dlg);
    lay->addLayout(form);
    lay->addWidget(box);

    if (dlg.exec() != QDialog::Accepted)
        return;

    std::optional<double> slOpt = sl->value() > 0.0 ? std::optional<double>(sl->value()) : std::nullopt;
    std::optional<double> tpOpt = tp->value() > 0.0 ? std::optional<double>(tp->value()) : std::nullopt;

    m_api->modifyPosition(p->id, slOpt, tpOpt, [this](bool ok, const QString &error) {
        emit actionResult(ok, ok ? tr("Position modified.") : error);
        if (ok)
            emit refreshRequested();
    });
}
