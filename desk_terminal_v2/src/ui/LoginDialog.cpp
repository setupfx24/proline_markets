#include "ui/LoginDialog.h"
#include "core/ApiError.h"
#include "ui/Theme.h"
#include "ui/Icons.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLineEdit>
#include <QComboBox>
#include <QPushButton>
#include <QLabel>
#include <QFrame>
#include <QGraphicsDropShadowEffect>
#include <QIcon>
#include <QPixmap>
#include <QMouseEvent>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkCookie>
#include <QNetworkRequest>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrl>

// The dialog carries its own style sheet so the global terminal theme (which
// styles every QLineEdit/QPushButton flat) doesn't flatten the sign-in card.
// Colours come from the active Theme palette so the card follows light/dark.
static QString sheet() {
    const auto& c = Theme::p();
    const QString cardBg   = Theme::isDark() ? "#14171d" : "#ffffff";
    const QString inputBg  = Theme::isDark() ? "#0f1216" : "#f7f9fc";
    const QString inputFoc = Theme::isDark() ? "#111722" : "#ffffff";
    return QString(R"QSS(
#card {
    background: %CARDBG%;
    border: 1px solid %BORDER%;
    border-radius: 16px;
}
/* The global terminal theme paints every QWidget (QLabel included) with an
   opaque #0e0f13. Inside the card that would stamp dark rectangles over the
   brand gradient and square off the card's rounded corners, so every plain
   container here is explicitly transparent. Inputs/buttons keep their own
   id-selector rules, which win on specificity. */
#form, #fieldWrap, #bulletRow, #credRows, #advanced { background: transparent; }
#fieldLabel {
    background: transparent;
    color: %MUTED%; font-size: 10px; font-weight: 800; letter-spacing: 1.1px;
}
QLineEdit#input, QComboBox#input {
    background: %INPUTBG%; color: %TEXTSTRONG%;
    border: 1px solid %INPUTBORDER%; border-radius: 10px;
    padding: 10px 13px; font-size: 13px; font-weight: 500;
    min-height: 20px;
    selection-background-color: %ACCENT%;
}
QLineEdit#input:hover, QComboBox#input:hover { border-color: %ACCENT%; }
QLineEdit#input:focus, QComboBox#input:focus { border-color: %ACCENT%; background: %INPUTFOCUS%; }
QComboBox#input QAbstractItemView {
    background: %CARDBG%; color: %TEXTSTRONG%; border: 1px solid %BORDER%;
    border-radius: 8px; padding: 4px; selection-background-color: %MENUSEL%; outline: none;
}
/* Proline Markets ochre, to match the brand panel beside it. Safe here and only here:
   #primary is the sign-in button and nothing else, so this does not bleed into
   the trading UI, where red means SELL. */
QPushButton#primary {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #c9862f, stop:1 #96601c);
    color: #ffffff; border: none; border-radius: 10px;
    font-size: 13px; font-weight: 800; letter-spacing: 0.3px;
}
QPushButton#primary:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #dd9a3e, stop:1 #ac7024);
}
QPushButton#primary:disabled { background: %BTNBG%; color: %DIM%; }
QPushButton#success {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #15803d, stop:1 #22a95b);
    color: #ffffff; border: none; border-radius: 10px;
    font-size: 13px; font-weight: 800;
}
QPushButton#success:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #1a9549, stop:1 #2ec27e);
}
QPushButton#link {
    background: transparent; border: none; color: %MUTED%;
    font-size: 11px; font-weight: 700; text-align: left; padding: 2px 0;
}
QPushButton#link:hover { color: %ACCENT%; }
/* Close (✕) — deliberately a solid, obvious control: the frameless card has no
   title bar, so this and Escape are the only ways out. */
QPushButton#close {
    background: %BTNBG%; border: 1px solid %BORDER%; color: %MUTED%;
    font-size: 14px; font-weight: 800; border-radius: 8px;
}
QPushButton#close:hover { background: #dc2626; border-color: #dc2626; color: #ffffff; }
QPushButton#ghost {
    background: transparent; border: 1px solid %BORDER%; color: %MUTED%;
    border-radius: 10px; font-size: 12px; font-weight: 700;
}
QPushButton#ghost:hover { border-color: %ACCENT%; color: %ACCENT%; }
)QSS")
        .replace("%CARDBG%",      cardBg)
        .replace("%INPUTBORDER%", c.inputBorder)
        .replace("%INPUTBG%",     inputBg)
        .replace("%INPUTFOCUS%",  inputFoc)
        .replace("%TEXTSTRONG%",  c.textStrong)
        .replace("%ACCENTHOVER%", c.accentHover)
        .replace("%ACCENT%",      c.accent)
        .replace("%BORDER%",      c.border)
        .replace("%MENUSEL%",     c.menuSel)
        .replace("%MUTED%",       c.muted)
        .replace("%BTNBG%",       c.btnBg)
        .replace("%DIM%",         c.dim);
}

