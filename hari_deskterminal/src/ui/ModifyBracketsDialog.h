#pragma once
#include <QDialog>
#include "core/Models.h"

class QLabel;
class QDoubleSpinBox;
class QPushButton;

// Edits Stop Loss / Take Profit on an open position.
//
// Until this existed the only way to move a bracket was to drag its line on
// the chart, which is why the blotter's S/L and T/P columns looked broken:
// they showed the levels but nothing let you change them.
//
// The two legs are sent SEPARATELY, and only when changed — the endpoint does
// a partial update, so posting an untouched leg from a snapshot that is up to
// four seconds old would quietly overwrite a level the server had already
// moved (a triggered SL, or a change made from another device).
class ModifyBracketsDialog : public QDialog {
    Q_OBJECT
public:
    ModifyBracketsDialog(const OpenPosition& pos, int digits, QWidget* parent = nullptr);

    bool   slChanged() const;
    bool   tpChanged() const;
    double stopLoss() const;      // 0 => remove the bracket
    double takeProfit() const;

private:
    void refreshHint();

    OpenPosition m_pos;
    double m_slWas;
    double m_tpWas;
    QDoubleSpinBox* m_sl;
    QDoubleSpinBox* m_tp;
    QLabel* m_hint;
    QPushButton* m_save;
};
