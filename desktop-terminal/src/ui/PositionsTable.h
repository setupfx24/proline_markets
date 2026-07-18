#pragma once

#include <QWidget>
#include <QList>

#include "models/Position.h"

class Api;
class QTableWidget;
class QLabel;

// Open-positions grid with live PnL. Refreshed wholesale via setPositions()
// (the shell polls every ~1.5s and on trade events). Supports full-close and
// SL/TP modify on the selected row.
class PositionsTable : public QWidget
{
    Q_OBJECT
public:
    explicit PositionsTable(Api *api, QWidget *parent = nullptr);

    void setPositions(const QList<Position> &positions);

signals:
    void refreshRequested();
    void actionResult(bool ok, const QString &message);

private slots:
    void closeSelected();
    void modifySelected();

private:
    Position *selectedPosition();

    Api *m_api;
    QTableWidget *m_table = nullptr;
    QLabel *m_totalPnl = nullptr;
    QList<Position> m_positions;
};
