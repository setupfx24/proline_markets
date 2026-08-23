#include "ui/WalletDialog.h"
#include "core/ApiError.h"
#include "ui/Theme.h"
#include "ui/SpinInput.h"
#include "ui/Toast.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QFormLayout>
#include <QLabel>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrl>

WalletDialog::WalletDialog(const Config& cfg, QWidget* parent)
    : QDialog(parent), m_cfg(cfg), m_net(new QNetworkAccessManager(this)) {
    setWindowTitle(tr("Wallet — transfer funds"));
    setModal(true);
    setMinimumWidth(460);

    const auto& c = Theme::p();
    auto* title = new QLabel(tr("<b>Main Wallet</b>"));
    title->setStyleSheet(QString("font-size:15px; color:%1;").arg(c.textStrong));
    m_balance = new QLabel(tr("Loading…"));
    m_balance->setStyleSheet(QString("font-size:22px; font-weight:800; color:%1;").arg(c.up));

    m_direction = new QComboBox;
    m_direction->addItem(tr("Main wallet  →  trading account"), false);
    m_direction->addItem(tr("Trading account  →  main wallet"), true);
    // A user-driven change of direction/account invalidates whatever the status
    // line says, including the result of the previous transfer.
    connect(m_direction, &QComboBox::currentIndexChanged, this, [this]() {
        m_statusSticky = false;
        onDirectionChanged();
    });

    m_account = new QComboBox;
    connect(m_account, &QComboBox::currentIndexChanged, this, [this]() {
        m_statusSticky = false;
        onAccountChanged();
    });

    m_amount = new QDoubleSpinBox;
    m_amount->setRange(0.01, 1000000.0);
    m_amount->setDecimals(2);
    m_amount->setValue(100.0);
    m_amount->setPrefix("$ ");
    // Same helper as every other numeric field: it opens pre-filled with 100.00
    // and has to be replaceable by clicking and typing.
    SpinInput::freeTyping({m_amount});

    m_maxBtn = new QPushButton(tr("Max"));
    m_maxBtn->setFixedWidth(52);
    m_maxBtn->setCursor(Qt::PointingHandCursor);
    m_maxBtn->setToolTip(tr("Use the whole transferable amount"));
    connect(m_maxBtn, &QPushButton::clicked, this, [this]() {
        const double max = toWallet() ? availableOnAccount() : m_walletBalance;
        if (max >= 0.01) m_amount->setValue(max);
    });

    auto* amountRow = new QWidget;
    auto* ar = new QHBoxLayout(amountRow);
    ar->setContentsMargins(0, 0, 0, 0);
    ar->addWidget(m_amount, 1);
    ar->addWidget(m_maxBtn);

    auto* form = new QFormLayout;
    form->addRow(tr("Direction"), m_direction);
    form->addRow(tr("Account"),   m_account);
    form->addRow(tr("Amount"),    amountRow);

    m_hint = new QLabel;
    m_hint->setWordWrap(true);
    m_hint->setStyleSheet(QString("color:%1; font-size:11px;").arg(c.muted));

    m_transferBtn = new QPushButton(tr("Transfer"));
    m_transferBtn->setMinimumHeight(40);
    m_transferBtn->setStyleSheet(QString(
        "QPushButton{background:%1;color:white;font-weight:700;border:none;border-radius:8px;}"
        "QPushButton:hover{background:%2;}"
        "QPushButton:disabled{background:%3;color:%4;}")
        .arg(c.accentHover, c.accent, c.btnBg, c.dim));
    connect(m_transferBtn, &QPushButton::clicked, this, &WalletDialog::doTransfer);

    m_status = new QLabel;
    m_status->setWordWrap(true);

    auto* close = new QPushButton(tr("Close"));
    connect(close, &QPushButton::clicked, this, &QDialog::accept);

    auto* lay = new QVBoxLayout(this);
    lay->addWidget(title);
    lay->addWidget(m_balance);
    lay->addSpacing(8);
    lay->addLayout(form);
    lay->addWidget(m_hint);
    lay->addSpacing(6);
    lay->addWidget(m_transferBtn);
    lay->addWidget(m_status);
    lay->addStretch();
    lay->addWidget(close);

    if (m_cfg.token.trimmed().isEmpty()) {
        // The wallet lives on /api/v1 and authenticates the platform user. A
        // session signed in with a pasted API key has no JWT and never can.
        m_balance->setText(tr("Sign in required"));
        m_balance->setStyleSheet(QString("font-size:16px; color:%1;").arg(c.warn));
        setStatus(tr("Transfers need an email/password sign-in. This session is "
                     "authenticated with an API key, which can trade but cannot "
                     "move money."), true);
        m_direction->setEnabled(false);
        m_account->setEnabled(false);
        m_amount->setEnabled(false);
        m_maxBtn->setEnabled(false);
        m_transferBtn->setEnabled(false);
    } else {
        loadWallet();
    }
    onDirectionChanged();
}

