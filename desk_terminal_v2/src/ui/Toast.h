#pragma once
#include <QFrame>

class QLabel;
class QTimer;
class QGraphicsOpacityEffect;

// A small in-app notification card that fades into the top-right corner of a
// window, holds for a few seconds and fades out again.
//
// It exists for events the trader must not miss but that must not interrupt
// them with a modal box either — a completed wallet transfer, a rejected one.
// The status label inside a dialog is easy to miss (and scrolls off when the
// dialog reloads its numbers); a toast is not.
//
// A toast is a child of the window it is anchored to, so one raised from a
// modal dialog paints above that dialog instead of behind it. Pass any widget
// as the anchor — the toast attaches itself to that widget's top-level window.
// Several toasts stack downwards and re-stack when one expires or the window
// is resized. Clicking a toast dismisses it early.
class Toast : public QFrame {
    Q_OBJECT
public:
    enum class Kind { Success, Error, Info };

    static void post(QWidget* anchor, Kind kind, const QString& title,
                     const QString& body = QString(), int msec = 5000);

    static void success(QWidget* anchor, const QString& title, const QString& body = QString());
    static void error  (QWidget* anchor, const QString& title, const QString& body = QString());
    static void info   (QWidget* anchor, const QString& title, const QString& body = QString());

protected:
    void mousePressEvent(QMouseEvent* e) override;
    bool eventFilter(QObject* o, QEvent* e) override;

private:
    Toast(QWidget* host, Kind kind, const QString& title, const QString& body, int msec);

    void applyTheme();
    void dismiss();
    static void restack(QWidget* host);

    Kind    m_kind;
    QFrame* m_stripe;
    QLabel* m_icon;
    QLabel* m_title;
    QLabel* m_body;
    QGraphicsOpacityEffect* m_fade;
    QTimer* m_life;
};
