#include "ui/OrderDialog.h"
#include "ui/Toast.h"
#include "ui/Theme.h"
#include "ui/SpinInput.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QTabWidget>
#include <QLabel>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QList>
#include <cmath>

namespace {
// Quick-volume chips, the same ladder the web ticket offers. Each is clamped to
// the symbol's own min/max before it is applied, so a 100-lot chip on an
// instrument capped at 10 sets 10 rather than failing validation server-side.
const double kLotChips[] = {0.01, 0.1, 1.0, 10.0, 100.0};
}

OrderDialog::OrderDialog(const QHash<QString, SymbolSpec>& specs,
                         const QHash<QString, Quote>& quotes,
                         const QString& symbol,
                         int leverage, double freeMargin, QWidget* parent)
    : QDialog(parent), m_specs(specs), m_quotes(quotes),
      m_leverage(leverage > 0 ? leverage : 100), m_freeMargin(freeMargin) {
    setModal(true);
    setMinimumWidth(400);

    m_tabs = new QTabWidget;
    m_tabs->addTab(buildMarketTab(),  tr("Market"));
    m_tabs->addTab(buildPendingTab(), tr("Pending"));

    auto* lay = new QVBoxLayout(this);
    lay->setSpacing(9);
    lay->addWidget(buildHeader());
    lay->addWidget(m_tabs);

    applySymbol(symbol);
}

// ── Header: instrument picker + leverage ───────────────────────────
QWidget* OrderDialog::buildHeader() {
    const auto& c = Theme::p();
    auto* row = new QWidget;
    auto* h = new QHBoxLayout(row);
    h->setContentsMargins(0, 0, 0, 0);
    h->setSpacing(8);

    // Switchable from here, as on the web. Sorted, because the hash this comes
    // from has no order and an arbitrary instrument list is unusable.
    m_symbolBox = new QComboBox;
    m_symbolBox->setMinimumHeight(32);
    m_symbolBox->setMinimumWidth(150);
    QList<QString> names = m_specs.keys();
    std::sort(names.begin(), names.end());
    for (const QString& s : names) m_symbolBox->addItem(s);
    connect(m_symbolBox, &QComboBox::currentTextChanged, this, [this](const QString& s) {
        if (!m_applying) applySymbol(s);
    });

    // Shown because margin is meaningless without it: the same 0.10 lots costs
    // ten times more at 1:10 than at 1:100, and the trader cannot see which
    // this account is on anywhere else in this window.
    m_leverageLbl = new QLabel;
    m_leverageLbl->setStyleSheet(QString(
        "background:%1; color:%2; border:1px solid %3; border-radius:4px;"
        "padding:4px 8px; font-size:11px; font-weight:800;")
        .arg(c.panelAlt, c.muted, c.border));

    h->addWidget(m_symbolBox, 1);
    h->addStretch();
    h->addWidget(m_leverageLbl);
    return row;
}