QString WalletDialog::v1Base() const {
    QString base = m_cfg.restBase;
    base.replace("/api/algo", "/api/v1");
    return base;
}

bool WalletDialog::toWallet() const { return m_direction->currentData().toBool(); }

void WalletDialog::setStatus(const QString& text, bool error, bool sticky) {
    m_status->setStyleSheet(QString("color:%1;").arg(error ? Theme::p().down : Theme::p().up));
    m_status->setText(text);
    m_statusSticky = sticky;
}

QString WalletDialog::accountLabel() const {
    // Items read "PT36420423 · $31,793.93" — the trader knows the number.
    return m_account->currentText().section(QChar(0x00B7), 0, 0).trimmed();
}

double WalletDialog::availableOnAccount() const {
    const QString id = m_account->currentData().toString();
    return m_funds.value(id).free;
}

static QNetworkRequest bearerReq(const QString& url, const Config& cfg) {
    QNetworkRequest req{QUrl(url)};
    req.setRawHeader("Authorization", ("Bearer " + cfg.token).toUtf8());
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    return req;
}

void WalletDialog::loadWallet() {
    QNetworkReply* r = m_net->get(bearerReq(v1Base() + "/wallet/summary", m_cfg));
    connect(r, &QNetworkReply::finished, this, [this, r]() {
        r->deleteLater();
        const int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
        if (r->error() != QNetworkReply::NoError || http >= 400) {
            setStatus(tr("Couldn't load wallet: %1")
                      .arg(apiDetail(o, r->errorString())), true);
            return;
        }

        m_walletBalance = o.value("main_wallet_balance").toDouble();
        m_balance->setText(QString("$ %L1").arg(m_walletBalance, 0, 'f', 2));
        m_balance->setStyleSheet(QString("font-size:22px; font-weight:800; color:%1;")
                                 .arg(Theme::p().up));

        const QString keep = m_account->currentData().toString();
        m_funds.clear();
        m_account->clear();
        // Only live accounts come back here — the backend refuses wallet
        // transfers on demo accounts, so a demo account must not be offered.
        for (const QJsonValue& v : o.value("live_accounts").toArray()) {
            const QJsonObject a = v.toObject();
            const QString id = a.value("id").toString();
            AccountFunds f;
            f.balance    = a.value("balance").toDouble();
            f.marginUsed = a.value("margin_used").toDouble();
            f.free       = a.value("free_margin").toDouble();
            m_funds.insert(id, f);
            m_account->addItem(QString("%1 · $%L2")
                .arg(a.value("account_number").toString())
                .arg(f.balance, 0, 'f', 2), id);
        }

        if (m_account->count() == 0) {
            setStatus(tr("No live trading account on this profile. Wallet transfers "
                         "are not available for demo accounts."), true);
            m_transferBtn->setEnabled(false);
            return;
        }
        // Prefer the account the terminal is trading, then whatever was picked
        // before the refresh.
        int idx = m_account->findData(m_cfg.accountId);
        if (idx < 0) idx = m_account->findData(keep);
        m_account->setCurrentIndex(idx >= 0 ? idx : 0);
        onDirectionChanged();
    });
}

