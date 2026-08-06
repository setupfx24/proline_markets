#include "ui/OrderTicket.h"
#include "ui/Theme.h"
#include <QDoubleSpinBox>
#include <QPushButton>
#include <QLabel>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QPainter>
#include <QStyle>
#include <QStyleOption>
#include <QFontMetrics>
#include <cmath>

// Small uppercase caption used beside the bracket inputs.
static QLabel* caption(const QString& text, QList<QLabel*>& sink) {
    auto* l = new QLabel(text);
    sink << l;
    return l;
}

OrderTicket::Tile OrderTicket::makeTile(const QString& cap) {
    Tile t;
    t.btn = new QPushButton;
    // Sized to sit inside the chart's toolbar band rather than hang below it.
    t.btn->setFixedHeight(32);
    // A floor, not a cap: wide enough for a 7-character price ("1.14088" /
    // "4096.95") at the tile's font size, and the layout still grows it for
    // longer ones like "65430.27" rather than eliding the price it exists to
    // show.
    t.btn->setMinimumWidth(48);
    t.btn->setCursor(Qt::PointingHandCursor);
    // No focus ring. The style sheet below already says border:none, but Fusion
    // paints the focus rectangle separately from the border property, so a
    // clicked tile kept a blue outline until something else took focus.
    // NoFocus is right for the strip on its own merits too: it floats over the
    // chart, and a one-click BUY should not pull keyboard focus off it.
    t.btn->setFocusPolicy(Qt::NoFocus);

    auto* v = new QVBoxLayout(t.btn);
    v->setContentsMargins(4, 1, 4, 2);
    v->setSpacing(0);
    t.caption = new QLabel(cap);
    t.caption->setAlignment(Qt::AlignCenter);
    t.price = new QLabel("—");
    t.price->setAlignment(Qt::AlignCenter);
    v->addWidget(t.caption);
    v->addWidget(t.price);

    // Clicks must reach the button, not the labels sitting on top of it.
    for (QWidget* w : t.btn->findChildren<QWidget*>())
        w->setAttribute(Qt::WA_TransparentForMouseEvents, true);
    return t;
}

void OrderTicket::styleTile(const Tile& t, const QString& base, const QString& hover) {
    // padding:0 — the global sheet gives every QPushButton 4px/10px, which on
    // these tiles is dead space around a label that already carries its own
    // margins, and it made the strip ~40px wider than it needed to be.
    // outline:none on every state, not just the base rule. `border:none` alone
    // does not remove the focus ring — Qt draws that from the `outline`
    // property, and a pseudo-state selector (:focus) outranks the plain
    // QPushButton rule, so it has to be named explicitly or the ring survives.
    // setFocusPolicy(Qt::NoFocus) in makeTile() should already stop the button
    // ever being focused; this is the belt to that pair of braces, and it also
    // covers the ring some styles paint on :pressed.
    t.btn->setStyleSheet(QString(
        // Square, not rounded: a 3px radius leaves the card fill visible in the
        // four corners, which is the same light-outline artefact the zeroed
        // margins above exist to kill — just smaller.
        "QPushButton{background:%1; border:none; outline:none; border-radius:0; padding:0;}"
        "QPushButton:hover{background:%2; border:none; outline:none;}"
        "QPushButton:pressed{background:%1; border:none; outline:none;}"
        "QPushButton:focus{background:%1; border:none; outline:none;}"
        "QPushButton:disabled{background:%3; border:none; outline:none;}")
        .arg(base, hover, Theme::p().panelAlt));
    t.caption->setStyleSheet("background:transparent; color:rgba(255,255,255,0.88);"
                             "font-size:9px; font-weight:800; letter-spacing:0.8px;");
    t.price->setStyleSheet("background:transparent; color:#ffffff; font-size:11px;"
                           "font-weight:800; font-family:Consolas,monospace;");
}

