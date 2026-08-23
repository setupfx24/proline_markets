#pragma once
// Numeric-input helpers shared by the order/bracket dialogs.
//
// QDoubleSpinBox defaults to keyboardTracking = true, which re-interprets the
// text on EVERY keystroke: it validates the half-finished number, clamps it to
// the range, rewrites the field to a canonical form and leaves the cursor at
// the end. On a 5-digit price that leaves only the trailing characters
// realistically editable — reported from the desk as "only 2 digit we can
// change" while trying to retype 4438.50 over 4241.81.
//
// freeTyping() turns tracking off, which fixes the typing but moves
// valueChanged to the commit (Enter, focus-out, or a step). That opens a second
// hole in any dialog whose confirm button is enabled from that signal: a
// disabled button does not accept the mouse press, so clicking it never takes
// focus off the spin box, the text is never committed, and the button can never
// enable — the trader is stuck. typedValue() + onTyping() close it by working
// from what is on screen rather than from the last committed value.

#include <QDoubleSpinBox>
#include <QEvent>
#include <QKeyEvent>
#include <QLineEdit>
#include <QLocale>
#include <QObject>
#include <QString>
#include <QPointer>
#include <QtGlobal>
#include <initializer_list>
#include <utility>

namespace SpinInput {

// An empty bracket field reads "none" — QDoubleSpinBox::specialValueText, shown
// in place of the minimum. It looks editable and is not: typing a digit onto it
// produces "none4", the validator rejects that as not a number, and the
// keystroke is dropped. The trader clicks into Take Profit, types, and nothing
// happens.
//
// So the first digit typed onto the special text empties the field and is then
// allowed through to land in it. Only digits and the decimal separator trigger
// this — arrows, Tab and the like must still behave normally, and Backspace on
// an already-empty field should stay a no-op rather than look like an edit.
//
// The same filter also selects the whole value when the field takes focus,
// which is the fix for the complaint this file exists for.
//
// A price field is seeded with the live ask — "4322.14" is already sitting
// there. A trader clicks into it and types, and the cursor is wherever they
// clicked, so the digits are INSERTED into that number rather than replacing
// it. Click at the end of "111.429" and the first keystroke makes "111.4291",
// a fourth decimal the validator rejects; every keystroke after it is rejected
// the same way and the field looks dead. Click in the middle and you get
// "4324322.14". Only a trader who selects the text first — which nothing tells
// them to do — can type a price at all.
//
// Selecting on focus makes the obvious action the working one: click, type the
// price, done. A second click inside the now-focused field still places a caret
// for editing one digit, so nothing is taken away.
class TypingHelper : public QObject {
public:
    explicit TypingHelper(QDoubleSpinBox* box) : QObject(box), m_box(box) {}

protected:
    bool eventFilter(QObject* watched, QEvent* event) override {
        auto* le = qobject_cast<QLineEdit*>(watched);
        if (!le) return false;

        if (event->type() == QEvent::FocusIn) {
            // Queued, not immediate: the mouse press that gave the field focus
            // is delivered after this event and would collapse the selection
            // back to a caret. A posted metacall runs on the next pass of the
            // loop, after that press has been handled.
            //
            // No hasFocus() guard. It looks like the careful thing to write and
            // it silently disables the whole fix wherever the top-level window
            // is not active — which is how this went out once already. Selecting
            // in a field that lost focus in the meantime is harmless: the
            // selection is not even painted, and the next focus re-selects.
            // QPointer only because the metacall outlives this event.
            QPointer<QLineEdit> guard(le);
            QMetaObject::invokeMethod(le, [guard]() {
                if (guard) guard->selectAll();
            }, Qt::QueuedConnection);
            return false;
        }

        if (event->type() != QEvent::KeyPress) return false;
        if (m_box->specialValueText().isEmpty()) return false;
        if (le->text() != m_box->specialValueText()) return false;

        // decimalPoint() is a QString in Qt 6, so it is compared as one; the
        // bare '.' is accepted too because that is what the numeric keypad
        // sends under a locale that separates with a comma.
        const QString typed = static_cast<QKeyEvent*>(event)->text();
        if (typed.isEmpty()) return false;
        if (!typed.at(0).isDigit() && typed != QLocale().decimalPoint()
            && typed != QLatin1String("."))
            return false;

        le->clear();       // false, not true: the keystroke still has to be
        return false;      // delivered — it is the value being typed.
    }

private:
    QDoubleSpinBox* m_box;
};

inline void freeTyping(std::initializer_list<QDoubleSpinBox*> boxes) {
    for (QDoubleSpinBox* b : boxes) {
        if (!b) continue;

        // Tripwire for the bug that caused all of this. QDoubleSpinBox defaults
        // to a maximum of 99.99, and a price field built bare and never given a
        // range keeps it: setValue(4341.94) clamps to 99.99 and the validator
        // refuses a third integer digit. It presents as "only 2 digits are
        // allowed" on every instrument and looks like a typing bug, which cost
        // two wrong diagnoses before the clamped 99.99 gave it away. Nothing in
        // this application legitimately tops out at 99.99, so say so loudly
        // rather than clamping a price in silence.
        if (b->maximum() == 99.99)
            qWarning("SpinInput: %s still has Qt's default 0.00-99.99 range — "
                     "give it setRange(); prices above 99.99 will be clamped",
                     qPrintable(b->objectName().isEmpty() ? QStringLiteral("a spin box")
                                                          : b->objectName()));

        b->setKeyboardTracking(false);
        // Installed unconditionally and checked at event time, so it does not
        // matter whether setSpecialValueText() has been called yet.
        if (QLineEdit* le = b->findChild<QLineEdit*>())
            le->installEventFilter(new TypingHelper(b));
    }
}

// QAbstractSpinBox::lineEdit() is protected, so the editor is fetched as a
// child instead. Every spin box built here is editable and therefore has one.
inline QLineEdit* editor(const QDoubleSpinBox* box) {
    return box->findChild<QLineEdit*>();
}

// What the field shows right now, committed or not. Prefix and suffix are
// stripped the way the box itself would. Text that is not yet a number — empty,
// a lone "-", or the specialValueText — reads as the minimum, which on every
// bracket field here is the "none" value.
inline double typedValue(const QDoubleSpinBox* box) {
    QLineEdit* le = editor(box);
    if (!le) return box->value();
    QString t = le->text().trimmed();
    if (!box->prefix().isEmpty() && t.startsWith(box->prefix())) t = t.mid(box->prefix().size());
    if (!box->suffix().isEmpty() && t.endsWith(box->suffix()))   t.chop(box->suffix().size());
    bool ok = false;
    const double v = QLocale().toDouble(t.trimmed(), &ok);
    if (!ok) return box->minimum();
    return qBound(box->minimum(), v, box->maximum());
}

// Run `fn` on every keystroke, not only on commit — see the note above.
template <typename F>
inline void onTyping(QDoubleSpinBox* box, QObject* ctx, F&& fn) {
    if (QLineEdit* le = editor(box))
        QObject::connect(le, &QLineEdit::textEdited, ctx, std::forward<F>(fn));
}

} // namespace SpinInput
