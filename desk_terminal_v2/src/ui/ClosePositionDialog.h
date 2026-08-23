#pragma once
#include <QDialog>
#include "core/Models.h"

class QLabel;
class QDoubleSpinBox;
class QPushButton;

// "Close Position" — the desktop counterpart of the web terminal's dialog:
// the position's details, quick 25 / 50 / 75 / FULL buttons, an editable lot
// box and the estimated P/L for the slice being closed.
//
// Partial closes go to the same POST /positions/{id}/close endpoint with a
// "lots" field; leaving it out closes the whole position.
class ClosePositionDialog : public QDialog {
    Q_OBJECT
public:
    // step/minLot come from the instrument spec so the lot box can only produce
    // a size the venue will actually accept.
    ClosePositionDialog(const OpenPosition& pos, double lotStep, double minLot,
                        QWidget* parent = nullptr);

    // Lots the user chose. Equal to the position size when it is a full close;
    // callers should pass 0 to the API in that case, not this value.
    double lotsToClose() const;
    bool   isFullClose() const;

private:
    void setPercent(int pct);
    void refresh();          // est. P/L + which quick button reads as selected

    OpenPosition m_pos;
    double m_step;
    double m_min;
    QDoubleSpinBox* m_lots;
    QLabel*  m_estPl;
    QPushButton* m_quick[4] = {nullptr, nullptr, nullptr, nullptr};
    QPushButton* m_confirm;
};
