#!/usr/bin/env python3
"""Generate an idempotent SQL seed file for client *Muhammad Saud*.

Produces ``seed_client_muhammad_saud.sql`` next to this file. The SQL is a single
transaction wrapping one PL/pgSQL DO block that:

  * upserts the user (open / created date 25 Nov 2025),
  * (re-)creates one USD trading account,
  * records the two deposits (100,000 on 02 Jan 2026, 50,000 on 04 Jan 2026),
  * generates month-wise closed trades (XAUUSD 80% / GBPUSD 10% / US100 10%)
    whose net profit per month matches the agreed returns,
  * records the monthly profit withdrawals on the 5th & 6th of the next month.

The script uses NO external packages (pure stdlib) so it can be run anywhere:

    python gen_seed_muhammad_saud.py

Then apply the generated SQL to the target database, e.g.:

    docker compose exec -T postgres psql -U proline -d proline < seed_client_muhammad_saud.sql

The DO block is idempotent: re-running it wipes only THIS user's accounts /
trades / deposits / withdrawals / transactions and rebuilds them.
"""
from __future__ import annotations

import os
import random
from decimal import Decimal, ROUND_HALF_UP

# ----------------------------------------------------------------------------
# Client / account facts
# ----------------------------------------------------------------------------
EMAIL = "saudkhanuae31@gmail.com"
FIRST_NAME = "Muhammad"
LAST_NAME = "Saud"
COUNTRY = "United Arab Emirates"
PASSWORD = "Proline@2026"            # initial login password (change after handover)
OPEN_DATE = "2025-11-25 10:00:00+00"  # account opened
YEAR = 2026

# Funding / payout method: USDT crypto wallet (replace with the real wallet if needed)
PAY_METHOD = "crypto_usdt"
PAY_CURRENCY = "USDT"
USDT_WALLET = "TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu"  # TRC20 USDT address (placeholder)

# Deposits: (timestamp, amount USD)
DEPOSITS = [
    ("2026-01-02 11:00:00+00", 100000),
    ("2026-01-04 11:00:00+00", 50000),
]
BASE_CAPITAL = 150000  # profit % is computed on this flat base (profit withdrawn monthly)

# Monthly return % on BASE_CAPITAL — every month kept in the 4-5% band (>= 6000 USD)
MONTHLY_PCT = {1: 4.5, 2: 4.3, 3: 4.9, 4: 5.0, 5: 4.6, 6: 4.4}
MONTH_NAME = {1: "January", 2: "February", 3: "March", 4: "April",
              5: "May", 6: "June"}
# Profit for these months is withdrawn on the 5th & 6th of the FOLLOWING month.
# June's profit (current month) is retained -> stays in the balance.
WITHDRAW_MONTHS = [1, 2, 3, 4, 5]

# Instrument config: symbol -> (contract_size, price_digits, base_price, price_var, lot_choices)
INSTR = {
    "XAUUSD": (100, 2, 2650.0, 90.0, [1, 1.5, 2, 2.5, 3]),
    "GBPUSD": (100000, 5, 1.2650, 0.025, [1, 1.5, 2, 2.5]),
    "US100": (1, 1, 21000.0, 1300.0, [1, 2, 3]),
}
ALLOC = {"XAUUSD": 0.80, "GBPUSD": 0.10, "US100": 0.10}

RNG = random.Random(20260626)  # fixed seed -> deterministic output


def q(s: str) -> str:
    """SQL single-quote escape."""
    return s.replace("'", "''")


def fmt(n: float, digits: int) -> str:
    return str(Decimal(str(n)).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP))


def split_pool(pool_cents: int, k: int) -> list[int]:
    """Split a positive amount (cents) into k positive parts that sum exactly."""
    weights = [RNG.uniform(0.75, 1.25) for _ in range(k)]
    tot = sum(weights)
    parts = [int(round(pool_cents * w / tot)) for w in weights]
    parts[-1] = pool_cents - sum(parts[:-1])
    # guard against a non-positive remainder from rounding
    while parts[-1] <= 0 and len(parts) > 1:
        donor = max(range(len(parts) - 1), key=lambda i: parts[i])
        parts[donor] -= 1
        parts[-1] += 1
    return parts


