#pragma once
#include <QString>
#include <QStringList>

// Persists connection settings (API key/secret + endpoints) to a JSON file
// in the user's app-config directory. Plaintext — this is a local desktop
// terminal; keep the file private.
class Config {
public:
    // Terminal login (email/password → JWT). Preferred.
    QString token;         // JWT — access token, expires in ~45 minutes
    // The pt_refresh cookie from sign-in, used to mint a new access token
    // without asking for the password again. It is SINGLE USE: every refresh
    // returns a replacement and invalidates this one, so whatever comes back
    // must be stored here or the next refresh fails with 401.
    //
    // Worth knowing: this is a 7-day credential sitting in a plaintext file
    // next to the access token. It is no worse than what was already here, but
    // it is longer-lived — the file is the whole session.
    QString refreshToken;
    QString accountId;     // selected trading account id
    QString userName;      // display name from the login response
    QString email;         // the address signed in with (prefills the login form)
    QString accountsJson = "[]";   // [{account_id, account_number, is_demo, currency}]

    // UI preferences
    QString theme   = "light"; // "dark" | "light" — light mirrors the MT5 layout
    bool    privacy = false;   // mask balances / account numbers on screen

    // Chart grid, restored on the next launch. A trader who set up a 2x2 of
    // four instruments should not have to rebuild it every session — the
    // terminal used to always reopen on a single chart.
    // chartSymbols is left-to-right for the visible panes; a short or empty
    // list just means those panes open on the default symbol.
    int         chartCount = 1;   // 1..4
    QStringList chartSymbols;

    // Legacy bot auth (still supported for a pasted API key).
    QString apiKey;
    QString apiSecret;

    // REST base, e.g. https://api.prolinemarket.com/api/algo
    QString restBase = "https://api.prolinemarket.com/api/algo";
    // WebSocket URL, e.g. wss://api.prolinemarket.com/ws/algo/prices
    // WebSockets only work on the api. host — trade.prolinemarket.com proxies REST
    // but its nginx block does not upgrade the connection.
    QString wsUrl    = "wss://api.prolinemarket.com/ws/algo/prices";

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

    // There is deliberately NO migration from the Bull4x / SwissCresta builds
    // this terminal was forked from — see the note in Config.cpp before adding
    // one back.
};
