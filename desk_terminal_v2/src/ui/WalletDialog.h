#pragma once
#include <QDialog>
#include <QHash>
#include "core/Config.h"

class QLabel;
class QComboBox;
class QDoubleSpinBox;
class QPushButton;
class QNetworkAccessManager;

// Moves money between the main wallet and a live trading account, both ways:
//
//   Wallet  -> account   fund a trading account   (/wallet/transfer-main-to-trading)
//   Account -> wallet    take realised profit out (/wallet/transfer-trading-to-main)
//
// The second direction is what "withdraw my profit" means here. It moves
// AVAILABLE balance, which the backend defines as balance - margin_used.
// Floating P/L on open positions is NOT part of that and cannot be moved: it is
// not money yet. The dialog says so rather than letting the server reject the
// transfer with a number the trader cannot reconcile.
//
// Everything here is on /api/v1 with the session JWT — the algo key cannot
// reach the wallet. An earlier version posted to /api/algo/terminal/transfer,
// which is not a route this gateway serves, so every transfer 404'd.
class WalletDialog : public QDialog {
    Q_OBJECT
public:
    explicit WalletDialog(const Config& cfg, QWidget* parent = nullptr);

signals:
    // MainWindow refreshes the account after a transfer and echoes the result
    // in the status bar, so the confirmation outlives this dialog.
    void transferred(bool toWallet, double amount, const QString& accountLabel);

private slots:
    void loadWallet();
    void doTransfer();
    void onDirectionChanged();
    void onAccountChanged();

private:
    QString v1Base() const;          // restBase with /api/algo -> /api/v1
    bool    toWallet() const;        // true = account -> wallet
    // sticky=true marks a transfer result, which survives the balance reload
    // that follows it. Capacity hints ("wallet is empty") are not sticky and
    // are cleared as soon as the selection changes.
    void    setStatus(const QString& text, bool error, bool sticky = false);
    QString accountLabel() const;    // account number of the current selection
    double  availableOnAccount() const;   // transferable amount for the selection

    Config m_cfg;
    QNetworkAccessManager* m_net;
    QLabel*         m_balance;
    QLabel*         m_hint;          // what the selected direction can move
    QComboBox*      m_direction;
    QComboBox*      m_account;
    QDoubleSpinBox* m_amount;
    QPushButton*    m_maxBtn;
    QPushButton*    m_transferBtn;
    QLabel*         m_status;

    double m_walletBalance = 0.0;
    // Per live account: balance, and free = balance - margin_used (transferable).
    struct AccountFunds { double balance = 0.0; double free = 0.0; double marginUsed = 0.0; };
    QHash<QString, AccountFunds> m_funds;
    bool m_statusSticky = false;
};