def txhash() -> str:
    return "".join(RNG.choice("0123456789abcdef") for _ in range(64))


def month_trade_profits(month_cents: int) -> list[tuple[str, int]]:
    """Return list of (symbol, profit_cents) summing exactly to month_cents."""
    xau = round(month_cents * ALLOC["XAUUSD"])
    gbp = round(month_cents * ALLOC["GBPUSD"])
    tec = month_cents - xau - gbp  # remainder keeps the total exact

    trades: list[tuple[str, int]] = []

    # XAUUSD: 9 trades incl. two realistic losers (~14% of the gross combined)
    loss = round(xau * 0.14)
    l1 = round(loss * 0.55)
    l2 = loss - l1
    winners = split_pool(xau + loss, 7)
    xau_parts = winners + [-l1, -l2]
    RNG.shuffle(xau_parts)
    trades += [("XAUUSD", p) for p in xau_parts]

    # GBPUSD: 3 winning trades
    trades += [("GBPUSD", p) for p in split_pool(gbp, 3)]
    # US100: 3 winning trades
    trades += [("US100", p) for p in split_pool(tec, 3)]
    return trades


def build():
    # ---- compute everything in cents, then emit ----
    events = []  # (ts, kind, payload) kind in {deposit, trade, withdraw}

    for ts, amt in DEPOSITS:
        events.append((ts, "deposit", {"amount": amt, "ts": ts}))

    monthly_profit_cents = {}
    for m, pct in MONTHLY_PCT.items():
        mc = int(round(pct / 100.0 * BASE_CAPITAL * 100))
        monthly_profit_cents[m] = mc

        # pick distinct trading days for the 9 trades
        min_day = 6 if m == 1 else 7          # after deposits / monthly withdrawal
        max_day = 25 if m == 6 else 27
        profits = month_trade_profits(mc)
        days = sorted(RNG.sample(range(min_day, max_day + 1), len(profits)))

        for (symbol, pcents), day in zip(profits, days):
            cs, digits, base, var, lots_choices = INSTR[symbol]
            lots = RNG.choice(lots_choices)
            side = RNG.choice(["buy", "sell"])
            sign = 1 if side == "buy" else -1
            profit = pcents / 100.0
            open_price = round(base + RNG.uniform(-var, var), digits)
            close_price = round(open_price + profit / (sign * lots * cs), digits)
            o_hour = RNG.randint(8, 18)
            c_hour = min(23, o_hour + RNG.randint(1, 5))
            opened = f"{YEAR}-{m:02d}-{day:02d} {o_hour:02d}:{RNG.randint(0,59):02d}:00+00"
            closed = f"{YEAR}-{m:02d}-{day:02d} {c_hour:02d}:{RNG.randint(0,59):02d}:00+00"
            events.append((closed, "trade", {
                "symbol": symbol, "side": side, "lots": lots,
                "open": open_price, "close": close_price, "digits": digits,
                "profit": profit, "opened": opened, "closed": closed,
            }))

    # withdrawals: one withdrawal per month = full month profit, on the 5th of month m+1
    for m in WITHDRAW_MONTHS:
        P = monthly_profit_cents[m]
        nm = m + 1
        ts = f"{YEAR}-{nm:02d}-05 12:00:00+00"
        events.append((ts, "withdraw",
                       {"amount": P, "ts": ts, "for_month": MONTH_NAME[m]}))

    # ---- running balance (cents) in chronological order ----
    events.sort(key=lambda e: e[0])
    running = 0  # cents
    for ts, kind, p in events:
        if kind == "deposit":
            running += p["amount"] * 100
            p["balance_after"] = running
        elif kind == "trade":
            running += int(round(p["profit"] * 100))
        elif kind == "withdraw":
            running -= p["amount"]
            p["balance_after"] = running

    final_balance = running / 100.0

    # ---- verification (fail loudly before writing) ----
    trades_only = [e for e in events if e[1] == "trade"]
    for m in MONTHLY_PCT:
        s = sum(int(round(e[2]["profit"] * 100)) for e in trades_only
                if int(e[0][5:7]) == m)
        assert s == monthly_profit_cents[m], f"month {m} sum {s} != {monthly_profit_cents[m]}"
    expected_final = BASE_CAPITAL * 100 + monthly_profit_cents[6]  # only June retained
    assert running == expected_final, f"final {running} != {expected_final}"

    return events, monthly_profit_cents, final_balance


