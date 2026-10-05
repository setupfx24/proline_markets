#!/usr/bin/env python3
"""Generate an idempotent SQL seed for a DEMO account with a fixed XAUUSD history.

Produces ``seed_demo_pm_xauusd.sql`` next to this file. The SQL is one
transaction wrapping one PL/pgSQL DO block that:

  * upserts a demo user (users.is_demo = true),
  * creates (or reuses) one USD demo trading account in the "Demo" group with a
    ``PM-<n>`` account number — the user can sign in with that number,
  * books the 18 closed XAUUSD trades of September 2026 exactly as listed in
    TRADES (entry, exit, lots, side, P&L), each with its trade_history row and
    a profit/loss transaction, the same rows a real close writes.

Pure stdlib:

    python gen_seed_demo_pm_xauusd.py

Apply on the server — the sign-in password is passed at apply time so it never
lands in git:

    docker compose exec -T postgres psql -U prolinemarket -d prolinemarket -v pw='<password>' < backend/scripts/seed_demo_pm_xauusd.sql

Idempotent: re-running keeps the same account number and rebuilds only this
account's trades and transactions.
"""
from __future__ import annotations

import os
import random
from decimal import Decimal

# ----------------------------------------------------------------------------
# Account holder — edit before applying
# ----------------------------------------------------------------------------
EMAIL = "imranaccl71@gmail.com"
FIRST_NAME = "Muhammad Imran"
LAST_NAME = "Bhatti"
COUNTRY = ""
# Sign-in password: NOT stored here. Supply it with `psql -v pw='...'` (see top).
OPEN_DATE = "2026-08-31 09:00:00+00"   # account opened, day before the first trade
START_BALANCE = Decimal("10000.00")    # demo starting balance
LEVERAGE = 100
CONTRACT_SIZE = Decimal("100")         # XAUUSD: 100 oz per lot

# (date dd-mm-yy, lots, side, entry, exit, P/L USD) — exactly as supplied
TRADES = [
    ("01-09-26", "0.60", "sell", "4379.180", "4359.189", "1199.46"),
    ("02-09-26", "0.55", "buy",  "4335.000", "4355.005", "1100.28"),
    ("03-09-26", "0.65", "buy",  "4400.000", "4425.000", "1625.00"),
    ("04-09-26", "0.70", "sell", "4470.000", "4450.000", "1400.00"),
    ("07-09-26", "0.50", "buy",  "4400.000", "4390.000", "-500.00"),
    ("08-09-26", "0.60", "sell", "4400.000", "4375.000", "1500.00"),
    ("09-09-26", "0.49", "buy",  "4360.000", "4380.000", "980.00"),
    ("10-09-26", "0.70", "sell", "4400.000", "4375.000", "1750.00"),
    ("11-09-26", "0.43", "buy",  "4320.000", "4340.000", "860.00"),
    ("14-09-26", "0.55", "sell", "4330.000", "4305.000", "1375.00"),
    ("16-09-26", "0.60", "sell", "4300.000", "4275.000", "1500.00"),
    ("17-09-26", "0.80", "buy",  "4280.000", "4305.000", "2000.00"),
    ("18-09-26", "0.47", "buy",  "4350.000", "4370.000", "940.00"),
    ("21-09-26", "0.64", "sell", "4370.000", "4350.000", "1280.00"),
    ("22-09-26", "0.50", "buy",  "4330.000", "4320.000", "-500.00"),
    ("23-09-26", "0.65", "sell", "4340.000", "4318.000", "1430.00"),
    ("28-09-26", "0.85", "sell", "4260.000", "4238.820", "1800.30"),
    ("29-09-26", "0.55", "buy",  "4140.000", "4167.040", "1487.20"),
]
NET_PROFIT = Decimal("21227.24")

RNG = random.Random(20260901)  # fixed seed -> same open/close times every run


def q(s: str) -> str:
    """SQL single-quote escape."""
    return s.replace("'", "''")


def build() -> list[dict]:
    rows = []
    for date, lots, side, entry, exit_, pl in TRADES:
        lots, entry, exit_, pl = Decimal(lots), Decimal(entry), Decimal(exit_), Decimal(pl)
        sign = 1 if side == "buy" else -1
        computed = ((exit_ - entry) * sign * lots * CONTRACT_SIZE).quantize(Decimal("0.01"))
        assert abs(computed - pl) <= Decimal("0.01"), f"{date}: P/L {pl} != computed {computed}"

        dd, mm, yy = date.split("-")
        day = f"20{yy}-{mm}-{dd}"
        o_h, o_m = RNG.randint(7, 12), RNG.randint(0, 59)
        c_h, c_m = min(20, o_h + RNG.randint(1, 6)), RNG.randint(0, 59)
        rows.append({
            "side": side, "lots": lots, "entry": entry, "exit": exit_, "profit": pl,
            "opened": f"{day} {o_h:02d}:{o_m:02d}:00+00",
            "closed": f"{day} {c_h:02d}:{c_m:02d}:00+00",
        })

    total = sum(r["profit"] for r in rows)
    assert total == NET_PROFIT, f"net {total} != {NET_PROFIT}"
    return rows