OrderTicket::OrderTicket(QWidget* parent) : QWidget(parent) {
    // Opaque, bordered card — it floats over the chart canvas and has to stay
    // legible against candles of any colour.
    setAutoFillBackground(true);

    // No symbol label: the chart legend sits immediately to the left and already
    // names the symbol. Carrying it here only widened the strip until it
    // overlapped that legend text. The spread stays — nothing else shows it.
    m_spreadLabel = new QLabel("—");

    auto* headRow = new QHBoxLayout;
    headRow->setContentsMargins(0, 0, 0, 0);
    headRow->setSpacing(6);
    headRow->addWidget(m_spreadLabel);
    headRow->addStretch();

    // ── the two price tiles + the volume stepper between them ──
    m_sell = makeTile(tr("SELL"));
    m_buy  = makeTile(tr("BUY"));
    connect(m_sell.btn, &QPushButton::clicked, this, [this]() {
        emit sell(m_spec.symbol, m_volume->value(), m_sl->value(), m_tp->value());
    });
    connect(m_buy.btn, &QPushButton::clicked, this, [this]() {
        emit buy(m_spec.symbol, m_volume->value(), m_sl->value(), m_tp->value());
    });

    m_volume = new QDoubleSpinBox;
    m_volume->setDecimals(2);
    m_volume->setRange(0.01, 100.0);
    m_volume->setSingleStep(0.01);
    m_volume->setValue(0.10);
    m_volume->setAlignment(Qt::AlignCenter);
    m_volume->setButtonSymbols(QAbstractSpinBox::NoButtons);
    // 36px clipped "0.10" to "0.1(" — a spin box needs room for the caret and
    // frame on top of the digits.
    m_volume->setFixedWidth(42);
    // No spin buttons: the wheel and the up/down keys already step the value,
    // and on a strip that floats over the chart the width matters more.
    m_volume->setToolTip(tr("Volume in lots — scroll or use ↑ / ↓ to step"));

    auto* tiles = new QHBoxLayout;
    tiles->setContentsMargins(0, 0, 0, 0);
    // Flush, no gap. Any spacing here lets the card's own fill through between
    // the coloured tiles, and against a red or green block that thin light line
    // reads as a BORDER on the button rather than as the card behind it. Same
    // reason the row's horizontal margins are 0 in the outer layout below.
    tiles->setSpacing(0);
    tiles->addWidget(m_sell.btn);
    tiles->addWidget(m_volume);
    tiles->addWidget(m_buy.btn);

    // ── collapsible S/L + T/P row ──
    m_sl = new QDoubleSpinBox;
    m_tp = new QDoubleSpinBox;
    for (QDoubleSpinBox* s : {m_sl, m_tp}) {
        s->setDecimals(5);
        // Capped at 1e6 so the box does not size itself for a 10-digit value it
        // will never hold — no instrument here comes near it.
        s->setRange(0.0, 1e6);
        s->setSpecialValueText(tr("none"));   // 0 => none
        s->setAlignment(Qt::AlignCenter);
        s->setButtonSymbols(QAbstractSpinBox::NoButtons);
        s->setFixedWidth(84);
    }

    m_closeBtn = new QPushButton(tr("Close all"));
    m_closeBtn->setCursor(Qt::PointingHandCursor);
    m_closeBtn->setFocusPolicy(Qt::NoFocus);   // same focus-ring reason as the tiles
    m_closeBtn->setToolTip(tr("Close every open position for this symbol"));
    connect(m_closeBtn, &QPushButton::clicked, this, [this]() { emit closeAll(m_spec.symbol); });

    auto* brackets = new QHBoxLayout;
    brackets->setContentsMargins(0, 0, 0, 0);
    brackets->setSpacing(5);
    brackets->addWidget(caption(tr("S/L"), m_formLabels));
    brackets->addWidget(m_sl);
    brackets->addWidget(caption(tr("T/P"), m_formLabels));
    brackets->addWidget(m_tp);
    brackets->addStretch();
    brackets->addWidget(m_closeBtn);
    m_bracketRow = new QWidget;
    m_bracketRow->setLayout(brackets);
    m_bracketRow->hide();

    m_moreBtn = new QPushButton(QStringLiteral("⌄"));
    m_moreBtn->setFixedSize(18, 14);
    m_moreBtn->setCursor(Qt::PointingHandCursor);
    m_moreBtn->setFocusPolicy(Qt::NoFocus);    // same focus-ring reason as the tiles
    m_moreBtn->setToolTip(tr("Show S/L and T/P"));
    connect(m_moreBtn, &QPushButton::clicked, this, [this]() {
        const bool show = m_bracketRow->isHidden();
        m_bracketRow->setVisible(show);
        m_moreBtn->setText(show ? QStringLiteral("⌃") : QStringLiteral("⌄"));
        m_moreBtn->setToolTip(show ? tr("Hide S/L and T/P") : tr("Show S/L and T/P"));
        adjustSize();
    });
    headRow->addWidget(m_moreBtn);

    auto* lay = new QVBoxLayout(this);
    // Zero horizontal margin: 3px of card fill down each side of the tile row
    // was the "border" on the BUY/SELL buttons. The card still shows above the
    // tiles (behind the spread label) and below (behind the S/L / T/P row),
    // which is where it is actually wanted — it is only against the coloured
    // tiles that it reads as an outline.
    lay->setContentsMargins(0, 2, 0, 0);
    lay->setSpacing(2);
    lay->addLayout(headRow);
    lay->addLayout(tiles);
    lay->addWidget(m_bracketRow);

    setEnabled(false); // enabled once a symbol is chosen

    applyTheme();
    connect(Theme::notifier(), &Theme::Notifier::changed, this, &OrderTicket::applyTheme);
}

