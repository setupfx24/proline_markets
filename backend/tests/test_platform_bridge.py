"""Unit tests for the platform bridge's shared logic (no database needed).

Run from backend/:  python -m pytest tests/test_platform_bridge.py -q
"""
import time
from decimal import Decimal

import pytest

from packages.common.src import platform_bridge as pb


# ─── Side ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("side,mode,expected", [
    ("buy", "straight", "buy"),
    ("sell", "straight", "sell"),
    ("buy", "reverse", "sell"),
    ("sell", "reverse", "buy"),
    ("BUY", "Reverse", "sell"),
])
def test_mirror_side(side, mode, expected):
    assert pb.mirror_side(side, mode) == expected


def test_mirror_side_accepts_enum_like():
    class E:
        value = "buy"
    assert pb.mirror_side(E(), "reverse") == "sell"


def test_bad_mode_and_side_rejected():
    with pytest.raises(ValueError):
        pb.mirror_side("buy", "sideways")
    with pytest.raises(ValueError):
        pb.mirror_side("hold", "straight")


# ─── SL / TP ──────────────────────────────────────────────────────────────

def test_sl_tp_straight_unchanged():
    assert pb.mirror_sl_tp("1.0950", "1.1100", "straight") == (Decimal("1.0950"), Decimal("1.1100"))


def test_sl_tp_reverse_swapped():
    # BUY @1.1000, SL 1.0950, TP 1.1100  →  SELL with SL 1.1100, TP 1.0950
    sl, tp = pb.mirror_sl_tp("1.0950", "1.1100", "reverse")
    assert (sl, tp) == (Decimal("1.1100"), Decimal("1.0950"))


def test_sl_tp_reverse_is_valid_for_the_opposite_side():
    entry = Decimal("1.1000")
    sl, tp = pb.mirror_sl_tp("1.0950", "1.1100", "reverse")
    # A SELL needs SL above and TP below the entry.
    assert sl > entry > tp


def test_sl_tp_missing_and_zero_levels():
    assert pb.mirror_sl_tp(None, None, "reverse") == (None, None)
    assert pb.mirror_sl_tp(0, "1.2", "straight") == (None, Decimal("1.2"))
    assert pb.mirror_sl_tp("1.0", None, "reverse") == (None, Decimal("1.0"))


# ─── Lots ─────────────────────────────────────────────────────────────────

def test_scale_lots_default_and_multiplier():
    assert pb.scale_lots("0.10") == Decimal("0.10")
    assert pb.scale_lots("0.10", 2) == Decimal("0.20")
    assert pb.scale_lots("0.15", "0.5") == Decimal("0.07")   # rounded DOWN to the step


def test_scale_lots_refuses_zero_and_over_cap():
    with pytest.raises(ValueError):
        pb.scale_lots("0.01", "0.5")
    with pytest.raises(ValueError):
        pb.scale_lots("2", 1, max_lots="1")
    assert pb.scale_lots("1", 1, max_lots="1") == Decimal("1")


@pytest.mark.parametrize("before,now,copy,expected", [
    ("1.00", "0.40", "1.00", "0.60"),   # closed 60% → copy closes 60%
    ("1.00", "0.40", "2.00", "1.20"),   # 2× multiplier link stays in proportion
    ("0.10", "0.00", "0.10", "0.10"),   # fully closed
    ("0.10", "0.10", "0.10", "0"),      # nothing changed
    ("0.10", "0.12", "0.10", "0"),      # grew — never close on that
    ("0.03", "0.02", "0.01", "0.01"),   # a tiny fraction still closes one step
])
def test_partial_close_lots(before, now, copy, expected):
    assert pb.partial_close_lots(before, now, copy) == Decimal(expected)


# ─── Signing ──────────────────────────────────────────────────────────────

def test_sign_verify_roundtrip():
    ts = str(int(time.time() * 1000))
    body = '{"a":1}'
    sig = pb.sign("s3cret", ts, "POST", "/api/bridge/v1/trades/open", body)
    assert pb.verify("s3cret", ts, "POST", "/api/bridge/v1/trades/open", body, sig, 30_000)


@pytest.mark.parametrize("change", ["secret", "body", "path", "method"])
def test_verify_rejects_tampering(change):
    ts = str(int(time.time() * 1000))
    args = dict(secret="s3cret", method="POST", path="/api/bridge/v1/trades/open", body='{"a":1}')
    sig = pb.sign(args["secret"], ts, args["method"], args["path"], args["body"])
    bad = dict(args)
    bad[change] = {"secret": "other", "body": '{"a":2}', "path": "/api/bridge/v1/trades/close",
                   "method": "GET"}[change]
    assert not pb.verify(bad["secret"], ts, bad["method"], bad["path"], bad["body"], sig, 30_000)


def test_verify_rejects_stale_and_missing():
    old = str(int(time.time() * 1000) - 120_000)
    sig = pb.sign("s3cret", old, "GET", "/p", "")
    assert not pb.verify("s3cret", old, "GET", "/p", "", sig, 30_000)
    assert not pb.verify("", old, "GET", "/p", "", sig, 30_000)
    assert not pb.verify("s3cret", "not-a-number", "GET", "/p", "", sig, 30_000)


def test_signed_headers_verify():
    h = pb.signed_headers("s3cret", "opula", "GET", "/api/bridge/v1/ping", "")
    assert h[pb.HDR_SOURCE] == "opula"
    assert pb.verify("s3cret", h[pb.HDR_TIMESTAMP], "GET", "/api/bridge/v1/ping", "",
                     h[pb.HDR_SIGNATURE], 30_000)
