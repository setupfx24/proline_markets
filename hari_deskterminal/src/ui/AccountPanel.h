#pragma once
#include <QWidget>
#include <QHash>
#include "core/Models.h"

QT_BEGIN_NAMESPACE
class QLabel;
class QPushButton;
QT_END_NAMESPACE

// MT5's account line: a single strip under the trade blotter reading
//
//   Balance: 100 000.00 USD   Equity: 100 006.03   Margin: 3 311.40
//   Free margin: 96 694.63    Margin level: 3 020.05 %
//
// Each figure is a caption + value pair; the money values are masked when
// privacy mode is on. Replaces the old right-hand summary card — MT5 keeps
// this information on one line and gives the space back to the chart.
class AccountPanel : public QWidget {
    Q_OBJECT
public:
    explicit AccountPanel(QWidget* parent = nullptr);

public slots:
    void setAccount(const AccountInfo& a);
    // Unrealised P/L of every open position, summed. Pushed in by MainWindow
    // from the same positions snapshot the blotter renders, so the strip can
    // never disagree with the Profit column above it.
    void setFloatingPL(double pl, int openPositions);
    void setPrivacy(bool on);     // mask the money figures
    void clear();                 // blank every figure (used on log out)
    void applyTheme();

protected:
    // See OrderTicket::paintEvent — style-sheet backgrounds on a QWidget
    // subclass need PE_Widget drawn explicitly.
    void paintEvent(QPaintEvent* e) override;

signals:
    void refreshRequested();

private:
    // Adds one "Caption: value" pair to the strip and returns the value label.
    QLabel* addField(class QHBoxLayout* row, const QString& caption, const QString& key);

    QHash<QString, QLabel*> m_values;
    QHash<QString, QLabel*> m_keys;    // captions, restyled on theme change
    void renderFloating();

    QPushButton* m_refresh;
    AccountInfo  m_last;   // re-rendered when privacy/theme flips
    double m_floating = 0.0;
    int    m_openCount = 0;
    bool   m_hasFloating = false;   // no positions polled yet -> show a dash
    bool m_privacy = false;
};
