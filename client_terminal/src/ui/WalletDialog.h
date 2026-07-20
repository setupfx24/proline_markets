#pragma once
#include <QDialog>
#include "core/Config.h"

class QLabel;
class QComboBox;
class QDoubleSpinBox;
class QPushButton;
class QNetworkAccessManager;

// Main wallet → trading account transfer (like the website's fund flow).
class WalletDialog : public QDialog {
    Q_OBJECT
public:
    explicit WalletDialog(const Config& cfg, QWidget* parent = nullptr);

signals:
    void transferred();   // MainWindow refreshes the account after a transfer

private slots:
    void loadWallet();
    void doTransfer();

private:
    Config m_cfg;
    QNetworkAccessManager* m_net;
    QLabel*         m_balance;
    QComboBox*      m_account;
    QDoubleSpinBox* m_amount;
    QPushButton*    m_transferBtn;
    QLabel*         m_status;
};