// A labelled field: small uppercase caption above the input.
static QWidget* field(const QString& caption, QWidget* input) {
    auto* w = new QWidget;
    w->setObjectName("fieldWrap");
    auto* v = new QVBoxLayout(w);
    v->setContentsMargins(0, 0, 0, 0);
    v->setSpacing(7);
    auto* l = new QLabel(caption);
    l->setObjectName("fieldLabel");
    v->addWidget(l);
    v->addWidget(input);
    return w;
}

// One "✓ feature" line on the brand panel.
static QWidget* bullet(const QString& text) {
    const bool dark = Theme::isDark();
    auto* w = new QWidget;
    w->setObjectName("bulletRow");
    auto* h = new QHBoxLayout(w);
    h->setContentsMargins(0, 0, 0, 0);
    h->setSpacing(11);
    auto* tick = new QLabel(QStringLiteral("✓"));
    tick->setFixedSize(19, 19);
    tick->setAlignment(Qt::AlignCenter);
    tick->setStyleSheet(QString("background:%1; color:%2;"
                                "border-radius:9px; font-size:11px; font-weight:800;")
                        .arg(dark ? "rgba(215,5,5,0.22)" : "rgba(255,255,255,0.22)",
                             dark ? "#e0b076" : "#ffffff"));
    auto* t = new QLabel(text);
    t->setWordWrap(true);
    t->setStyleSheet(QString("background:transparent; color:%1; font-size:12px;")
                     .arg(dark ? "#a9a39a" : "#f7ecdc"));
    h->addWidget(tick, 0, Qt::AlignTop);
    h->addWidget(t, 1);
    return w;
}

LoginDialog::LoginDialog(const Config& cfg, QWidget* parent)
    : QDialog(parent), m_cfg(cfg), m_net(new QNetworkAccessManager(this)) {
    setWindowTitle(tr("Proline Markets Terminal — Sign in"));
    setModal(true);
    // Frameless + translucent so the card can have rounded corners and a real
    // drop shadow. The card is draggable by any empty area (see mouseMoveEvent).
    setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    setAttribute(Qt::WA_TranslucentBackground);
    setStyleSheet(sheet());

    auto* card = new QFrame;
    card->setObjectName("card");
    // Fixed WIDTH only. A fixed 520px height squeezed the inputs below their
    // natural size: the email/password text was clipped at the bottom of its
    // box and the SERVER combo lost its text and arrow entirely. Letting the
    // height follow the layout also means the card grows when "Advanced" opens
    // instead of compressing everything again.
    card->setFixedWidth(760);
    card->setMinimumHeight(560);

    auto* shadow = new QGraphicsDropShadowEffect(this);
    shadow->setBlurRadius(48);
    shadow->setOffset(0, 14);
    shadow->setColor(QColor(0, 0, 0, 190));
    card->setGraphicsEffect(shadow);

    auto* split = new QHBoxLayout(card);
    split->setContentsMargins(0, 0, 0, 0);
    split->setSpacing(0);
    split->addWidget(buildBrandPanel());
    split->addWidget(buildFormPanel(), 1);

    auto* outer = new QVBoxLayout(this);
    outer->setContentsMargins(28, 28, 28, 28);   // room for the shadow
    outer->addWidget(card);

    // Preselect the profile matching the saved endpoints.
    {
        QSignalBlocker b(m_profile);
        if (m_cfg.restBase == PM_REST)         m_profile->setCurrentText(tr("Proline Markets"));
        else if (m_cfg.restBase == LOCAL_REST) m_profile->setCurrentText(tr("Local dev"));
        else                                   m_profile->setCurrentText(tr("Custom"));
    }
    // (No auto-reveal of Advanced: the endpoint fields are hidden in this build.)
}

