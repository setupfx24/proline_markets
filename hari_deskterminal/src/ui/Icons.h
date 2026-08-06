#pragma once
#include <QIcon>
#include <QPixmap>
#include <QPainter>
#include <QColor>
#include <QString>
#include <QByteArray>
#include <QGuiApplication>
#include <QSvgRenderer>

// Real vector icons, drawn from SVG path data and tinted to the caller's colour.
//
// History: these started as emoji (👁 / 🙈 / ☀ / 🌙), which Windows rendered with
// its own colour font — they ignored the theme and read as blobs at button size.
// Replacing them with hand-rolled QPainter shapes fixed the colour but the
// geometry was crude (the "settings" and "refresh" glyphs in particular) AND the
// pixmaps were rasterised at logical size, so on a 125% display they were
// upscaled and blurry.
//
// Now each icon is proper SVG in the 24px / 2px-stroke / round-cap convention,
// rendered through QSvgRenderer at the screen's device pixel ratio, so it stays
// sharp at any scaling and takes the palette colour exactly.
namespace Icons {

namespace detail {

constexpr double PI = 3.14159265358979323846;

// Stroke-based icons share one wrapper; %1 is substituted with the colour.
inline QString wrap(const QString& body) {
    return QStringLiteral(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' "
        "stroke='%1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>")
        + body + QStringLiteral("</svg>");
}

inline QIcon render(const QString& svgTemplate, const QColor& color, int px) {
    const qreal dpr = qApp ? qApp->devicePixelRatio() : 1.0;
    QPixmap pm(int(px * dpr), int(px * dpr));
    pm.fill(Qt::transparent);
    pm.setDevicePixelRatio(dpr);          // keeps it crisp on scaled displays

    QSvgRenderer r(svgTemplate.arg(color.name()).toUtf8());
    QPainter p(&pm);
    p.setRenderHint(QPainter::Antialiasing);
    r.render(&p, QRectF(0, 0, px, px));
    p.end();
    return QIcon(pm);
}

} // namespace detail

// ☀ — core disc plus eight rays.
inline QIcon sun(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<circle cx='12' cy='12' r='4'/>"
        "<path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41"
        "M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'/>"), c, px);
}

// 🌙 — crescent.
inline QIcon moon(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'/>"), c, px);
}

// 👁 — lens with pupil.
inline QIcon eye(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z'/>"
        "<circle cx='12' cy='12' r='3'/>"), c, px);
}

// 👁 struck through — privacy mode on.
inline QIcon eyeOff(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"
        "M6.61 6.61A18.15 18.15 0 0 0 2 11s3.6 7 10 7a9 9 0 0 0 5.39-1.61'/>"
        "<path d='M14.12 14.12a3 3 0 1 1-4.24-4.24'/>"
        "<path d='M2 2l20 20'/>"), c, px);
}

namespace detail {

// Builds a cog outline: `teeth` flat-topped teeth alternating between an outer
// and an inner radius, centred on the 24px viewBox. Generated rather than
// hand-written so the geometry is exact — a mistyped coordinate in a long
// hand-authored gear path is invisible until it renders wrong.
inline QString cogPath(int teeth = 8, double rOut = 10.4, double rIn = 7.4) {
    const double cx = 12.0, cy = 12.0;
    const double step = 2.0 * PI / teeth;
    auto pt = [&](double r, double a) {
        return QString::number(cx + r * std::cos(a), 'f', 2) + " " +
               QString::number(cy + r * std::sin(a), 'f', 2);
    };
    QString d;
    for (int i = 0; i < teeth; ++i) {
        const double a = i * step - PI / 2.0;       // start at 12 o'clock
        d += (i == 0 ? "M" : "L") + pt(rIn,  a);
        d += "L" + pt(rOut, a + step * 0.16);
        d += "L" + pt(rOut, a + step * 0.34);
        d += "L" + pt(rIn,  a + step * 0.50);
    }
    d += "Z";
    return "<path d='" + d + "'/>";
}

} // namespace detail

// Settings — a cog. The previous "sliders" glyph was read as a filter/mixer
// rather than settings; a gear is the convention users already know.
inline QIcon settings(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        detail::cogPath() + "<circle cx='12' cy='12' r='3.1'/>"), c, px);
}

// Refresh — circular arrow with a clear head.
inline QIcon refresh(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M21 12a9 9 0 1 1-2.64-6.36'/>"
        "<path d='M21 3v6h-6'/>"), c, px);
}

// Wallet — body with a clasp.
inline QIcon wallet(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8"
        "a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5'/>"
        "<circle cx='17' cy='13' r='1.4'/>"), c, px);
}

// ✕ — close. Painted rather than the "✕" glyph, which several UI fonts don't
// carry: the button rendered all but empty.
inline QIcon close(const QColor& c, int px = 18) {
    return detail::render(detail::wrap("<path d='M6 6l12 12M18 6L6 18'/>"), c, px);
}

// Power — sign out. The near-closed arc with a stem through the top gap is the
// universal power glyph, so it needs no label.
inline QIcon power(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M18.36 6.64a9 9 0 1 1-12.73 0'/>"
        "<path d='M12 2v10'/>"), c, px);
}

// Pencil — edit. Used for "modify stop loss / take profit" in the blotter's
// Action column, where an "S/L" text button sat oddly beside an icon ✕ and
// only named half of what it opens (the dialog edits T/P too).
inline QIcon pencil(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M12 20h9'/>"
        "<path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'/>"), c, px);
}

// Accounts — stacked layers.
inline QIcon layers(const QColor& c, int px = 18) {
    return detail::render(detail::wrap(
        "<path d='M12 2L2 7l10 5 10-5-10-5z'/>"
        "<path d='M2 17l10 5 10-5'/>"
        "<path d='M2 12l10 5 10-5'/>"), c, px);
}

} // namespace Icons
