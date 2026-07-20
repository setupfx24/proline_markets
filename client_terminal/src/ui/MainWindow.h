#pragma once
#include <QMainWindow>
#include <QHash>
#include "core/Config.h"
#include "core/Models.h"

class ApiClient;
class PriceStream;
class WatchlistWidget;
class WebChartWidget;
class OrderTicket;
class AccountPanel;
class PositionsPanel;
class QLabel;
class QTimer;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(const Config& cfg, QWidget* parent = nullptr);

private slots:
    void onSymbolsReceived(const QVector<SymbolSpec>& symbols);
    void onSymbolActivated(const QString& symbol);
    void onTradeResult(const TradeResult& r);
    void onApiError(const QString& context, const QString& message);
    void openSettings();

private:
    void connectServices();
    void setStatus(const QString& text, bool error = false);

    Config       m_cfg;
    ApiClient*   m_api;
    PriceStream* m_stream;

    WatchlistWidget* m_watch;
    WebChartWidget*  m_chart;
    OrderTicket*     m_ticket;
    AccountPanel*    m_account;
    PositionsPanel*  m_positions;

    QLabel* m_streamStatus;
    QLabel* m_message;
    QTimer* m_accountTimer;

    // Header bar chips
    QLabel* m_hdrAccount;
    QLabel* m_hdrBalance;
    QLabel* m_hdrEquity;
    QLabel* m_hdrConn;
    class QComboBox* m_accountSwitch = nullptr;
    QWidget* buildHeader();
    void switchAccount(const QString& accountId);

    QHash<QString, SymbolSpec> m_specs;
    QString m_currentSymbol;
};