QWidget* LoginDialog::buildBrandPanel() {
    auto* p = new QFrame;
    p->setObjectName("brand");
    p->setFixedWidth(290);
    // Proline Markets ochre on black: the brand gold banked down into the app's
    // darkest surface in dark mode, the ochre itself in light mode. Both keep
    // the white/near-white brand type readable.
    //
    // This is the only brand-coloured surface in the app on purpose. Green and
    // red carry BUY and SELL everywhere else (Theme::p().up / .down), so the
    // accent used by buttons, selections and focus rings is left alone —
    // recolouring those would make every primary action read as a trade side.
    const QString grad = Theme::isDark()
        ? "stop:0 #4a3418, stop:0.55 #241a0c, stop:1 #0f1116"
        : "stop:0 #c4842a, stop:0.55 #9d6720, stop:1 #6d4715";
    p->setStyleSheet(QString("#brand{background:qlineargradient(x1:0,y1:0,x2:0.7,y2:1,%1);"
                             "border-top-left-radius:16px;border-bottom-left-radius:16px;}")
                     .arg(grad));

    auto* v = new QVBoxLayout(p);
    v->setContentsMargins(30, 34, 26, 30);
    v->setSpacing(0);

    const bool dark = Theme::isDark();
    // The real brand mark rather than a glyph stand-in. Only the square logo is
    // used here — the full wordmark's type is black and would disappear against
    // this panel's gradient.
    auto* mark = new QLabel;
    mark->setPixmap(QPixmap(":/prolinemarket-256.png")
                    .scaled(46, 46, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    mark->setStyleSheet("background:transparent;");
    v->addWidget(mark);
    v->addSpacing(12);

    auto* name = new QLabel(QStringLiteral("Proline Markets"));
    name->setStyleSheet("background:transparent; color:#ffffff; font-size:26px;"
                        "font-weight:800; letter-spacing:0.4px;");
    v->addWidget(name);

    auto* sub = new QLabel(tr("TERMINAL"));
    sub->setStyleSheet(QString("background:transparent; color:%1; font-size:11px;"
                               "font-weight:800; letter-spacing:3.4px;")
                       .arg(dark ? "#9e6b70" : "#f0c6c8"));
    v->addWidget(sub);

    v->addSpacing(26);
    auto* head = new QLabel(tr("Trade the markets\nfrom your desktop."));
    head->setStyleSheet(QString("background:transparent; color:%1; font-size:17px;"
                                "font-weight:700;").arg(dark ? "#e8ecf3" : "#ffffff"));
    v->addWidget(head);
    v->addSpacing(22);

    v->addWidget(bullet(tr("Live prices from the same feed as the web platform")));
    v->addSpacing(13);
    v->addWidget(bullet(tr("One-click BUY / SELL with drag-to-set SL & TP on the chart")));
    v->addSpacing(13);
    v->addWidget(bullet(tr("Positions, pending orders and full trade history")));

    // The stretch stays with nothing under it: it is what holds the bullets up
    // against the headline instead of letting them centre in the panel.
    v->addStretch();
    return p;
}

QWidget* LoginDialog::buildFormPanel() {
    auto* p = new QWidget;
    p->setObjectName("form");
    auto* v = new QVBoxLayout(p);
    v->setContentsMargins(38, 20, 38, 30);
    v->setSpacing(0);

    // ── title bar row (close only — the window is frameless) ──
    auto* bar = new QHBoxLayout;
    bar->setContentsMargins(0, 0, 0, 0);
    bar->addStretch();
    auto* closeBtn = new QPushButton;
    closeBtn->setObjectName("close");
    closeBtn->setFixedSize(32, 32);
    closeBtn->setCursor(Qt::PointingHandCursor);
    closeBtn->setToolTip(tr("Close (Esc)"));
    closeBtn->setIcon(Icons::close(QColor(Theme::p().muted), 16));
    closeBtn->setIconSize(QSize(16, 16));
    // Every QPushButton in a QDialog is autoDefault, and QDialog promotes the
    // FIRST one it finds to "default" — which is this ✕, because the top bar is
    // built before the form. Return in the email or password field then reached
    // reject() and the card vanished mid-login: doLogin() did fire, but the
    // dialog closed underneath it, so only a mouse click on Sign in ever
    // worked. Every secondary button below opts out for the same reason.
    closeBtn->setAutoDefault(false);
    connect(closeBtn, &QPushButton::clicked, this, &QDialog::reject);
    bar->addWidget(closeBtn);
    v->addLayout(bar);
    v->addSpacing(6);

    m_stepTitle = new QLabel(tr("Welcome back"));
    // Hardcoding #f2f4f8 here made the title invisible on the light card — every
    // colour in this dialog comes from the palette.
    m_stepTitle->setStyleSheet(QString("background:transparent; color:%1; font-size:23px;"
                                       "font-weight:800;").arg(Theme::p().textStrong));
    v->addWidget(m_stepTitle);
    v->addSpacing(6);

    m_stepSub = new QLabel(tr("Sign in with your Proline Markets account — the same email and "
                              "password as the website."));
    m_stepSub->setWordWrap(true);
    m_stepSub->setStyleSheet(QString("background:transparent; color:%1; font-size:12px;")
                             .arg(Theme::p().muted));
    v->addWidget(m_stepSub);
    v->addSpacing(22);

    // ── credentials ──
    m_profile = new QComboBox;
    m_profile->setObjectName("input");
    m_profile->setCursor(Qt::PointingHandCursor);
    m_profile->addItems({tr("Proline Markets"), tr("Local dev"), tr("Custom")});
    connect(m_profile, &QComboBox::currentTextChanged, this,
            [this](const QString& n) { applyProfile(n); });

    // Prefill the address that was signed in with — NOT userName, which is the
    // display name from the login response and never a valid login identifier.
    m_email = new QLineEdit(m_cfg.email);
    m_email->setObjectName("input");
    m_email->setPlaceholderText(tr("you@example.com"));

    m_password = new QLineEdit;
    m_password->setObjectName("input");
    m_password->setEchoMode(QLineEdit::Password);
    m_password->setPlaceholderText(tr("Enter your password"));
    // Reveal toggle inside the field.
    QAction* eye = m_password->addAction(Icons::eye(QColor(Theme::p().muted), 16),
                                         QLineEdit::TrailingPosition);
    eye->setToolTip(tr("Show password"));
    connect(eye, &QAction::triggered, this, [this, eye]() {
        const bool hidden = (m_password->echoMode() == QLineEdit::Password);
        m_password->setEchoMode(hidden ? QLineEdit::Normal : QLineEdit::Password);
        eye->setIcon(hidden ? Icons::eyeOff(QColor(Theme::p().accent), 16)
                            : Icons::eye(QColor(Theme::p().muted), 16));
        eye->setToolTip(hidden ? tr("Hide password") : tr("Show password"));
    });

    auto* rows = new QVBoxLayout;
    rows->setContentsMargins(0, 0, 0, 0);
    rows->setSpacing(14);
    // Server picker, API-key mode and the endpoint fields are all built but
    // hidden: the sign-in path is email + password only. They stay constructed
    // because the login code still reads m_rest / m_ws for the endpoints and
    // m_profile for the active profile — hiding beats deleting here, since the
    // values must still exist. Show any of them again by dropping its hide().
    auto* serverField = field(tr("SERVER"), m_profile);
    serverField->hide();
    rows->addWidget(serverField);
    rows->addWidget(field(tr("EMAIL"), m_email));
    rows->addWidget(field(tr("PASSWORD"), m_password));
    m_credRows = new QWidget;
    m_credRows->setObjectName("credRows");
    m_credRows->setLayout(rows);
    v->addWidget(m_credRows);

    // ── API key / secret, the alternative for hosts with no /terminal/login ──
    m_apiKey = new QLineEdit(m_cfg.apiKey);
    m_apiKey->setObjectName("input");
    m_apiKey->setPlaceholderText(tr("Key from your dashboard"));

    m_apiSecret = new QLineEdit(m_cfg.apiSecret);
    m_apiSecret->setObjectName("input");
    m_apiSecret->setEchoMode(QLineEdit::Password);
    m_apiSecret->setPlaceholderText(tr("Secret"));

    auto* keyRows = new QVBoxLayout;
    keyRows->setContentsMargins(0, 0, 0, 0);
    keyRows->setSpacing(14);
    keyRows->addWidget(field(tr("API KEY"), m_apiKey));
    keyRows->addWidget(field(tr("API SECRET"), m_apiSecret));
    m_keyRows = new QWidget;
    m_keyRows->setObjectName("credRows");
    m_keyRows->setLayout(keyRows);
    m_keyRows->hide();
    v->addWidget(m_keyRows);

    v->addSpacing(10);
    m_modeBtn = new QPushButton(tr("🔑  Use an API key instead"));
    m_modeBtn->setObjectName("link");
    m_modeBtn->setCursor(Qt::PointingHandCursor);
    m_modeBtn->setAutoDefault(false);
    connect(m_modeBtn, &QPushButton::clicked, this, &LoginDialog::toggleAuthMode);
    // Hidden: Connect mints the algo key automatically, so nobody has to paste
    // one. The mode still works if this is shown again.
    m_modeBtn->hide();
    v->addWidget(m_modeBtn, 0, Qt::AlignLeft);

    m_investorBtn = new QPushButton(tr("👁  Investor sign-in (read-only)"));
    m_investorBtn->setObjectName("link");
    m_investorBtn->setCursor(Qt::PointingHandCursor);
    m_investorBtn->setAutoDefault(false);
    connect(m_investorBtn, &QPushButton::clicked, this, &LoginDialog::toggleInvestorMode);
    v->addWidget(m_investorBtn, 0, Qt::AlignLeft);
    v->addSpacing(4);
    connect(m_apiSecret, &QLineEdit::returnPressed, this, &LoginDialog::doLogin);
    connect(m_apiKey,    &QLineEdit::returnPressed, this, &LoginDialog::doLogin);

    // ── advanced (endpoints) ──
    m_rest = new QLineEdit(m_cfg.restBase);
    m_rest->setObjectName("input");
    m_ws = new QLineEdit(m_cfg.wsUrl);
    m_ws->setObjectName("input");

    auto* adv = new QVBoxLayout;
    adv->setContentsMargins(0, 4, 0, 0);
    adv->setSpacing(12);
    adv->addWidget(field(tr("REST BASE"), m_rest));
    adv->addWidget(field(tr("WEBSOCKET"), m_ws));
    m_advanced = new QWidget;
    m_advanced->setObjectName("advanced");
    m_advanced->setLayout(adv);
    m_advanced->hide();

    m_advancedBtn = new QPushButton(tr("⚙  Advanced — server endpoints"));
    m_advancedBtn->setObjectName("link");
    m_advancedBtn->setCursor(Qt::PointingHandCursor);
    connect(m_advancedBtn, &QPushButton::clicked, this, [this]() {
        const bool show = m_advanced->isHidden();
        m_advanced->setVisible(show);
        m_advancedBtn->setText(show ? tr("⚙  Hide server endpoints")
                                    : tr("⚙  Advanced — server endpoints"));
    });
    m_advancedBtn->setAutoDefault(false);
    m_advancedBtn->hide();   // endpoints come from config; not user-editable here
    v->addWidget(m_advancedBtn, 0, Qt::AlignLeft);
    v->addWidget(m_advanced);
    v->addSpacing(16);

    // ── primary action ──
    m_loginBtn = new QPushButton(tr("Sign in"));
    m_loginBtn->setObjectName("primary");
    m_loginBtn->setMinimumHeight(44);
    m_loginBtn->setCursor(Qt::PointingHandCursor);
    // Enter anywhere in step 1 signs in. The returnPressed connections below
    // are kept as well: they fire even while focus is in a field that is not in
    // the default-button chain, and one of the two paths always applies.
    m_loginBtn->setDefault(true);
    m_loginBtn->setAutoDefault(true);
    connect(m_loginBtn, &QPushButton::clicked, this, &LoginDialog::doLogin);
    connect(m_password, &QLineEdit::returnPressed, this, &LoginDialog::doLogin);
    connect(m_email,    &QLineEdit::returnPressed, this, &LoginDialog::doLogin);
    v->addWidget(m_loginBtn);

    // Explicit way out, next to the ✕ and Escape.
    v->addSpacing(9);
    auto* cancelBtn = new QPushButton(tr("Cancel"));
    cancelBtn->setAutoDefault(false);
    cancelBtn->setObjectName("ghost");
    cancelBtn->setMinimumHeight(36);
    cancelBtn->setCursor(Qt::PointingHandCursor);
    connect(cancelBtn, &QPushButton::clicked, this, &QDialog::reject);
    v->addWidget(cancelBtn);

    // ── step 2: trading-account picker (revealed after sign-in) ──
    m_accountLabel = new QLabel(tr("TRADING ACCOUNT"));
    m_accountLabel->setObjectName("fieldLabel");
    m_account = new QComboBox;
    m_account->setObjectName("input");
    m_account->setCursor(Qt::PointingHandCursor);
    m_connectBtn = new QPushButton(tr("Connect"));
    m_connectBtn->setObjectName("success");
    m_connectBtn->setMinimumHeight(44);
    // Not default yet — step 1 owns Return until the account picker appears.
    m_connectBtn->setAutoDefault(false);
    m_connectBtn->setCursor(Qt::PointingHandCursor);
    connect(m_connectBtn, &QPushButton::clicked, this, &LoginDialog::onConnect);
    m_accountLabel->hide();
    m_account->hide();
    m_connectBtn->hide();

    v->addWidget(m_accountLabel);
    v->addSpacing(7);
    v->addWidget(m_account);
    v->addSpacing(16);
    v->addWidget(m_connectBtn);

    v->addSpacing(12);
    m_status = new QLabel;
    m_status->setWordWrap(true);
    m_status->setStyleSheet(QString("background:transparent; color:%1; font-size:12px;"
                                    "font-weight:600;").arg(Theme::p().down));
    v->addWidget(m_status);

    v->addStretch();
    return p;
}

// --- window dragging (frameless) -------------------------------------------

void LoginDialog::mousePressEvent(QMouseEvent* e) {
    if (e->button() == Qt::LeftButton)
        m_dragPos = e->globalPosition().toPoint() - frameGeometry().topLeft();
    QDialog::mousePressEvent(e);
}

void LoginDialog::mouseMoveEvent(QMouseEvent* e) {
    if (e->buttons() & Qt::LeftButton && !m_dragPos.isNull())
        move(e->globalPosition().toPoint() - m_dragPos);
    QDialog::mouseMoveEvent(e);
}

// --- behaviour --------------------------------------------------------------

void LoginDialog::applyProfile(const QString& name) {
    if (name == tr("Proline Markets"))        { m_rest->setText(PM_REST);    m_ws->setText(PM_WS); }
    else if (name == tr("Local dev")) { m_rest->setText(LOCAL_REST); m_ws->setText(LOCAL_WS); }
    else if (m_advanced->isHidden())  { m_advancedBtn->click(); }   // Custom → reveal
}

void LoginDialog::setBusy(bool busy) {
    m_loginBtn->setEnabled(!busy);
    m_loginBtn->setText(busy ? tr("Signing in…") : tr("Sign in"));
}

void LoginDialog::setStatus(const QString& text, bool error) {
    m_status->setStyleSheet(QString("background:transparent; font-size:12px; font-weight:600; color:%1;")
                            .arg(error ? Theme::p().down : Theme::p().up));
    m_status->setText(text);
}

void LoginDialog::showAccountStep() {
    m_stepTitle->setText(tr("Choose an account"));
    m_stepSub->setText(tr("Signed in as %1. Pick the trading account this terminal "
                          "should connect to.").arg(m_userName));
    m_credRows->hide();
    m_advancedBtn->hide();
    m_advanced->hide();
    m_loginBtn->hide();
    m_accountLabel->show();
    m_account->show();
    m_connectBtn->show();
    // Hand Return over with the step. A hidden default button still answers
    // Return, so without this Enter on the account picker would re-run a
    // sign-in that has already happened.
    m_loginBtn->setDefault(false);
    m_connectBtn->setAutoDefault(true);
    m_connectBtn->setDefault(true);
    m_account->setFocus();
}

void LoginDialog::toggleAuthMode() {
    m_keyMode = !m_keyMode;
    m_credRows->setVisible(!m_keyMode);
    m_keyRows->setVisible(m_keyMode);
    m_status->clear();
    m_modeBtn->setText(m_keyMode ? tr("✉  Use email and password instead")
                                 : tr("🔑  Use an API key instead"));
    m_stepSub->setText(m_keyMode
        ? tr("Sign in with an API key and secret generated in your Proline Markets "
             "dashboard. The key already identifies one trading account.")
        : tr("Sign in with your Proline Markets account — the same email and "
             "password as the website."));
    adjustSize();
}

// Read-only sign-in. Same two fields, different route and a different kind of
// credential: the email is the account owner's, the password is the one an
// admin generated under Investor Access.
void LoginDialog::toggleInvestorMode() {
    m_investorMode = !m_investorMode;
    m_status->clear();
    // The API-key path is a trader-only thing; an investor has no key. (The
    // button is hidden by default — this only matters if it is turned back on.)
    if (m_investorMode && m_keyMode) toggleAuthMode();
    if (m_investorMode) m_modeBtn->hide();

    m_stepTitle->setText(m_investorMode ? tr("Investor access") : tr("Welcome back"));
    m_stepSub->setText(m_investorMode
        ? tr("Sign in with the read-only credentials your account manager gave you. "
             "You can watch the account, its charts and its positions — you cannot trade.")
        : tr("Sign in with your Proline Markets account — the same email and "
             "password as the website."));
    m_investorBtn->setText(m_investorMode ? tr("←  Back to trader sign-in")
                                          : tr("👁  Investor sign-in (read-only)"));
    m_loginBtn->setText(tr("Sign in"));
    adjustSize();
}

void LoginDialog::doLogin() {
    if (m_investorMode) { doInvestorLogin(); return; }
    if (m_keyMode) { doKeyLogin(); return; }
    doPasswordLogin();
}

// POST /api/v1/auth/investor/login. No fallback to the legacy algo route: that
// gateway has no investor concept, so a 404 there would only confuse.
void LoginDialog::doInvestorLogin() {
    const QString email = m_email->text().trimmed();
    const QString pass  = m_password->text();
    if (email.isEmpty() || pass.isEmpty()) {
        setStatus(tr("Enter the investor email and password."), true);
        return;
    }
    m_status->clear();
    setBusy(true);
    m_cfg.restBase = m_rest->text().trimmed();
    m_cfg.wsUrl    = m_ws->text().trimmed();
    postLogin(v1Base() + "/auth/investor/login", email, pass, /*allowFallback=*/false);
}

// API key + secret: there is no login call to make — the credentials ARE the
// auth, sent as headers on every request. So they are validated by asking for
// the account with them, which also proves the endpoint is reachable before the
// terminal commits to them.
void LoginDialog::doKeyLogin() {
    const QString key    = m_apiKey->text().trimmed();
    const QString secret = m_apiSecret->text().trimmed();
    if (key.isEmpty() || secret.isEmpty()) {
        setStatus(tr("Enter your API key and secret."), true);
        return;
    }
    m_status->clear();
    setBusy(true);

    m_cfg.restBase = m_rest->text().trimmed();
    m_cfg.wsUrl    = m_ws->text().trimmed();

    QNetworkRequest req{QUrl(m_cfg.restBase + "/account")};
    req.setRawHeader("X-Api-Key",    key.toUtf8());
    req.setRawHeader("X-Api-Secret", secret.toUtf8());
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);

    QNetworkReply* reply = m_net->get(req);
    connect(reply, &QNetworkReply::finished, this, [this, reply, key, secret]() {
        reply->deleteLater();
        setBusy(false);
        const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(reply->readAll()).object();

        if (reply->error() != QNetworkReply::NoError || http >= 400) {
            setStatus(tr("Sign-in failed: %1").arg(apiDetail(o, reply->errorString())), true);
            return;
        }

        // Key auth and token auth are mutually exclusive in ApiClient — it sends
        // the Bearer header whenever a token is present — so a leftover token
        // would silently win over the key just entered.
        m_cfg.apiKey       = key;
        m_cfg.apiSecret    = secret;
        m_cfg.token.clear();
        m_cfg.refreshToken.clear();   // key auth has no session to refresh
        m_cfg.accountId.clear();
        m_cfg.userName.clear();
        m_cfg.accountsJson = "[]";
        m_cfg.restBase     = m_rest->text().trimmed();
        m_cfg.wsUrl        = m_ws->text().trimmed();
        // An API key is a trading credential; whatever this install was last
        // time, it is not a read-only session now.
        m_cfg.readOnly     = false;
        m_cfg.save();
        accept();
    });
}

void LoginDialog::doPasswordLogin() {
    const QString email = m_email->text().trimmed();
    const QString pass  = m_password->text();
    if (email.isEmpty() || pass.isEmpty()) {
        setStatus(tr("Enter your email and password."), true);
        return;
    }
    m_status->clear();
    setBusy(true);

    m_cfg.restBase = m_rest->text().trimmed();
    m_cfg.wsUrl    = m_ws->text().trimmed();

    // Two deployments, two login routes. The platform API exposes
    // POST /api/v1/auth/login; the older algo gateway exposed
    // POST /api/algo/terminal/login. Try the platform route first and fall back
    // on 404, so one build signs in against either host.
    postLogin(v1Base() + "/auth/login", email, pass, /*allowFallback=*/true);
}

// Swaps the algo prefix for the platform one, the same derivation ApiClient
// uses for the per-position endpoints.
QString LoginDialog::v1Base() const {
    QString base = m_rest->text().trimmed();
    base.replace("/api/algo", "/api/v1");
    return base;
}

void LoginDialog::postLogin(const QString& url, const QString& email,
                            const QString& pass, bool allowFallback) {
    QNetworkRequest req{QUrl(url)};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    QJsonObject body;
    body["email"] = email;
    body["password"] = pass;

    QNetworkReply* reply = m_net->post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this,
            [this, reply, email, pass, allowFallback]() {
        reply->deleteLater();
        const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(reply->readAll()).object();

        // Only a missing ROUTE triggers the fallback. A 401 means the route is
        // right and the password is wrong — retrying elsewhere would just show
        // a confusing second error.
        if (http == 404 && allowFallback) {
            postLogin(m_cfg.restBase + "/terminal/login", email, pass, false);
            return;
        }

        setBusy(false);
        if (reply->error() != QNetworkReply::NoError || http >= 400) {
            setStatus(tr("Sign-in failed: %1").arg(apiDetail(o, reply->errorString())), true);
            return;
        }

        // The refresh credential is only ever an HttpOnly cookie — it is not in
        // the JSON body. Take it here, because this reply is the one time it is
        // handed out, and without it the session simply dies 45 minutes later.
        const QVariant sc = reply->header(QNetworkRequest::SetCookieHeader);
        for (const QNetworkCookie& ck : sc.value<QList<QNetworkCookie>>())
            if (ck.name() == "pt_refresh") m_cfg.refreshToken = QString::fromUtf8(ck.value());

        onLoginJson(o);
    });
}