// ── Market ─────────────────────────────────────────────────────────
QWidget* OrderDialog::buildMarketTab() {
    const auto& c = Theme::p();
    auto* page = new QWidget;

    auto mkTile = [&](const QString& caption, QLabel** priceOut) {
        auto* b = new QPushButton;
        b->setMinimumHeight(54);
        b->setCursor(Qt::PointingHandCursor);
        auto* v = new QVBoxLayout(b);
        v->setContentsMargins(10, 6, 10, 6);
        v->setSpacing(0);
        auto* cap = new QLabel(caption);
        cap->setStyleSheet("color:rgba(255,255,255,0.85); font-size:10px; font-weight:800;"
                           "letter-spacing:1px; background:transparent;");
        auto* px = new QLabel("—");
        px->setStyleSheet("color:#ffffff; font-size:16px; font-weight:800;"
                          "font-family:Consolas,monospace; background:transparent;");
        v->addWidget(cap);
        v->addWidget(px);
        *priceOut = px;
        return b;
    };

    m_sellTile = mkTile(tr("SELL"), &m_sellPrice);
    m_buyTile  = mkTile(tr("BUY"),  &m_buyPrice);
    connect(m_sellTile, &QPushButton::clicked, this, [this]() { setMarketSide("sell"); });
    connect(m_buyTile,  &QPushButton::clicked, this, [this]() { setMarketSide("buy"); });

    m_spreadLbl = new QLabel("—");
    m_spreadLbl->setAlignment(Qt::AlignCenter);
    m_spreadLbl->setFixedWidth(62);
    m_spreadLbl->setStyleSheet(QString("color:%1; font-size:10px; font-weight:800;"
                                       "font-family:Consolas,monospace;").arg(c.muted));

    auto* tiles = new QHBoxLayout;
    tiles->setSpacing(6);
    tiles->addWidget(m_sellTile, 1);
    tiles->addWidget(m_spreadLbl);
    tiles->addWidget(m_buyTile, 1);

    // ── volume, in lots or units ──
    auto mkToggle = [&](const QString& text) {
        auto* b = new QPushButton(text);
        b->setCheckable(true);
        b->setFixedHeight(22);
        b->setCursor(Qt::PointingHandCursor);
        b->setFocusPolicy(Qt::NoFocus);
        return b;
    };
    m_lotsBtn  = mkToggle(tr("Lots"));
    m_unitsBtn = mkToggle(tr("Units"));
    m_lotsBtn->setChecked(true);
    // Manual pair rather than a QButtonGroup: only two, and the handler has to
    // convert the value across the switch anyway.
    auto onToggle = [this](bool units) {
        if (units == unitsMode()) return;
        const double lots = lotsFromInput();          // read in the OLD mode
        m_lotsBtn->setChecked(!units);
        m_unitsBtn->setChecked(units);
        applySymbol(m_spec.symbol);                   // re-range for the new unit
        const double cs = m_spec.contractSize > 0 ? m_spec.contractSize : 100000.0;
        m_mktVolume->setValue(units ? lots * cs : lots);
        refreshMarket();
    };
    connect(m_lotsBtn,  &QPushButton::clicked, this, [onToggle]() { onToggle(false); });
    connect(m_unitsBtn, &QPushButton::clicked, this, [onToggle]() { onToggle(true); });

    m_mktVolume = new QDoubleSpinBox;
    m_mktVolume->setMinimumHeight(34);
    m_mktVolume->setButtonSymbols(QAbstractSpinBox::NoButtons);
    m_mktVolume->setAlignment(Qt::AlignCenter);
    connect(m_mktVolume, &QDoubleSpinBox::valueChanged, this, [this]() { refreshMarket(); });
    SpinInput::onTyping(m_mktVolume, this, [this]() { refreshMarket(); });

    auto* minus = new QPushButton(QStringLiteral("−"));
    auto* plus  = new QPushButton(QStringLiteral("+"));
    for (QPushButton* b : {minus, plus}) {
        b->setFixedSize(34, 34);
        b->setCursor(Qt::PointingHandCursor);
        b->setFocusPolicy(Qt::NoFocus);
        b->setStyleSheet(QString(
            "QPushButton{background:%1; color:%2; border:1px solid %3;"
            "border-radius:5px; font-size:16px; font-weight:800;}"
            "QPushButton:hover{border-color:%4;}")
            .arg(c.btnBg, c.textStrong, c.btnBorder, c.accent));
    }
    connect(minus, &QPushButton::clicked, this, [this]() { m_mktVolume->stepDown(); });
    connect(plus,  &QPushButton::clicked, this, [this]() { m_mktVolume->stepUp(); });

    auto* volRow = new QHBoxLayout;
    volRow->setSpacing(6);
    volRow->addWidget(minus);
    volRow->addWidget(m_mktVolume, 1);
    volRow->addWidget(plus);

    auto* chips = new QHBoxLayout;
    chips->setSpacing(4);
    for (double v : kLotChips) {
        auto* b = new QPushButton(QString::number(v, 'f', v < 10.0 ? 2 : 0));
        b->setMinimumHeight(26);
        b->setCursor(Qt::PointingHandCursor);
        b->setFocusPolicy(Qt::NoFocus);
        b->setStyleSheet(QString(
            "QPushButton{background:%1; color:%2; border:1px solid %3; border-radius:5px;"
            "font-size:11px; font-weight:700;}"
            "QPushButton:hover{border-color:%4; color:%5;}")
            .arg(c.btnBg, c.muted, c.btnBorder, c.accent, c.textStrong));
        // Chips are always LOTS, even in units mode — that is what the numbers
        // on them mean.
        connect(b, &QPushButton::clicked, this, [this, v]() {
            const double cs = m_spec.contractSize > 0 ? m_spec.contractSize : 100000.0;
            const double shown = unitsMode() ? v * cs : v;
            m_mktVolume->setValue(qBound(m_mktVolume->minimum(), shown, m_mktVolume->maximum()));
        });
        chips->addWidget(b, 1);
    }

    // ── brackets, collapsed until asked for ──
    auto mkBracket = [&]() {
        auto* s = new QDoubleSpinBox;
        s->setRange(0.0, 1e7);
        s->setSpecialValueText(tr("none"));   // 0 => not set
        s->setValue(0.0);
        s->setMinimumHeight(32);
        s->setVisible(false);
        return s;
    };
    m_mktSl = mkBracket();
    m_mktTp = mkBracket();
    SpinInput::freeTyping({m_mktVolume, m_mktSl, m_mktTp});

    auto mkAdd = [&](const QString& text) {
        auto* b = new QPushButton(text);
        b->setMinimumHeight(30);
        b->setCursor(Qt::PointingHandCursor);
        b->setFocusPolicy(Qt::NoFocus);
        b->setStyleSheet(QString(
            "QPushButton{background:%1; color:%2; border:1px solid %3;"
            "border-radius:5px; font-size:11px; font-weight:700;}"
            "QPushButton:hover{border-color:%4; color:%4;}")
            .arg(c.btnBg, c.muted, c.btnBorder, c.accent));
        return b;
    };
    m_addSlBtn = mkAdd(tr("+ SL"));
    m_addTpBtn = mkAdd(tr("+ TP"));
    // Most market orders go out without brackets; showing two empty price
    // fields by default made the window taller than it needed to be for the
    // common case. They are one click away, and stay open once revealed.
    connect(m_addSlBtn, &QPushButton::clicked, this, [this]() {
        const bool show = !m_mktSl->isVisible();
        m_mktSl->setVisible(show);
        m_addSlBtn->setText(show ? tr("SL") : tr("+ SL"));
        if (!show) m_mktSl->setValue(0.0);
        adjustSize();
    });
    connect(m_addTpBtn, &QPushButton::clicked, this, [this]() {
        const bool show = !m_mktTp->isVisible();
        m_mktTp->setVisible(show);
        m_addTpBtn->setText(show ? tr("TP") : tr("+ TP"));
        if (!show) m_mktTp->setValue(0.0);
        adjustSize();
    });

    auto* brRow = new QHBoxLayout;
    brRow->setSpacing(6);
    brRow->addWidget(m_addSlBtn);
    brRow->addWidget(m_mktSl, 1);
    brRow->addWidget(m_addTpBtn);
    brRow->addWidget(m_mktTp, 1);

    m_marginLbl = new QLabel;
    m_marginLbl->setStyleSheet(QString("color:%1; font-size:11px;"
                                       "font-family:Consolas,monospace;").arg(c.muted));

    m_mktSubmit = new QPushButton;
    m_mktSubmit->setMinimumHeight(40);
    m_mktSubmit->setCursor(Qt::PointingHandCursor);
    connect(m_mktSubmit, &QPushButton::clicked, this, [this]() {
        if (warnReadOnly()) return;
        accept();
    });

    auto* cancel = new QPushButton(tr("Cancel"));
    cancel->setMinimumHeight(40);
    connect(cancel, &QPushButton::clicked, this, &QDialog::reject);

    auto* actions = new QHBoxLayout;
    actions->setSpacing(8);
    actions->addWidget(cancel, 1);
    actions->addWidget(m_mktSubmit, 2);

    auto cap = [&](const QString& t) {
        auto* l = new QLabel(t);
        l->setStyleSheet(QString("color:%1; font-size:10px; font-weight:800;"
                                 "letter-spacing:1px;").arg(c.muted));
        return l;
    };

    auto* volHead = new QHBoxLayout;
    volHead->addWidget(cap(tr("VOLUME")));
    volHead->addStretch();
    volHead->addWidget(m_lotsBtn);
    volHead->addWidget(m_unitsBtn);

    auto* v = new QVBoxLayout(page);
    v->setSpacing(8);
    v->addLayout(tiles);
    v->addLayout(volHead);
    v->addLayout(volRow);
    v->addLayout(chips);
    v->addLayout(brRow);
    v->addWidget(m_marginLbl);
    v->addStretch(1);
    v->addLayout(actions);
    return page;
}