void WalletDialog::onDirectionChanged() {
    const bool out = toWallet();
    const double max = out ? availableOnAccount() : m_walletBalance;

    if (out) {
        const QString id = m_account->currentData().toString();
        const AccountFunds f = m_funds.value(id);
        m_hint->setText(tr(
            "Transferable: <b>$%L1</b> — the account balance ($%L2) minus $%L3 "
            "locked as margin on open trades.<br>"
            "Floating P/L on open positions is not included: it only becomes "
            "transferable once those positions are closed.")
            .arg(f.free, 0, 'f', 2).arg(f.balance, 0, 'f', 2).arg(f.marginUsed, 0, 'f', 2));
    } else {
        m_hint->setText(tr("Available in the main wallet: <b>$%L1</b>.")
                        .arg(m_walletBalance, 0, 'f', 2));
    }

    // Cap the spin box at what can actually move, so the server never has to
    // reject the amount. Below the 0.01 minimum there is nothing to send.
    const bool any = max >= 0.01;
    m_amount->setMaximum(any ? max : 0.01);
    if (m_amount->value() > m_amount->maximum()) m_amount->setValue(m_amount->maximum());
    m_amount->setEnabled(any);
    m_maxBtn->setEnabled(any);
    m_transferBtn->setEnabled(any && m_account->count() > 0);
    if (m_statusSticky) return;   // a transfer result outranks a capacity hint
    if (!any && !m_cfg.token.trimmed().isEmpty())
        setStatus(out ? tr("Nothing transferable on this account right now.")
                      : tr("The main wallet is empty."), false);
    else
        m_status->clear();          // otherwise the previous hint goes stale
}

void WalletDialog::onAccountChanged() { onDirectionChanged(); }

void WalletDialog::doTransfer() {
    if (m_account->currentIndex() < 0) {
        setStatus(tr("Select a trading account."), true);
        return;
    }
    const bool out = toWallet();
    const double amount = m_amount->value();

    m_transferBtn->setEnabled(false);
    m_transferBtn->setText(tr("Transferring…"));
    m_status->clear();

    QJsonObject body;
    body[out ? "from_account_id" : "to_account_id"] = m_account->currentData().toString();
    body["amount"] = amount;
    const QString path = out ? "/wallet/transfer-trading-to-main"
                             : "/wallet/transfer-main-to-trading";

    // The account label is captured now: loadWallet() below rebuilds the combo
    // with fresh balances, so reading it afterwards would give the wrong text.
    const QString account = accountLabel();

    QNetworkReply* r = m_net->post(bearerReq(v1Base() + path, m_cfg),
                                   QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(r, &QNetworkReply::finished, this, [this, r, out, amount, account]() {
        r->deleteLater();
        m_transferBtn->setEnabled(true);
        m_transferBtn->setText(tr("Transfer"));
        const int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(r->readAll()).object();
        const QString money = QString("$%L1").arg(amount, 0, 'f', 2);

        if (r->error() != QNetworkReply::NoError || http >= 400) {
            const QString why = apiDetail(o, r->errorString());
            setStatus(tr("Transfer failed: %1").arg(why), true, true);
            Toast::error(this, tr("Transfer failed"), why);
            return;
        }

        const QString line = out
            ? tr("%1 moved from %2 to your main wallet").arg(money, account)
            : tr("%1 moved from your main wallet to %2").arg(money, account);
        setStatus(tr("✓ %1").arg(line), false, true);
        Toast::success(this, tr("Transfer complete"), line);

        emit transferred(out, amount, account);
        loadWallet();   // balances on both sides have moved
    });
}
