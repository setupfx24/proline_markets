#pragma once
#include <QString>

// Persists connection settings (API key/secret + endpoints) to a JSON file
// in the user's app-config directory. Plaintext — this is a local desktop
// terminal; keep the file private.
class Config {
public:
    // Terminal login (email/password → JWT). Preferred.
    QString token;         // JWT
    QString accountId;     // selected trading account id
    QString userName;
    QString accountsJson = "[]";   // [{account_id, account_number, is_demo, currency}]

    // Legacy bot auth (still supported for a pasted API key).
    QString apiKey;
    QString apiSecret;

    // REST base, e.g. https://api.bull4x.com/api/algo
    QString restBase = "https://api.bull4x.com/api/algo";
    // WebSocket URL, e.g. wss://api.bull4x.com/ws/algo/prices
    QString wsUrl    = "wss://api.bull4x.com/ws/algo/prices";

    bool hasToken() const {
        return !token.trimmed().isEmpty() && !accountId.trimmed().isEmpty();
    }
    bool hasCredentials() const {
        return hasToken() ||
               (!apiKey.trimmed().isEmpty() && !apiSecret.trimmed().isEmpty());
    }

    static QString filePath();   // resolved config file location
    static Config  load();       // load from disk (defaults if missing)
    bool           save() const; // write to disk; returns success
};