bool OrderDialog::unitsMode() const { return m_unitsBtn && m_unitsBtn->isChecked(); }

double OrderDialog::lotsFromInput() const {
    if (!m_mktVolume) return 0.0;
    const double shown = SpinInput::typedValue(m_mktVolume);   // see price()
    if (!unitsMode()) return shown;
    const double cs = m_spec.contractSize > 0 ? m_spec.contractSize : 100000.0;
    return shown / cs;
}

void OrderDialog::setMarketSide(const QString& side) {
    m_marketSide = side;
    refreshMarket();
}

void OrderDialog::refreshMarket() {
    const auto& c = Theme::p();
    const int digits = m_spec.digits > 0 ? m_spec.digits : 5;
    const bool buy = (m_marketSide == "buy");

    m_sellPrice->setText(m_bid > 0 ? QString::number(m_bid, 'f', digits) : QStringLiteral("—"));
    m_buyPrice->setText(m_ask > 0 ? QString::number(m_ask, 'f', digits) : QStringLiteral("—"));

    if (m_bid > 0 && m_ask > 0) {
        const double pts = (m_ask - m_bid) * std::pow(10.0, digits - 1);
        m_spreadLbl->setText(tr("%1\npips").arg(QString::number(pts, 'f', 1)));
    } else {
        m_spreadLbl->setText(QStringLiteral("—"));
    }

    // The unselected tile is dimmed rather than hidden: both prices stay
    // readable, which is the point of showing them side by side.
    auto paint = [&](QPushButton* b, const QString& colour, bool on) {
        b->setStyleSheet(QString(
            "QPushButton{background:%1; border:2px solid %2; border-radius:8px;}"
            "QPushButton:hover{background:%3;}")
            .arg(on ? colour : c.panelAlt, on ? colour : c.border, colour));
    };
    paint(m_sellTile, c.down, !buy);
    paint(m_buyTile,  c.up,   buy);

    // Same formula the b-book engine applies server-side:
    //   margin = lots * contractSize * fillPrice / leverage
    // Shown before the order goes out so a rejection for insufficient margin is
    // visible here rather than arriving as a server error.
    const double refPx = buy ? m_ask : m_bid;
    const double lots  = lotsFromInput();
    const double margin = (refPx > 0)
        ? lots * (m_spec.contractSize > 0 ? m_spec.contractSize : 100000.0) * refPx / double(m_leverage)
        : 0.0;
    const bool affordable = (m_freeMargin <= 0.0) || (margin <= m_freeMargin);
    m_marginLbl->setText(tr("Margin ≈ %1    Free %2")
                         .arg(QString::number(margin, 'f', 2),
                              QString::number(m_freeMargin, 'f', 2)));
    m_marginLbl->setStyleSheet(QString("color:%1; font-size:11px;"
                                       "font-family:Consolas,monospace;")
                               .arg(affordable ? c.muted : c.warn));

    m_mktSubmit->setText(buy ? tr("BUY %1").arg(m_spec.symbol)
                             : tr("SELL %1").arg(m_spec.symbol));
    m_mktSubmit->setStyleSheet(QString(
        "QPushButton{background:%1; color:#ffffff; border:none; border-radius:8px;"
        "font-weight:800; letter-spacing:1px;}"
        "QPushButton:disabled{background:%2; color:%3;}")
        .arg(buy ? c.up : c.down, c.btnBg, c.muted));
    // No quote yet means no price to fill against; the server would reject it.
    m_mktSubmit->setEnabled(refPx > 0.0);

    // Toggle styling lives here so a theme change repaints it with everything else.
    auto paintToggle = [&](QPushButton* b) {
        const bool on = b->isChecked();
        b->setStyleSheet(QString(
            "QPushButton{background:%1; color:%2; border:1px solid %3;"
            "border-radius:4px; padding:2px 10px; font-size:10px; font-weight:700;}")
            .arg(on ? c.accent : c.btnBg,
                 on ? QStringLiteral("#ffffff") : c.muted,
                 on ? c.accent : c.btnBorder));
    };
    paintToggle(m_lotsBtn);
    paintToggle(m_unitsBtn);
}

