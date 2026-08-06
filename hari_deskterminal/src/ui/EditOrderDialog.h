#pragma once
#include <QDialog>
#include "core/Models.h"

class QLabel;
class QDoubleSpinBox;
class QPushButton;

// Edits a PENDING order in place — price, volume and the brackets.
//
// The server allows exactly this set (PUT /orders/{id} takes price, lots,
// stop_loss, take_profit) and refuses anything whose status is no longer
// "pending". Side and type are therefore shown but not editable: changing a
// buy limit into a sell stop is a different order, and the honest way to do
// that is cancel and place again.
//
// Separate from OrderDialog rather than a mode on it: that one composes a new
// order from nothing, this one amends an existing row and has to seed every
// field from it. Folding both into one dialog meant a constructor that took an
// optional order and half its widgets meaning two things.
class EditOrderDialog : public QDialog {
    Q_OBJECT
public:
    EditOrderDialog(const PendingOrder& order, const SymbolSpec& spec,
                    double bid, double ask, QWidget* parent = nullptr);

    double price() const;
    double lots() const;
    double stopLoss() const;     // 0 => remove
    double takeProfit() const;

    // True when the field differs from what the order already holds. Only
    // changed fields are sent: the endpoint treats an omitted field as "leave
    // alone", so sending everything would rewrite values the user never
    // touched with whatever the dialog happened to round them to.
    bool priceChanged() const;
    bool lotsChanged() const;
    bool slChanged() const;
    bool tpChanged() const;

private:
    void refreshHint();

    PendingOrder m_order;
    SymbolSpec   m_spec;
    double m_bid, m_ask;

    QDoubleSpinBox* m_price;
    QDoubleSpinBox* m_lots;
    QDoubleSpinBox* m_sl;
    QDoubleSpinBox* m_tp;
    QLabel*         m_hint;
    QPushButton*    m_save;
};