def emit(rows: list[dict]) -> str:
    final = START_BALANCE + NET_PROFIT
    L: list[str] = []
    a = L.append
    a("-- ============================================================================")
    a(f"-- Seed: DEMO account for {FIRST_NAME} {LAST_NAME} <{EMAIL}>")
    a(f"-- Demo balance {START_BALANCE:,.2f} + {len(rows)} XAUUSD trades (Sep 2026) net "
      f"{NET_PROFIT:,.2f} = {final:,.2f} USD")
    a("-- Sign in with the PM-<n> account number (printed below) or the email.")
    a("-- Idempotent: re-running keeps the account number, rebuilds its trades. One tx.")
    a("-- ============================================================================")
    a("\\set ON_ERROR_STOP on")
    a("\\if :{?pw}")
    a("\\else")
    a("  \\echo 'Pass the sign-in password: psql ... -v pw=''<password>'' < seed_demo_pm_xauusd.sql'")
    a("  \\quit")
    a("\\endif")
    a("BEGIN;")
    a("SELECT set_config('seed.pw', :'pw', true) \\gset")
    a("DO $$")
    a("DECLARE")
    a("  v_uid uuid; v_acc uuid; v_grp uuid; v_pos uuid; v_xau uuid;")
    a("  v_accnum text; v_pw text := current_setting('seed.pw', true);")
    a("BEGIN")
    a("  IF length(coalesce(v_pw,'')) < 8 THEN")
    a("    RAISE EXCEPTION 'Sign-in password (-v pw=...) must be at least 8 characters';")
    a("  END IF;")
    a("  SELECT id INTO v_xau FROM instruments WHERE symbol='XAUUSD';")
    a("  SELECT id INTO v_grp FROM account_groups WHERE name='Demo' ORDER BY created_at LIMIT 1;")
    a("  IF v_xau IS NULL OR v_grp IS NULL THEN")
    a("    RAISE EXCEPTION 'Missing XAUUSD instrument or Demo account group';")
    a("  END IF;")
    a("")
    a("  -- 1) upsert the demo user")
    a("  INSERT INTO users (email,password_hash,first_name,last_name,role,status,country,is_demo,main_wallet_balance,created_at,updated_at)")
    a(f"  VALUES ('{q(EMAIL)}', crypt(v_pw, gen_salt('bf',12)), '{q(FIRST_NAME)}','{q(LAST_NAME)}','user','active','{q(COUNTRY)}',true,0,'{OPEN_DATE}','{OPEN_DATE}')")
    a("  ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,status='active',password_hash=EXCLUDED.password_hash")
    a("  RETURNING id INTO v_uid;")
    a("")
    a("  -- 2) reuse this user's PM demo account, or open the next PM-<n>")
    a("  SELECT id, account_number INTO v_acc, v_accnum FROM trading_accounts")
    a("   WHERE user_id=v_uid AND is_demo AND account_number ~ '^PM-[0-9]+$' ORDER BY created_at LIMIT 1;")
    a("  IF v_acc IS NULL THEN")
    a("    SELECT 'PM-' || (COALESCE(MAX(substring(account_number FROM 4)::bigint), 700000) + 1)")
    a("      INTO v_accnum FROM trading_accounts WHERE account_number ~ '^PM-[0-9]+$';")
    a("    INSERT INTO trading_accounts (user_id,account_group_id,account_number,balance,credit,equity,margin_used,free_margin,margin_level,leverage,currency,is_demo,is_active,created_at,updated_at)")
    a(f"    VALUES (v_uid,v_grp,v_accnum,0,0,0,0,0,0,{LEVERAGE},'USD',true,true,'{OPEN_DATE}',now())")
    a("    RETURNING id INTO v_acc;")
    a("  END IF;")
    a("")
    a("  -- 3) clear this account's previously seeded history (idempotent)")
    a("  DELETE FROM trade_history WHERE account_id=v_acc;")
    a("  DELETE FROM transactions  WHERE account_id=v_acc;")
    a("  DELETE FROM positions     WHERE account_id=v_acc;")
    a("")
    a("  -- 4) closed trades, oldest first — position + trade_history + profit/loss tx")
    bal = START_BALANCE
    for r in rows:
        bal += r["profit"]
        side, lots, o, c, p = r["side"], r["lots"], r["entry"], r["exit"], r["profit"]
        tx_type = "profit" if p >= 0 else "loss"
        a(f"  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)")
        a(f"   VALUES (v_acc,v_xau,'{side}','closed',{lots},{o},{c},0,0,{p},'{r['closed']}','{r['opened']}','{r['closed']}') RETURNING id INTO v_pos;")
        a(f"  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)")
        a(f"   VALUES (v_pos,v_acc,v_xau,'{side}',{lots},{o},{c},0,0,{p},'{r['opened']}','{r['closed']}','manual');")
        a(f"  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)")
        a(f"   VALUES (v_uid,v_acc,'{tx_type}',{p},{bal},v_pos,'Close XAUUSD {side} {lots} lots @ {c}','{r['closed']}');")
    assert bal == final
    a("")
    a("  -- 5) final balance")
    a(f"  UPDATE trading_accounts SET balance={final},equity={final},free_margin={final},margin_used=0,margin_level=0,updated_at=now() WHERE id=v_acc;")
    a("")
    a(f"  RAISE NOTICE 'Demo account % for {q(EMAIL)}: balance {final}', v_accnum;")
    a("END $$;")
    a("COMMIT;")
    a("")
    return "\n".join(L)


def main():
    rows = build()
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_demo_pm_xauusd.sql")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(emit(rows))
    print(f"Wrote {out}")
    print(f"  trades        : {len(rows)}")
    print(f"  net profit USD: {NET_PROFIT:,.2f}")
    print(f"  final balance : {START_BALANCE + NET_PROFIT:,.2f}")


if __name__ == "__main__":
    main()