// ── Pending ────────────────────────────────────────────────────────
QWidget* OrderDialog::buildPendingTab() {
    const auto& c = Theme::p();
    auto* page = new QWidget;

    m_live = new QLabel;
    m_live->setStyleSheet(QString("color:%1; font-size:11px; font-family:Consolas,monospace;")
                          .arg(c.muted));

    m_side = new QComboBox;
    m_side->addItem(tr("BUY"),  "buy");
    m_side->addItem(tr("SELL"), "sell");

    m_type = new QComboBox;
    m_type->addItem(tr("Limit"), "limit");
    m_type->addItem(tr("Stop"),  "stop");

    m_lots  = new QDoubleSpinBox;
    m_price = new QDoubleSpinBox;

    auto mkBracket = [&]() {
        auto* s = new QDoubleSpinBox;
        s->setRange(0.0, 1e7);
        s->setSpecialValueText(tr("none"));   // 0 => not set
        s->setValue(0.0);
        return s;
    };
    m_sl = mkBracket();
    m_tp = mkBracket();
    SpinInput::freeTyping({m_lots, m_price, m_sl, m_tp});

    for (QWidget* w : {(QWidget*)m_side, (QWidget*)m_type, (QWidget*)m_lots,
                       (QWidget*)m_price, (QWidget*)m_sl, (QWidget*)m_tp})
        w->setMinimumHeight(32);

    auto cap = [&](const QString& t) {
        auto* l = new QLabel(t);
        l->setStyleSheet(QString("color:%1; font-size:10px; font-weight:800;"
                                 "letter-spacing:1px;").arg(c.muted));
        return l;
    };
    auto* form = new QGridLayout;
    form->setHorizontalSpacing(10);
    form->setVerticalSpacing(6);
    form->addWidget(cap(tr("SIDE")),   0, 0);  form->addWidget(cap(tr("TYPE")),  0, 1);
    form->addWidget(m_side,            1, 0);  form->addWidget(m_type,           1, 1);
    form->addWidget(cap(tr("VOLUME")), 2, 0);  form->addWidget(cap(tr("PRICE")), 2, 1);
    form->addWidget(m_lots,            3, 0);  form->addWidget(m_price,          3, 1);
    form->addWidget(cap(tr("STOP LOSS")), 4, 0); form->addWidget(cap(tr("TAKE PROFIT")), 4, 1);
    form->addWidget(m_sl,              5, 0);  form->addWidget(m_tp,             5, 1);

    m_hint = new QLabel;
    m_hint->setWordWrap(true);
    m_hint->setStyleSheet(QString("color:%1; font-size:11px;").arg(c.muted));

    auto* cancel = new QPushButton(tr("Cancel"));
    cancel->setMinimumHeight(36);
    connect(cancel, &QPushButton::clicked, this, &QDialog::reject);

    m_place = new QPushButton(tr("Place order"));
    m_place->setMinimumHeight(36);
    m_place->setCursor(Qt::PointingHandCursor);
    connect(m_place, &QPushButton::clicked, this, [this]() {
        if (warnReadOnly()) return;
        accept();
    });

    auto* actions = new QHBoxLayout;
    actions->setSpacing(8);
    actions->addWidget(cancel, 1);
    actions->addWidget(m_place, 1);

    auto* v = new QVBoxLayout(page);
    v->setSpacing(9);
    v->addWidget(m_live);
    v->addLayout(form);
    v->addWidget(m_hint);
    v->addStretch(1);
    v->addLayout(actions);

    for (QComboBox* b : {m_side, m_type})
        connect(b, &QComboBox::currentIndexChanged, this, [this]() { refreshHint(); });
    // textEdited as well as valueChanged: with tracking off the latter only
    // fires on commit, and the price validation is worth having while the
    // number is still being typed.
    connect(m_price, &QDoubleSpinBox::valueChanged, this, [this]() { refreshHint(); });
    SpinInput::onTyping(m_price, this, [this]() { refreshHint(); });
    return page;
}

