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

    // Kept only so old config files still load; /api/v1 authenticates with the
    // JWT above and ignores these entirely.
    QString apiKey;
    QString apiSecret;

    // REST base, e.g. https://api.prolinemarket.com/api/v1
    QString restBase = "https://api.prolinemarket.com/api/v1";
    // WebSocket URL, e.g. wss://api.prolinemarket.com/ws/prices
    QString wsUrl    = "wss://api.prolinemarket.com/ws/prices";

    bool hasToken() const {
        return !token.trimmed().isEmpty() && !accountId.trimmed().isEmpty();
    }
    // An API key alone is no longer enough to reach /api/v1 — a session token
    // and a selected account are required.
    bool hasCredentials() const { return hasToken(); }

    static QString filePath();   // resolved config file location
    static Config  load();       // load from disk (defaults if missing)
    bool           save() const; // write to disk; returns success
};
