#pragma once
#include <QDialog>
#include <QHash>
#include "core/Models.h"

class QLabel;
class QComboBox;
class QDoubleSpinBox;
class QPushButton;
class QTabWidget;

// The terminal's order window: Market and Pending in one dialog, laid out like
// the web platform's ticket so a trader moving between the two is not
// relearning where anything is.
//
// This replaces the old PendingOrderDialog, which could only place limit/stop
// orders. Market orders were reachable only from the one-click strip floating
// over the chart — and that strip is hidden whenever "Show trade panel" is off,
// which is how "we can't find the order window" happened in the first place.
// Order entry now has one obvious home, on F9 (the MT5 key traders expect) and
// on a double-click in Market Watch.
//
// Why one dialog with two tabs rather than two dialogs: the fields overlap
// almost entirely (symbol, volume, SL, TP) and only price/type differ, so the
// tab keeps the shared state when a trader changes their mind about how to
// enter — switching tabs does not lose the volume and brackets already typed.
//
// The dialog stays live while it is open: MainWindow feeds it ticks, so the
// prices, margin estimate and pending-price validation track the market. A
// market order confirmed against a frozen quote is a fill at a price the
// trader never actually saw.
//
// It takes the WHOLE symbol table rather than one spec because the instrument
// is switchable from inside the window (as on the web). Closing the dialog to
// change your mind about which instrument to trade is a pointless round trip.
class OrderDialog : public QDialog {
    Q_OBJECT
public:
    OrderDialog(const QHash<QString, SymbolSpec>& specs,
                const QHash<QString, Quote>& quotes,
                const QString& symbol,
                int leverage, double freeMargin, QWidget* parent = nullptr);

    QString symbol() const;      // may differ from the one it opened on
    QString mode() const;        // "market" | "pending"  — which tab was used
    QString side() const;        // "buy" | "sell"
    QString orderType() const;   // "limit" | "stop"      — pending tab only
    double  lots() const;        // always LOTS, whatever the Lots/Units toggle shows
    double  price() const;       // pending tab only
    double  stopLoss() const;    // 0 => not set
    double  takeProfit() const;

public slots:
    // Fed from PriceStream while the dialog is open.
    void updateQuote(const Quote& q);

private:
    QWidget* buildHeader();
    QWidget* buildMarketTab();
    QWidget* buildPendingTab();
    void     applySymbol(const QString& symbol);   // re-spec every field
    void     setMarketSide(const QString& side);
    void     refreshMarket();     // tiles, margin estimate, action button
    void     refreshHint();       // pending-price validation
    void     refreshAll();

    // Volume is entered in lots or in units (lots x contract size). Only lots
    // ever leave this dialog; units is a display convenience for instruments
    // whose lot is an awkward number of the underlying.
    bool     unitsMode() const;
    double   lotsFromInput() const;

    QHash<QString, SymbolSpec> m_specs;
    QHash<QString, Quote>      m_quotes;
    SymbolSpec m_spec;
    double m_bid = 0.0;
    double m_ask = 0.0;
    int    m_leverage = 100;
    double m_freeMargin = 0.0;
    // Guards applySymbol() against the currentTextChanged it triggers itself.
    bool   m_applying = false;

    QTabWidget* m_tabs = nullptr;
    QComboBox*  m_symbolBox = nullptr;
    QLabel*     m_leverageLbl = nullptr;

    // ── Market tab ──
    QString         m_marketSide = QStringLiteral("buy");
    QPushButton*    m_sellTile = nullptr;
    QPushButton*    m_buyTile  = nullptr;
    QLabel*         m_sellPrice = nullptr;
    QLabel*         m_buyPrice  = nullptr;
    QLabel*         m_spreadLbl = nullptr;
    QPushButton*    m_lotsBtn = nullptr;
    QPushButton*    m_unitsBtn = nullptr;
    QDoubleSpinBox* m_mktVolume = nullptr;
    QPushButton*    m_addSlBtn = nullptr;
    QPushButton*    m_addTpBtn = nullptr;
    QDoubleSpinBox* m_mktSl   = nullptr;
    QDoubleSpinBox* m_mktTp   = nullptr;
    QLabel*         m_marginLbl = nullptr;
    QPushButton*    m_mktSubmit = nullptr;

    // ── Pending tab ──
    QComboBox*      m_side  = nullptr;
    QComboBox*      m_type  = nullptr;
    QDoubleSpinBox* m_lots  = nullptr;
    QDoubleSpinBox* m_price = nullptr;
    QDoubleSpinBox* m_sl    = nullptr;
    QDoubleSpinBox* m_tp    = nullptr;
    QLabel*         m_hint  = nullptr;
    QLabel*         m_live  = nullptr;
    QPushButton*    m_place = nullptr;
};