void OrderDialog::refreshHint() {
    const auto& c = Theme::p();
    const int digits = m_spec.digits > 0 ? m_spec.digits : 5;
    const bool buy = side() == "buy";
    const bool limit = orderType() == "limit";
    const double ref = buy ? m_ask : m_bid;
    const double p = price();

    m_live->setText(tr("Bid %1   Ask %2")
                    .arg(m_bid > 0 ? QString::number(m_bid, 'f', digits) : QStringLiteral("—"),
                         m_ask > 0 ? QString::number(m_ask, 'f', digits) : QStringLiteral("—")));

    // A limit buys below the market and a stop buys above it (mirrored for a
    // sell). Getting this backwards is the single most common way a pending
    // order is rejected, so it is stated before the order is sent rather than
    // coming back as a server error.
    const bool wantBelow = (buy && limit) || (!buy && !limit);
    const bool ok = ref <= 0.0 || (wantBelow ? p < ref : p > ref);

    const QString rule = wantBelow ? tr("below") : tr("above");
    m_hint->setText(ok
        ? tr("A %1 %2 sits %3 the current %4 (%5).")
              .arg(buy ? tr("buy") : tr("sell"), limit ? tr("limit") : tr("stop"), rule,
                   buy ? tr("ask") : tr("bid"), QString::number(ref, 'f', digits))
        : tr("A %1 %2 must be %3 the current %4 (%5) — the server will reject this price.")
              .arg(buy ? tr("buy") : tr("sell"), limit ? tr("limit") : tr("stop"), rule,
                   buy ? tr("ask") : tr("bid"), QString::number(ref, 'f', digits)));
    m_hint->setStyleSheet(QString("color:%1; font-size:11px;").arg(ok ? c.muted : c.warn));

    m_place->setStyleSheet(QString(
        "QPushButton{background:%1; color:#ffffff; border:none; border-radius:8px;"
        "font-weight:800;}"
        "QPushButton:hover{background:%2;}")
        .arg(buy ? c.up : c.down, buy ? c.up : c.down));
}

