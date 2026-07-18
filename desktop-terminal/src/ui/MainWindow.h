#pragma once

#include <QMainWindow>
#include <QList>

#include "models/Account.h"
#include "models/AccountSummary.h"
#include "models/Tick.h"

class Session;
class Api;
class PriceSocket;
class TradeSocket;
class MarketWatch;
class OrderPanel;
class PositionsTable;
class OrdersTable;
class ChartView;
class QComboBox;
class QLabel;
class QTimer;

// Application shell: docks the Market Watch, order ticket, positions and orders
// around a central chart area, and keeps them fed from the price + trade
// sockets plus a periodic account refresh.
class MainWindow : public QMainWindow
{
    Q_OBJECT
public:
    MainWindow(Api *api, Session *session, QWidget *parent = nullptr);

private slots:
    void onAccountSelected(int index);
    void reloadAccounts();
    void reloadInstruments();
    void refreshAccountData();
    void onPriceConnectionChanged(bool connected);

private:
    void buildDocks();
    void buildSummaryBar();
    void updateSummary(const AccountSummary &summary);
    void flash(const QString &message);

    Api *m_api;
    Session *m_session;
    PriceSocket *m_priceSocket = nullptr;
    TradeSocket *m_tradeSocket = nullptr;
    QTimer *m_pollTimer = nullptr;

    MarketWatch *m_marketWatch = nullptr;
    OrderPanel *m_orderPanel = nullptr;
    PositionsTable *m_positionsTable = nullptr;
    OrdersTable *m_ordersTable = nullptr;
    ChartView *m_chart = nullptr;

    QComboBox *m_accountBox = nullptr;
    QLabel *m_balance = nullptr;
    QLabel *m_equity = nullptr;
    QLabel *m_margin = nullptr;
    QLabel *m_freeMargin = nullptr;
    QLabel *m_marginLevel = nullptr;
    QLabel *m_pnl = nullptr;
    QLabel *m_leverage = nullptr;
    QLabel *m_connState = nullptr;

    QList<Account> m_accounts;
    QString m_currency = QStringLiteral("USD");
    int m_leverageVal = 0;
};
