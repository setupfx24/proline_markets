#pragma once
#include <QWidget>
#include "core/Models.h"

class QTabWidget;
class QTableWidget;

// Bottom panel with three tabs — Open Positions (live P/L), Pending orders,
// and closed-trade History. Data is pushed in by MainWindow (which polls the
// REST endpoints). A per-row Close button on open positions emits closeSymbol.
class PositionsPanel : public QWidget {
    Q_OBJECT
public:
    explicit PositionsPanel(QWidget* parent = nullptr);

public slots:
    void setPositions(const QVector<OpenPosition>& positions);
    void setOrders(const QVector<PendingOrder>& orders);
    void setHistory(const QVector<HistoryTrade>& history);

    void setCollapsed(bool collapsed);           // driven by the dock title-bar toggle
    bool isCollapsed() const { return m_collapsed; }

signals:
    void closeSymbol(const QString& symbol);   // close all positions for a symbol

private:
    QTabWidget*   m_tabs;
    QTableWidget* m_posTable;
    QTableWidget* m_orderTable;
    QTableWidget* m_histTable;
    bool m_collapsed = false;
    int  m_expandedHeight = 180;
};