// ── Shared ─────────────────────────────────────────────────────────
void OrderDialog::applySymbol(const QString& symbol) {
    if (!m_specs.contains(symbol)) return;
    m_applying = true;

    m_spec = m_specs.value(symbol);
    const Quote q = m_quotes.value(symbol);
    m_bid = q.bid;
    m_ask = q.ask;

    setWindowTitle(tr("Order — %1").arg(m_spec.symbol));
    if (m_symbolBox->currentText() != symbol) m_symbolBox->setCurrentText(symbol);
    m_leverageLbl->setText(tr("🔒 1:%1").arg(m_leverage));

    const int digits = m_spec.digits > 0 ? m_spec.digits : 5;
    const double step = std::pow(10.0, -digits + 1);
    const double minLot = m_spec.minLot > 0 ? m_spec.minLot : 0.01;
    const double maxLot = m_spec.maxLot > 0 ? m_spec.maxLot : 100.0;
    const double lotStep = m_spec.lotStep > 0 ? m_spec.lotStep : 0.01;
    const double cs = m_spec.contractSize > 0 ? m_spec.contractSize : 100000.0;

    // Market volume follows the Lots/Units toggle; everything else is in lots.
    if (unitsMode()) {
        m_mktVolume->setDecimals(0);
        m_mktVolume->setRange(minLot * cs, maxLot * cs);
        m_mktVolume->setSingleStep(lotStep * cs);
        if (m_mktVolume->value() < m_mktVolume->minimum()) m_mktVolume->setValue(minLot * cs);
    } else {
        m_mktVolume->setDecimals(2);
        m_mktVolume->setRange(minLot, maxLot);
        m_mktVolume->setSingleStep(lotStep);
        if (m_mktVolume->value() < minLot) m_mktVolume->setValue(minLot);
    }

    for (QDoubleSpinBox* s : {m_mktSl, m_mktTp, m_sl, m_tp, m_price}) {
        s->setDecimals(digits);
        s->setSingleStep(step);
        // The range belongs here, with the rest of the per-instrument setup,
        // and not in whichever lambda happened to build the widget.
        //
        // m_price was constructed bare and never given one, so it kept Qt's
        // default maximum of 99.99. setValue(4341.94) silently clamped to
        // 99.99, and the validator rejected any third integer digit — which is
        // precisely the "only 2 digits are allowed, for all the symbols" the
        // desk reported, on every instrument, for as long as this dialog has
        // existed. Set for every price-like field so the next one added cannot
        // inherit the same default by omission.
        s->setRange(0.0, 1e7);
    }
    // Brackets are cleared on every instrument change, for the same reason the
    // one-click strip clears them: a level typed for gold is nonsense on a
    // currency pair, and silently carrying it into the next order is how a
    // 4255 stop loss ended up on AUDUSD. Collapse the market tab's rows back
    // to "+ SL" / "+ TP" so the next order starts clean.
    for (QDoubleSpinBox* s : {m_mktSl, m_mktTp, m_sl, m_tp}) s->setValue(0.0);
    if (m_mktSl->isVisible()) { m_mktSl->setVisible(false); m_addSlBtn->setText(tr("+ SL")); }
    if (m_mktTp->isVisible()) { m_mktTp->setVisible(false); m_addTpBtn->setText(tr("+ TP")); }
    m_lots->setDecimals(2);
    m_lots->setRange(minLot, maxLot);
    m_lots->setSingleStep(lotStep);
    if (m_lots->value() < minLot) m_lots->setValue(minLot);

    // Seeded from the side's own side of the book — the price this order would
    // actually fill against.
    m_price->setValue(m_ask > 0 ? m_ask : m_bid);

    m_applying = false;
    refreshAll();
}

