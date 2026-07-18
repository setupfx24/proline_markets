#pragma once

#include <QWidget>
#include <QList>

#include "models/Order.h"

class Api;
class QTableWidget;

// Pending-orders grid with cancel. Refreshed wholesale via setOrders().
class OrdersTable : public QWidget
{
    Q_OBJECT
public:
    explicit OrdersTable(Api *api, QWidget *parent = nullptr);

    void setOrders(const QList<Order> &orders);

signals:
    void refreshRequested();
    void actionResult(bool ok, const QString &message);

private slots:
    void cancelSelected();

private:
    Api *m_api;
    QTableWidget *m_table = nullptr;
    QList<Order> m_orders;
};
