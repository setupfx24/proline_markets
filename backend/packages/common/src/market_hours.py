"""Market hours engine — authoritative UTC-based market session validator.

All times are UTC. Reference: standard CFD/broker trading schedules.

Usage:
    is_open, reason = is_market_open(symbol, segment_name, trading_hours_json)
    if not is_open:
        raise HTTPException(400, detail=reason)
"""
from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Optional

UTC = timezone.utc

# ---------------------------------------------------------------------------
# Symbol classification tables
# ---------------------------------------------------------------------------

#: Crypto trades 24/7 — never blocked
CRYPTO_SEGMENTS = {"crypto", "cryptocurrency"}
CRYPTO_SYMBOLS = {
    "BTCUSD", "ETHUSD", "LTCUSD", "XRPUSD", "SOLUSD", "BNBUSD",
    "ADAUSD", "DOTUSD", "MATICUSD", "AVAXUSD", "LINKUSD", "DOGEUSD",
    "UNIUSD", "ATOMUSD", "XLMUSD", "TRXUSD",
}

#: Forex pairs + precious metals + energy — follow forex session
FOREX_SEGMENTS = {"forex", "fx", "foreign exchange"}
FOREX_LIKE_SYMBOLS = {
    # Metals
    "XAUUSD", "XAGUSD", "XAUEUR", "XAUGBP", "XAUJPY",
    "XPTUSD", "XPDUSD",
    # Energy (approx forex hours for CFDs)
    "USOIL", "UKOIL", "NGAS", "WTIUSD", "BRTUSD",
}

#: US equity indices — NYSE/NASDAQ session  Mon–Fri 13:30–20:00 UTC
US_INDEX_SYMBOLS = {"US30", "NAS100", "US500", "US2000", "SP500", "DJI", "NDX"}
US_INDEX_OPEN  = time(13, 30)
US_INDEX_CLOSE = time(20, 0)

#: European equity indices — Euronext/XETRA session  Mon–Fri 07:00–15:30 UTC
EU_INDEX_SYMBOLS = {"UK100", "GER40", "FRA40", "ESP35", "ITA40", "EUSTX50", "NED25"}
EU_INDEX_OPEN  = time(7, 0)
EU_INDEX_CLOSE = time(15, 30)

#: Asian equity indices — TSE / HKEX / ASX  Mon–Fri 00:00–06:00 UTC
ASIAN_INDEX_SYMBOLS = {"JP225", "HKG33", "AUS200", "CHN50", "SGD30", "KOR200"}
ASIAN_INDEX_OPEN  = time(0, 0)
ASIAN_INDEX_CLOSE = time(6, 0)

INDEX_SEGMENTS = {"indices", "index", "equities"}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def is_market_open(
    symbol: str,
    segment_name: Optional[str],
    trading_hours_json: Optional[dict] = None,
) -> tuple[bool, str]:
    """Return (is_open, closed_reason).

    closed_reason is an empty string when the market is open.
    """
    now       = datetime.now(UTC)
    weekday   = now.weekday()          # 0 = Monday … 6 = Sunday
    cur_time  = now.time().replace(tzinfo=None)
    sym       = symbol.upper().strip()
    seg       = (segment_name or "").lower().strip()

    # 1. DB override wins over everything
    if trading_hours_json and isinstance(trading_hours_json, dict):
        override = _check_custom_hours(trading_hours_json)
        if override is not None:
            return override

    # 2. Crypto — 24 / 7
    if seg in CRYPTO_SEGMENTS or sym in CRYPTO_SYMBOLS:
        return True, ""

    # 3. Forex  +  forex-like commodities (metals, energy)
    if seg in FOREX_SEGMENTS or sym in FOREX_LIKE_SYMBOLS:
        return _forex_session(weekday, cur_time)

    # 4. Commodities segment — treat the same as forex unless symbol overrides
    if "commodit" in seg:
        return _forex_session(weekday, cur_time)

    # 5. Indices — look up by symbol first, then fall back to any index session
    if seg in INDEX_SEGMENTS or _is_index_symbol(sym):
        return _index_session(sym, weekday, cur_time)

    # 6. Unknown — default to forex hours (conservative)
    return _forex_session(weekday, cur_time)