void OrderDialog::refreshAll() {
    refreshMarket();
    refreshHint();
}

void OrderDialog::updateQuote(const Quote& q) {
    if (!q.valid) return;
    m_quotes.insert(q.symbol, q);          // keeps a symbol switch current
    if (q.symbol != m_spec.symbol) return;
    m_bid = q.bid;
    m_ask = q.ask;
    refreshAll();
}

QString OrderDialog::symbol() const { return m_spec.symbol; }

QString OrderDialog::mode() const {
    return m_tabs->currentIndex() == 0 ? QStringLiteral("market")
                                       : QStringLiteral("pending");
}

void OrderDialog::setReadOnly(bool on) {
    m_readOnly = on;
    if (!on) return;
    const QString hint = tr("Investor mode — read-only. Trading and deposits are disabled.");
    for (QWidget* w : { static_cast<QWidget*>(m_mktSubmit), static_cast<QWidget*>(m_place) })
        if (w) w->setToolTip(hint);
}

// Raises the warning and reports whether the caller must stop.
bool OrderDialog::warnReadOnly() {
    if (!m_readOnly) return false;
    Toast::error(this, tr("Investor mode"),
                 tr("This is a read-only investor login — the order was not placed."));
    return true;
}

QString OrderDialog::side() const {
    return mode() == "market" ? m_marketSide : m_side->currentData().toString();
}

QString OrderDialog::orderType() const { return m_type->currentData().toString(); }

double OrderDialog::lots() const {
    return mode() == "market" ? lotsFromInput() : SpinInput::typedValue(m_lots);
}

// typedValue rather than value(): keyboardTracking is off on these fields, so
// value() only catches up on Enter or focus-out. The hint has to judge the
// price the trader is typing, and the order has to be placed at it.
double OrderDialog::price() const { return SpinInput::typedValue(m_price); }

double OrderDialog::stopLoss() const {
    return SpinInput::typedValue(mode() == "market" ? m_mktSl : m_sl);
}

double OrderDialog::takeProfit() const {
    return SpinInput::typedValue(mode() == "market" ? m_mktTp : m_tp);
}