void OrderTicket::paintEvent(QPaintEvent*) {
    QStyleOption opt;
    opt.initFrom(this);
    QPainter p(this);
    style()->drawPrimitive(QStyle::PE_Widget, &opt, &p, this);
}

void OrderTicket::applyTheme() {
    const auto& c = Theme::p();

    // No outline. The card is still opaque — it floats over the chart canvas and
    // has to stay legible against candles of any colour — but the 1px border it
    // used to carry drew a hard box around the BUY/SELL tiles. In light mode the
    // card (#f4f5f7) sits on a white chart, so that border was the only thing
    // visible: the strip read as a framed widget stuck onto the chart rather
    // than part of the toolbar. The fill alone separates it well enough in both
    // themes, since neither panel colour matches its chart background.
    setStyleSheet(QString("OrderTicket{background:%1; border:none; border-radius:4px;}")
                  .arg(c.panel));
    // The global sheet paints every QWidget opaque; the inner container must be
    // transparent or it stamps a window-coloured block across the card.
    m_bracketRow->setStyleSheet("background:transparent;");
    m_spreadLabel->setStyleSheet(QString("background:transparent; color:%1; font-size:10px;"
                                         "font-weight:700;").arg(c.muted));

    styleTile(m_sell, c.down, Theme::isDark() ? "#f04148" : "#d92b38");
    styleTile(m_buy,  c.up,   Theme::isDark() ? "#2ec27e" : "#169342");

    for (QLabel* l : m_formLabels)
        l->setStyleSheet(QString("background:transparent; color:%1; font-size:10px;"
                                 "font-weight:700;").arg(c.muted));

    // Ghost chevron: a bordered box here read as a second frame stacked on the
    // card, which is most of what made the strip look boxed in. It only picks up
    // a background on hover.
    m_moreBtn->setStyleSheet(QString(
        "QPushButton{background:transparent; color:%1; border:none; border-radius:2px;"
        "font-size:8px; font-weight:800; padding:0;}"
        "QPushButton:hover{background:%2; color:%3;}")
        .arg(c.muted, c.btnHover, c.textStrong));

    const QString input = QString(
        "QDoubleSpinBox{background:%1; color:%2; border:1px solid %3; border-radius:3px;"
        "padding:3px 2px; font-size:11px; font-weight:700; font-family:Consolas,monospace;}"
        "QDoubleSpinBox:focus{border-color:%4;}")
        .arg(c.inputBg, c.textStrong, c.inputBorder, c.accent);
    m_volume->setStyleSheet(input);
    m_sl->setStyleSheet(input);
    m_tp->setStyleSheet(input);

    // Destructive — stays a quiet ghost button and only tints on hover, so a
    // mis-click next to BUY/SELL never looks inviting.
    m_closeBtn->setStyleSheet(QString(
        "QPushButton{background:transparent; color:%1; border:1px solid %2;"
        "border-radius:3px; font-size:10px; font-weight:700; padding:3px 8px;}"
        "QPushButton:hover{background:%3; color:%4; border-color:%4;}")
        .arg(c.muted, c.btnBorder,
             Theme::isDark() ? "rgba(224,27,36,0.16)" : "rgba(192,28,40,0.10)", c.down));
}

