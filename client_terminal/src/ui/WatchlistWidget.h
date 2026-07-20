#pragma once
#include <QWidget>
#include <QHash>
#include "core/Models.h"

class QLineEdit;
class QPushButton;
class QVBoxLayout;
class QFrame;
class QLabel;

// Card-style live watchlist (like the web). Each instrument is a rounded card
// showing symbol + % change and Bid | spread-badge | Ask. Search + Market
// filter above.
class WatchlistWidget : public QWidget {
    Q_OBJECT
public:
    explicit WatchlistWidget(QWidget* parent = nullptr);

    void setSymbols(const QVector<SymbolSpec>& symbols);
    QString currentSymbol() const { return m_selected; }
    void selectSymbol(const QString& symbol);

public slots:
    void updateQuote(const Quote& q);

signals:
    void symbolActivated(const QString& symbol);

protected:
    bool eventFilter(QObject* obj, QEvent* ev) override;

private:
    struct Card {
        QFrame* frame = nullptr;
        QLabel* change = nullptr;
        QLabel* bid = nullptr;
        QLabel* ask = nullptr;
        QLabel* badge = nullptr;
        int     digits = 5;
        double  refBid = 0.0;
        bool    hasRef = false;
        double  lastBid = 0.0;
        QString group;
    };

    void openMarketMenu();
    void applyFilter();
    void setMarket(const QString& group);
    void restyleCard(const QString& symbol, bool selected);
    static QString marketGroup(const QString& category);

    QLineEdit*   m_search;
    QPushButton* m_marketBtn;
    QVBoxLayout* m_cardsLayout;

    QVector<SymbolSpec>        m_all;
    QString                    m_activeGroup;   // "" = all
    QString                    m_selected;
    QHash<QString, Card>       m_cards;
    QHash<QObject*, QString>   m_cardSymbol;    // frame -> symbol (for clicks)
};
