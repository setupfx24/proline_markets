#pragma once
#include <QWidget>
#include <QHash>
#include "core/Models.h"

QT_BEGIN_NAMESPACE
class QLabel;
QT_END_NAMESPACE

// Read-only account summary: balance, equity, margin, etc.
class AccountPanel : public QWidget {
    Q_OBJECT
public:
    explicit AccountPanel(QWidget* parent = nullptr);

public slots:
    void setAccount(const AccountInfo& a);

signals:
    void refreshRequested();

private:
    QLabel* valueLabel(const QString& key);
    QHash<QString, QLabel*> m_values;
    QLabel* m_headline;   // account no + demo/live badge
};