// The two hosts also name things differently, so every field is read
// defensively rather than assuming one schema.
void LoginDialog::onLoginJson(const QJsonObject& o) {
    m_token = o.value("token").toString();
    if (m_token.isEmpty()) m_token = o.value("access_token").toString();
    if (m_token.isEmpty()) {
        setStatus(tr("Signed in, but no token was returned."), true);
        return;
    }

    const QJsonObject user = o.value("user").toObject();
    m_userName = o.value("name").toString();
    if (m_userName.isEmpty()) m_userName = user.value("name").toString();
    if (m_userName.isEmpty()) m_userName = user.value("full_name").toString();
    if (m_userName.isEmpty()) m_userName = m_email->text().trimmed();

    const QJsonArray accts = o.value("accounts").toArray();
    if (!accts.isEmpty()) { populateAccounts(accts); return; }

    // The platform login returns only the session; accounts live behind their
    // own endpoint.
    fetchAccounts();
}

void LoginDialog::fetchAccounts() {
    setBusy(true);
    QNetworkRequest req{QUrl(v1Base() + "/accounts")};
    req.setRawHeader("Authorization", ("Bearer " + m_token).toUtf8());
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);

    QNetworkReply* reply = m_net->get(req);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        setBusy(false);
        const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray raw = reply->readAll();
        if (reply->error() != QNetworkReply::NoError || http >= 400) {
            setStatus(tr("Signed in, but the account list could not be loaded (HTTP %1).")
                      .arg(http), true);
            return;
        }
        // Either a bare array or an object wrapping one.
        const QJsonDocument doc = QJsonDocument::fromJson(raw);
        QJsonArray arr = doc.isArray() ? doc.array() : doc.object().value("accounts").toArray();
        if (arr.isEmpty()) arr = doc.object().value("items").toArray();
        populateAccounts(arr);
    });
}

