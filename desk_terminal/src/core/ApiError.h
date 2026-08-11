#pragma once
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonValue>
#include <QString>
#include <QStringList>

// Pulls a human-readable reason out of a FastAPI error body.
//
// The platform answers with two different shapes and the difference is easy to
// miss. A business error is {"detail": "Insufficient available balance ..."},
// but a validation error is
//     {"detail": [{"msg": "Input should be greater than 0", "loc": [...]}, ...]}
// QJsonValue::toString() returns an empty string for that array, so reading it
// as a string silently discarded the reason and left the caller showing Qt's
// generic "server replied: Unprocessable Entity" — the one message that tells a
// trader nothing about what to change.
inline QString apiDetail(const QJsonObject& body, const QString& fallback) {
    const QJsonValue d = body.value("detail");
    if (d.isString() && !d.toString().isEmpty()) return d.toString();
    if (d.isArray()) {
        QStringList parts;
        for (const QJsonValue& v : d.toArray()) {
            const QString msg = v.toObject().value("msg").toString();
            if (!msg.isEmpty()) parts << msg;
        }
        if (!parts.isEmpty()) return parts.join("; ");
    }
    return fallback;
}