def market_status_dict(
    symbol: str,
    segment_name: Optional[str],
    trading_hours_json: Optional[dict] = None,
) -> dict:
    """Convenience wrapper that returns a JSON-serialisable dict."""
    is_open, reason = is_market_open(symbol, segment_name, trading_hours_json)
    return {
        "symbol":  symbol,
        "is_open": is_open,
        "reason":  reason,
        "session": _describe_session(symbol, segment_name),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _forex_session(weekday: int, cur: time) -> tuple[bool, str]:
    """Forex / metals / energy session.

    Open:  Sunday 22:00 UTC → Friday 22:00 UTC
    Closed: Friday 22:00 UTC → Sunday 22:00 UTC
    """
    # Saturday — always closed
    if weekday == 5:
        return False, "Forex market is closed on Saturdays. Reopens Sunday 22:00 UTC."

    # Sunday — only open from 22:00 onwards
    if weekday == 6:
        if cur >= time(22, 0):
            return True, ""
        return False, f"Forex market opens Sunday at 22:00 UTC (current time {cur.strftime('%H:%M')} UTC)."

    # Friday — closes at 22:00
    if weekday == 4:
        if cur >= time(22, 0):
            return False, "Forex market has closed for the weekend. Reopens Sunday 22:00 UTC."
        return True, ""

    # Monday – Thursday: always open
    return True, ""


def _index_session(sym: str, weekday: int, cur: time) -> tuple[bool, str]:
    if sym in US_INDEX_SYMBOLS:
        return _fixed_session(weekday, cur, US_INDEX_OPEN, US_INDEX_CLOSE, "US equity market", "13:30–20:00 UTC")
    if sym in EU_INDEX_SYMBOLS:
        return _fixed_session(weekday, cur, EU_INDEX_OPEN, EU_INDEX_CLOSE, "European equity market", "07:00–15:30 UTC")
    if sym in ASIAN_INDEX_SYMBOLS:
        return _fixed_session(weekday, cur, ASIAN_INDEX_OPEN, ASIAN_INDEX_CLOSE, "Asian equity market", "00:00–06:00 UTC")
    # Unknown index — fall back to forex hours
    return _forex_session(weekday, cur)


def _fixed_session(
    weekday: int, cur: time,
    open_t: time, close_t: time,
    market_name: str, hours_str: str,
) -> tuple[bool, str]:
    if weekday >= 5:
        return False, f"{market_name} is closed on weekends."
    if open_t <= cur < close_t:
        return True, ""
    return False, f"{market_name} is currently closed. Trading hours: {hours_str} Mon–Fri."


def _check_custom_hours(hours: dict) -> Optional[tuple[bool, str]]:
    """Parse optional DB-stored trading_hours JSONB override."""
    if hours.get("always_open"):
        return True, ""
    if hours.get("always_closed"):
        return False, hours.get("reason", "This instrument is not available for trading.")
    # Future: support {"sessions": [...]} custom schedule
    return None


def _is_index_symbol(sym: str) -> bool:
    return sym in US_INDEX_SYMBOLS or sym in EU_INDEX_SYMBOLS or sym in ASIAN_INDEX_SYMBOLS


def _describe_session(symbol: str, segment: Optional[str]) -> str:
    sym = symbol.upper()
    seg = (segment or "").lower()
    if seg in CRYPTO_SEGMENTS or sym in CRYPTO_SYMBOLS:
        return "24/7"
    if sym in US_INDEX_SYMBOLS:
        return "Mon–Fri 13:30–20:00 UTC"
    if sym in EU_INDEX_SYMBOLS:
        return "Mon–Fri 07:00–15:30 UTC"
    if sym in ASIAN_INDEX_SYMBOLS:
        return "Mon–Fri 00:00–06:00 UTC"
    return "Mon–Fri (Sun 22:00 – Fri 22:00 UTC)"
