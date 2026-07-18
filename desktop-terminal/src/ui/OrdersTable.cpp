#include "ui/OrdersTable.h"
#include "net/Api.h"

#include <QTableWidget>
#include <QTableWidgetItem>
#include <QHeaderView>
#include <QPushButton>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QMessageBox>
#include <QColor>

enum OCol { OSymbol = 0, OType, OSide, OLots, OPrice, OSL, OTP, OColCount };

OrdersTable::OrdersTable(Api *api, QWidget *parent)
    : QWidget(parent)
    , m_api(api)
{
    m_table = new QTableWidget(0, OColCount);
    m_table->setHorizontalHeaderLabels(
        { tr("Symbol"), tr("Type"), tr("Side"), tr("Lots"),
          tr("Price"), tr("S/L"), tr("T/P") });
    m_table->verticalHeader()->setVisible(false);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);

    auto *cancelBtn = new QPushButton(tr("Cancel order"));
    auto *refreshBtn = new QPushButton(tr("Refresh"));
    auto *bar = new QHBoxLayout;
    bar->addWidget(cancelBtn);
    bar->addWidget(refreshBtn);
    bar->addStretch();

    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 0, 0, 0);
    root->addWidget(m_table, 1);
    root->addLayout(bar);

    connect(cancelBtn, &QPushButton::clicked, this, &OrdersTable::cancelSelected);
    connect(refreshBtn, &QPushButton::clicked, this, &OrdersTable::refreshRequested);
}

void OrdersTable::setOrders(const QList<Order> &orders)
{
    m_orders = orders;
    m_table->setRowCount(orders.size());
    for (int r = 0; r < orders.size(); ++r) {
        const Order &o = orders.at(r);
        m_table->setItem(r, OSymbol, new QTableWidgetItem(o.symbol));
        m_table->setItem(r, OType, new QTableWidgetItem(o.orderType));
        auto *side = new QTableWidgetItem(o.side.toUpper());
        side->setForeground(o.isBuy() ? QColor(0x2e, 0xa0, 0x43)
                                      : QColor(0xe5, 0x48, 0x4d));
        m_table->setItem(r, OSide, side);
        auto rnum = [](double v, int dec) {
            auto *it = new QTableWidgetItem(v != 0.0 ? QString::number(v, 'f', dec)
                                                     : QStringLiteral("—"));
            it->setTextAlignment(Qt::AlignRight | Qt::AlignVCenter);
            return it;
        };
        m_table->setItem(r, OLots, rnum(o.lots, 2));
        m_table->setItem(r, OPrice, rnum(o.price, 5));
        m_table->setItem(r, OSL, rnum(o.stopLoss, 5));
        m_table->setItem(r, OTP, rnum(o.takeProfit, 5));
    }
}

void OrdersTable::cancelSelected()
{
    const int row = m_table->currentRow();
    if (row < 0 || row >= m_orders.size()) {
        emit actionResult(false, tr("Select a pending order to cancel."));
        return;
    }
    const Order o = m_orders.at(row);
    const auto btn = QMessageBox::question(
        this, tr("Cancel order"),
        tr("Cancel the pending %1 %2 on %3?")
            .arg(o.orderType, o.side.toUpper(), o.symbol));
    if (btn != QMessageBox::Yes)
        return;

    m_api->cancelOrder(o.id, [this](bool ok, const QString &error) {
        emit actionResult(ok, ok ? tr("Order cancelled.") : error);
        if (ok)
            emit refreshRequested();
    });
}