void LoginDialog::populateAccounts(const QJsonArray& accts) {
    if (accts.isEmpty()) {
        // The credential is fine — there is simply nothing to look at. Say which
        // it is, or an investor reads this as "my password is wrong".
        setStatus(m_investorMode
            ? tr("Signed in. This investor login is valid, but the account holder "
                 "has no trading account yet — ask the broker to open one.")
            : tr("Signed in, but no trading accounts were found."), true);
        return;
    }

    // Normalise to the shape MainWindow's Accounts menu expects, so the rest of
    // the app does not need to know which host answered.
    QJsonArray norm;
    m_account->clear();
    for (const QJsonValue& v : accts) {
        const QJsonObject a = v.toObject();

        QString id = a.value("account_id").toString();
        if (id.isEmpty()) id = a.value("id").toString();
        if (id.isEmpty()) id = QString::number(a.value("id").toInt());

        QString number = a.value("account_number").toString();
        if (number.isEmpty()) number = a.value("number").toString();
        if (number.isEmpty()) number = a.value("login").toString();
        if (number.isEmpty()) number = id;

        bool demo = a.value("is_demo").toBool();
        if (!a.contains("is_demo"))
            demo = a.value("type").toString().compare("demo", Qt::CaseInsensitive) == 0;

        const QString cur = a.value("currency").toString("USD");
        const double bal  = a.value("balance").toDouble();

        QJsonObject n;
        n["account_id"]     = id;
        n["account_number"] = number;
        n["is_demo"]        = demo;
        n["currency"]       = cur;
        n["balance"]        = bal;
        norm.append(n);

        m_account->addItem(QString("%1  ·  %2  ·  %3 %4")
                           .arg(number, demo ? tr("DEMO") : tr("LIVE"))
                           .arg(bal, 0, 'f', 2).arg(cur), id);
    }
    m_accountsJson = QString::fromUtf8(QJsonDocument(norm).toJson(QJsonDocument::Compact));

    const int idx = m_account->findData(m_cfg.accountId);
    if (idx >= 0) m_account->setCurrentIndex(idx);

    setStatus(tr("✓ Signed in as %1").arg(m_userName), false);
    showAccountStep();
}