void OrderTicket::setSymbolSpec(const SymbolSpec& spec) {
    m_spec   = spec;
    m_digits = spec.digits;
    m_volume->setRange(spec.minLot, spec.maxLot);
    m_volume->setSingleStep(spec.lotStep);
    if (m_volume->value() < spec.minLot) m_volume->setValue(spec.minLot);
    m_sl->setDecimals(spec.digits);
    m_tp->setDecimals(spec.digits);
    m_sell.price->setText("—");
    m_buy.price->setText("—");
    m_spreadLabel->setText("—");
    // Re-floor for the new instrument rather than carrying the last one's
    // width: coming back to EURUSD from BTCUSD would otherwise leave the strip
    // sized for a six-figure price. Seeded from the digit count; the first
    // quote grows it further if the magnitude needs it.
    const int floorPx = tileWidthFor(QStringLiteral("0.").leftJustified(spec.digits + 2, '0'));
    m_sell.btn->setMinimumWidth(floorPx);
    m_buy.btn->setMinimumWidth(floorPx);
    adjustSize();
    emit sizeHintChanged();
    setEnabled(true);
}

void OrderTicket::updateQuote(const Quote& q) {
    if (q.symbol != m_spec.symbol) return;
    // SELL fills at the bid, BUY at the ask — each tile shows the price you get.
    m_sell.price->setText(QString::number(q.bid, 'f', m_digits));
    m_buy.price->setText(QString::number(q.ask, 'f', m_digits));
    const double points = q.spread * std::pow(10.0, m_digits - 1);
    m_spreadLabel->setText(QString::number(points, 'f', 1));

    // A price can outgrow the width the tiles were sized for — BTCUSD crossing
    // into six figures is the obvious case, and 64816.00 already clipped to
    // "4816.0" against the old 48px floor. Widen on demand and tell the host to
    // re-place the strip. Grow-only within a symbol: shrinking on every tick
    // would make the strip twitch as the last digit changes width.
    const int need = tileWidthFor(QString::number(q.ask, 'f', m_digits));
    if (need > m_sell.btn->minimumWidth()) {
        m_sell.btn->setMinimumWidth(need);
        m_buy.btn->setMinimumWidth(need);
        adjustSize();
        emit sizeHintChanged();
    }
}

int OrderTicket::tileWidthFor(const QString& sample) const {
    // Measured, not guessed. The old hard-coded 48px floor happened to be
    // almost exactly eight Consolas characters at this size, so an eight-digit
    // price fitted only if the button had no padding — which it does.
    const QFontMetrics fm(m_sell.price->font());
    // +2 characters of headroom: one for a digit the price may still gain, one
    // so the glyphs are not flush against the tile edge.
    return fm.horizontalAdvance(sample + "00") + 8;
}
