#pragma once
#include <QWidget>
#include <QList>
#include "core/Models.h"

QT_BEGIN_NAMESPACE
class QDoubleSpinBox;
class QPushButton;
class QLabel;
QT_END_NAMESPACE

// MT5-style one-click trading strip, floated over the top-left of the chart:
//
//     [ SELL 1.24995 ] [ 1.00 ] [ BUY 1.25010 ]
//     ⌄ S/L [      ]  T/P [      ]      Close all
//
// The volume field has no spin buttons: they cost width on a strip that sits on
// top of the chart, and the wheel plus the up/down keys already step it.
//
// The two price tiles ARE the action buttons (SELL fills at bid, BUY at ask).
// The S/L / T/P row is collapsed by default — MT5 keeps one-click trading to a
// single row, and brackets are normally dragged straight onto the chart by the
// position overlay. The row is still here because typed entry is a real feature
// of this terminal, it is just out of the way until asked for.
class OrderTicket : public QWidget {
    Q_OBJECT
public:
    explicit OrderTicket(QWidget* parent = nullptr);

    void setSymbolSpec(const SymbolSpec& spec);

    // Read-only investor session: the strip stays exactly as it is — same
    // tiles, same prices, still clickable — but every control explains on
    // hover why pressing it will not place anything. MainWindow raises the
    // warning when it is pressed.
    void setReadOnly(bool on);

public slots:
    void updateQuote(const Quote& q);   // only applied if it matches current symbol
    void applyTheme();

protected:
    // A plain QWidget subclass ignores `background`/`border` from a style sheet
    // unless it draws PE_Widget itself. Without this the strip is invisible
    // chrome floating on the candles.
    void paintEvent(QPaintEvent* e) override;

signals:
    void buy(const QString& symbol, double volume, double sl, double tp);
    void sell(const QString& symbol, double volume, double sl, double tp);
    void closeAll(const QString& symbol);
    // The strip has no parent layout — it is positioned by hand over the chart
    // — so nothing notices when its size hint changes. Raised when the tiles
    // are re-sized for a new symbol, so the host can re-run its placement
    // instead of leaving the strip at a width that clips the price.
    void sizeHintChanged();

private:
    // A price tile: SELL/BUY caption over the live price, whole thing clickable.
    struct Tile {
        QPushButton* btn = nullptr;
        QLabel*      caption = nullptr;
        QLabel*      price = nullptr;
    };
    Tile makeTile(const QString& caption);
    void styleTile(const Tile& t, const QString& base, const QString& hover);
    // Width a tile needs to show `sample` in full, from the price label's own
    // font metrics rather than a hard-coded pixel guess.
    int  tileWidthFor(const QString& sample) const;

    SymbolSpec m_spec;
    int    m_digits = 5;
    bool   m_readOnly = false;

    QLabel*         m_spreadLabel;
    Tile            m_sell;
    Tile            m_buy;
    QDoubleSpinBox* m_volume;
    QDoubleSpinBox* m_sl;
    QDoubleSpinBox* m_tp;
    QPushButton*    m_closeBtn;
    QPushButton*    m_moreBtn;      // reveals the S/L / T/P row
    QWidget*        m_bracketRow;
    QList<QLabel*>  m_formLabels;
};