void LoginDialog::onConnect() {
    if (m_account->currentIndex() < 0) {
        setStatus(tr("Select a trading account."), true);
        return;
    }
    m_cfg.token        = m_token;
    m_cfg.accountId    = m_account->currentData().toString();
    m_cfg.userName     = m_userName;
    m_cfg.email        = m_email->text().trimmed();
    m_cfg.accountsJson = m_accountsJson;
    m_cfg.restBase     = m_rest->text().trimmed();
    m_cfg.wsUrl        = m_ws->text().trimmed();
    m_cfg.readOnly     = m_investorMode;

    if (m_investorMode) {
        // No algo key to mint: /api/v1/algo/generate is blocked for this role,
        // and nothing here needs one — ApiClient reads off /api/v1 and the tick
        // stream off /ws/prices, both on the JWT. Clear any key left behind by
        // a previous trader session on this machine, or ApiClient would keep
        // preferring it and every read would 401 against someone else's account.
        m_cfg.apiKey.clear();
        m_cfg.apiSecret.clear();
        m_cfg.save();
        accept();
        return;
    }

    // The JWT alone is not enough. Market data, bars, /trade and the tick
    // WebSocket all live behind /api/algo, which authenticates ONLY with
    // X-Api-Key + X-Api-Secret — a user token is rejected there outright. The
    // platform mints those keys for the signed-in user, so do that now rather
    // than making the user paste them by hand.
    mintAlgoKey();
}

