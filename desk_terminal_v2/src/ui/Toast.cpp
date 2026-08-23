#include "ui/Toast.h"
#include "ui/Theme.h"
#include <QLabel>
#include <QTimer>
#include <QPointer>
#include <QMouseEvent>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QGraphicsOpacityEffect>
#include <QPropertyAnimation>
#include <QList>

namespace {

constexpr int kMargin   = 18;   // gap to the window edge
constexpr int kGap      = 10;   // gap between stacked toasts
constexpr int kWidth    = 340;
constexpr int kFadeIn   = 160;
constexpr int kFadeOut  = 240;

// Live toasts in creation order. Entries are guarded pointers: a toast whose
// host window closes is destroyed with it, and the null slot is pruned on the
// next re-stack.
QList<QPointer<Toast>> g_live;

} // namespace

// --- construction -----------------------------------------------------------

Toast::Toast(QWidget* host, Kind kind, const QString& title, const QString& body, int msec)
    : QFrame(host), m_kind(kind) {
    setObjectName("toast");
    setAttribute(Qt::WA_DeleteOnClose);
    setCursor(Qt::PointingHandCursor);
    setFixedWidth(kWidth);

    m_stripe = new QFrame(this);
    m_stripe->setFixedWidth(4);

    m_icon = new QLabel(kind == Kind::Success ? QString::fromUtf8("✓")
                      : kind == Kind::Error   ? QString::fromUtf8("!")
                                              : QString::fromUtf8("i"));
    m_icon->setFixedWidth(18);
    m_icon->setAlignment(Qt::AlignTop | Qt::AlignHCenter);

    m_title = new QLabel(title);
    m_title->setWordWrap(true);

    m_body = new QLabel(body);
    m_body->setWordWrap(true);
    m_body->setVisible(!body.isEmpty());

    auto* text = new QVBoxLayout;
    text->setContentsMargins(0, 0, 0, 0);
    text->setSpacing(3);
    text->addWidget(m_title);
    text->addWidget(m_body);

    auto* row = new QHBoxLayout(this);
    row->setContentsMargins(0, 0, 14, 0);
    row->setSpacing(10);
    row->addWidget(m_stripe);
    row->addSpacing(2);
    row->addWidget(m_icon, 0, Qt::AlignTop);
    row->addLayout(text, 1);

    applyTheme();
    connect(Theme::notifier(), &Theme::Notifier::changed, this, &Toast::applyTheme);

    // Fade in, then hold for msec before fading out. Hovering does not pause
    // the timer: these carry a result the trader can re-read in the status bar,
    // not something that needs dwelling on.
    m_fade = new QGraphicsOpacityEffect(this);
    m_fade->setOpacity(0.0);
    setGraphicsEffect(m_fade);

    m_life = new QTimer(this);
    m_life->setSingleShot(true);
    m_life->setInterval(msec);
    connect(m_life, &QTimer::timeout, this, &Toast::dismiss);

    host->installEventFilter(this);
}

void Toast::post(QWidget* anchor, Kind kind, const QString& title,
                 const QString& body, int msec) {
    if (!anchor) return;
    QWidget* host = anchor->window();
    if (!host) return;

    auto* t = new Toast(host, kind, title, body, msec);
    g_live.append(QPointer<Toast>(t));

    t->adjustSize();
    restack(host);
    t->QWidget::show();
    t->raise();

    auto* in = new QPropertyAnimation(t->m_fade, "opacity", t);
    in->setDuration(kFadeIn);
    in->setStartValue(0.0);
    in->setEndValue(1.0);
    in->start(QAbstractAnimation::DeleteWhenStopped);

    t->m_life->start();
}

void Toast::success(QWidget* a, const QString& t, const QString& b) { post(a, Kind::Success, t, b); }
void Toast::error  (QWidget* a, const QString& t, const QString& b) { post(a, Kind::Error,   t, b, 8000); }
void Toast::info   (QWidget* a, const QString& t, const QString& b) { post(a, Kind::Info,    t, b); }

// --- look -------------------------------------------------------------------

void Toast::applyTheme() {
    const auto& c = Theme::p();
    const QString accent = m_kind == Kind::Success ? c.up
                         : m_kind == Kind::Error   ? c.down
                                                   : c.accent;

    setStyleSheet(QString(
        "QFrame#toast{background:%1; border:1px solid %2; border-radius:10px;}")
        .arg(c.panel, c.border));
    m_stripe->setStyleSheet(QString(
        "background:%1; border-top-left-radius:10px; border-bottom-left-radius:10px;")
        .arg(accent));
    m_icon->setStyleSheet(QString("background:transparent; color:%1; font-size:13px; "
                                  "font-weight:800; padding-top:12px;").arg(accent));
    m_title->setStyleSheet(QString("background:transparent; color:%1; font-size:12px; "
                                   "font-weight:700; padding-top:11px;").arg(c.textStrong));
    m_body->setStyleSheet(QString("background:transparent; color:%1; font-size:11px; "
                                  "padding-bottom:11px;").arg(c.muted));
    // A title-only toast needs the bottom padding the body would have carried.
    if (m_body->isHidden())
        m_title->setStyleSheet(m_title->styleSheet() + "padding-bottom:11px;");
}

// --- placement --------------------------------------------------------------

void Toast::restack(QWidget* host) {
    int y = kMargin;
    for (int i = g_live.size() - 1; i >= 0; --i)
        if (!g_live.at(i)) g_live.removeAt(i);

    for (const QPointer<Toast>& p : g_live) {
        if (!p || p->parentWidget() != host) continue;
        p->adjustSize();
        p->move(host->width() - p->width() - kMargin, y);
        p->raise();
        y += p->height() + kGap;
    }
}

bool Toast::eventFilter(QObject* o, QEvent* e) {
    if (o == parentWidget() && e->type() == QEvent::Resize)
        restack(parentWidget());
    return QFrame::eventFilter(o, e);
}

// --- dismissal --------------------------------------------------------------

void Toast::mousePressEvent(QMouseEvent* e) {
    Q_UNUSED(e);
    dismiss();
}

void Toast::dismiss() {
    if (!isVisible()) return;
    m_life->stop();

    QWidget* host = parentWidget();
    auto* out = new QPropertyAnimation(m_fade, "opacity", this);
    out->setDuration(kFadeOut);
    out->setStartValue(m_fade->opacity());
    out->setEndValue(0.0);
    connect(out, &QPropertyAnimation::finished, this, [this, host]() {
        close();                        // WA_DeleteOnClose
        if (host) restack(host);
    });
    out->start(QAbstractAnimation::DeleteWhenStopped);
}