def emit(events, monthly_profit_cents, final_balance) -> str:
    L = []
    a = L.append
    total_trades = sum(1 for e in events if e[1] == "trade")
    a("-- ============================================================================")
    a(f"-- Seed: client {FIRST_NAME} {LAST_NAME} <{EMAIL}>")
    a(f"-- Account opened: {OPEN_DATE}")
    a(f"-- Deposits: 100,000 (02 Jan 2026) + 50,000 (04 Jan 2026) = 150,000 (USDT)")
    a("-- Monthly net profit (% of 150,000, withdrawn in USDT on the 5th of next month):")
    for m, pct in MONTHLY_PCT.items():
        a(f"--   {MONTH_NAME[m]:9s}: {pct:>4}%  =  {monthly_profit_cents[m]/100:>10,.2f}")
    a(f"-- Instruments: XAUUSD 80% / GBPUSD 10% / US100 (USTEC/NQ) 10%")
    a(f"-- {total_trades} closed trades; final balance {final_balance:,.2f} USD")
    a("-- Idempotent: re-running rebuilds ONLY this user's data. Runs in one tx.")
    a("-- ============================================================================")
    a("BEGIN;")
    a("DO $$")
    a("DECLARE")
    a("  v_uid uuid; v_acc uuid; v_grp uuid; v_pos uuid;")
    a("  v_xau uuid; v_gbp uuid; v_tec uuid;")
    a("  v_accnum text; v_accbig bigint;")
    a("BEGIN")
    a("  SELECT id INTO v_xau FROM instruments WHERE symbol='XAUUSD';")
    a("  SELECT id INTO v_gbp FROM instruments WHERE symbol='GBPUSD';")
    a("  SELECT id INTO v_tec FROM instruments WHERE symbol='US100';")
    a("  IF v_tec IS NULL THEN SELECT id INTO v_tec FROM instruments WHERE symbol='NAS100'; END IF;")
    a("  SELECT id INTO v_grp FROM account_groups WHERE name='Standard' ORDER BY created_at LIMIT 1;")
    a("  IF v_xau IS NULL OR v_gbp IS NULL OR v_tec IS NULL OR v_grp IS NULL THEN")
    a("    RAISE EXCEPTION 'Missing instrument(s) XAUUSD/GBPUSD/US100 or Standard account group';")
    a("  END IF;")
    a("")
    a("  -- 1) upsert user")
    a("  INSERT INTO users (email,password_hash,first_name,last_name,role,status,kyc_status,country,main_wallet_balance,created_at,updated_at)")
    a(f"  VALUES ('{q(EMAIL)}', crypt('{q(PASSWORD)}', gen_salt('bf',12)), '{q(FIRST_NAME)}','{q(LAST_NAME)}','user','active','approved','{q(COUNTRY)}',0,'{OPEN_DATE}','{OPEN_DATE}')")
    a("  ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,status='active',kyc_status='approved',country=EXCLUDED.country,created_at=EXCLUDED.created_at")
    a("  RETURNING id INTO v_uid;")
    a("")
    a("  -- 2) clean any prior seeded data for THIS user (idempotent)")
    a("  DELETE FROM trade_history WHERE account_id IN (SELECT id FROM trading_accounts WHERE user_id=v_uid);")
    a("  DELETE FROM positions     WHERE account_id IN (SELECT id FROM trading_accounts WHERE user_id=v_uid);")
    a("  DELETE FROM orders        WHERE account_id IN (SELECT id FROM trading_accounts WHERE user_id=v_uid);")
    a("  DELETE FROM transactions  WHERE user_id=v_uid;")
    a("  DELETE FROM deposits      WHERE user_id=v_uid;")
    a("  DELETE FROM withdrawals   WHERE user_id=v_uid;")
    a("  DELETE FROM trading_accounts WHERE user_id=v_uid;")
    a("")
    a("  -- 3) trading account (next numeric account number)")
    a("  SELECT COALESCE(MAX(CASE WHEN account_number ~ '^[0-9]+$' THEN account_number::bigint END),700000)+1 INTO v_accbig FROM trading_accounts;")
    a("  v_accnum := v_accbig::text;")
    a(f"  INSERT INTO trading_accounts (user_id,account_group_id,account_number,balance,credit,equity,margin_used,free_margin,margin_level,leverage,currency,is_demo,is_active,created_at,updated_at)")
    a(f"  VALUES (v_uid,v_grp,v_accnum,{final_balance:.2f},0,{final_balance:.2f},0,{final_balance:.2f},0,100,'USD',false,true,'{OPEN_DATE}',now())")
    a("  RETURNING id INTO v_acc;")
    a("")

    # emit events in chronological order
    a("  -- 4) deposits, trades and withdrawals (chronological)")
    for ts, kind, p in events:
        if kind == "deposit":
            amt = p["amount"]
            ba = p["balance_after"] / 100.0
            a(f"  INSERT INTO deposits (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,transaction_id,approved_at,created_at)")
            a(f"   VALUES (v_uid,v_acc,{amt:.2f},'{PAY_CURRENCY}','{PAY_METHOD}','approved','{q(USDT_WALLET)}','{txhash()}','{txhash()[:16]}','{p['ts']}','{p['ts']}');")
            a(f"  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)")
            a(f"   VALUES (v_uid,v_acc,'deposit',{amt:.2f},{ba:.2f},'USDT deposit {amt:,.0f}','{p['ts']}');")
        elif kind == "trade":
            sym = p["symbol"]
            ivar = {"XAUUSD": "v_xau", "GBPUSD": "v_gbp", "US100": "v_tec"}[sym]
            d = p["digits"]
            a(f"  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)")
            a(f"   VALUES (v_acc,{ivar},'{p['side']}','closed',{p['lots']},{fmt(p['open'],d)},{fmt(p['close'],d)},0,0,{p['profit']:.2f},'{p['closed']}','{q(sym)} historical','{p['opened']}','{p['closed']}') RETURNING id INTO v_pos;")
            a(f"  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)")
            a(f"   VALUES (v_pos,v_acc,{ivar},'{p['side']}',{p['lots']},{fmt(p['open'],d)},{fmt(p['close'],d)},0,0,{p['profit']:.2f},'{p['opened']}','{p['closed']}','manual');")
        elif kind == "withdraw":
            amt = p["amount"] / 100.0
            ba = p["balance_after"] / 100.0
            a(f"  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,approved_at,completed_at,created_at)")
            a(f"   VALUES (v_uid,v_acc,{amt:.2f},'{PAY_CURRENCY}','{PAY_METHOD}','completed','{q(USDT_WALLET)}','{txhash()}','{p['ts']}','{p['ts']}','{p['ts']}');")
            a(f"  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)")
            a(f"   VALUES (v_uid,v_acc,'withdrawal',{amt:.2f},{ba:.2f},'{q(p['for_month'])} profit withdrawal (USDT)','{p['ts']}');")

    a("")
    a("  RAISE NOTICE 'Seeded % % (account %): balance %', '" + q(FIRST_NAME) + "','" + q(LAST_NAME) + "', v_accnum, " + f"{final_balance:.2f};")
    a("END $$;")
    a("COMMIT;")
    a("")
    return "\n".join(L)


def main():
    events, mpc, final_balance = build()
    sql = emit(events, mpc, final_balance)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_client_muhammad_saud.sql")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(sql)

    n_trades = sum(1 for e in events if e[1] == "trade")
    n_wd = sum(1 for e in events if e[1] == "withdraw")
    print(f"Wrote {out}")
    print(f"  trades            : {n_trades}")
    print(f"  withdrawals       : {n_wd}")
    print(f"  final balance USD : {final_balance:,.2f}")
    print("  monthly profit USD:")
    for m, pct in MONTHLY_PCT.items():
        print(f"    {MONTH_NAME[m]:9s} {pct:>4}%  {mpc[m]/100:>10,.2f}")


if __name__ == "__main__":
    main()