void LoginDialog::mintAlgoKey() {
    m_connectBtn->setEnabled(false);
    m_connectBtn->setText(tr("Connecting…"));
    setStatus(tr("Preparing market-data access…"), false);

    QNetworkRequest req{QUrl(v1Base() + "/algo/generate")};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setRawHeader("Authorization", ("Bearer " + m_token).toUtf8());
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);

    QJsonObject body;
    body["account_id"] = m_cfg.accountId;
    body["label"]      = QStringLiteral("Proline Markets Terminal");

    QNetworkReply* reply = m_net->post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        m_connectBtn->setEnabled(true);
        m_connectBtn->setText(tr("Connect"));

        const int http = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QJsonObject o = QJsonDocument::fromJson(reply->readAll()).object();

        if (reply->error() != QNetworkReply::NoError || http >= 400) {
            // Older gateways have no key service; the token is all there is.
            // Save it and let the terminal try — it will report per-request.
            if (http == 404) {
                m_cfg.apiKey.clear();
                m_cfg.apiSecret.clear();
                m_cfg.save();
                accept();
                return;
            }
            setStatus(tr("Could not prepare market data: %1")
                      .arg(apiDetail(o, reply->errorString())), true);
            return;
        }

        // The secret is returned exactly once, so it must be persisted here.
        m_cfg.apiKey    = o.value("api_key").toString();
        m_cfg.apiSecret = o.value("api_secret").toString();
        m_cfg.save();
        accept();
    });
}
