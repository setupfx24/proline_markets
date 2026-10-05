-- ============================================================================
-- Seed: DEMO account for Muhammad Imran Bhatti <imranaccl71@gmail.com>
-- Demo balance 10,000.00 + 18 XAUUSD trades (Sep 2026) net 21,227.24 = 31,227.24 USD
-- Sign in with the PM-<n> account number (printed below) or the email.
-- Idempotent: re-running keeps the account number, rebuilds its trades. One tx.
-- ============================================================================
\set ON_ERROR_STOP on
\if :{?pw}
\else
  \echo 'Pass the sign-in password: psql ... -v pw=''<password>'' < seed_demo_pm_xauusd.sql'
  \quit
\endif
BEGIN;
SELECT set_config('seed.pw', :'pw', true) \gset
DO $$
DECLARE
  v_uid uuid; v_acc uuid; v_grp uuid; v_pos uuid; v_xau uuid;
  v_accnum text; v_pw text := current_setting('seed.pw', true);
BEGIN
  IF length(coalesce(v_pw,'')) < 8 THEN
    RAISE EXCEPTION 'Sign-in password (-v pw=...) must be at least 8 characters';
  END IF;
  SELECT id INTO v_xau FROM instruments WHERE symbol='XAUUSD';
  SELECT id INTO v_grp FROM account_groups WHERE name='Demo' ORDER BY created_at LIMIT 1;
  IF v_xau IS NULL OR v_grp IS NULL THEN
    RAISE EXCEPTION 'Missing XAUUSD instrument or Demo account group';
  END IF;

  -- 1) upsert the demo user
  INSERT INTO users (email,password_hash,first_name,last_name,role,status,country,is_demo,main_wallet_balance,created_at,updated_at)
  VALUES ('imranaccl71@gmail.com', crypt(v_pw, gen_salt('bf',12)), 'Muhammad Imran','Bhatti','user','active','',true,0,'2026-08-31 09:00:00+00','2026-08-31 09:00:00+00')
  ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,status='active',password_hash=EXCLUDED.password_hash
  RETURNING id INTO v_uid;

  -- 2) reuse this user's PM demo account, or open the next PM-<n>
  SELECT id, account_number INTO v_acc, v_accnum FROM trading_accounts
   WHERE user_id=v_uid AND is_demo AND account_number ~ '^PM-[0-9]+$' ORDER BY created_at LIMIT 1;
  IF v_acc IS NULL THEN
    SELECT 'PM-' || (COALESCE(MAX(substring(account_number FROM 4)::bigint), 700000) + 1)
      INTO v_accnum FROM trading_accounts WHERE account_number ~ '^PM-[0-9]+$';
    INSERT INTO trading_accounts (user_id,account_group_id,account_number,balance,credit,equity,margin_used,free_margin,margin_level,leverage,currency,is_demo,is_active,created_at,updated_at)
    VALUES (v_uid,v_grp,v_accnum,0,0,0,0,0,0,100,'USD',true,true,'2026-08-31 09:00:00+00',now())
    RETURNING id INTO v_acc;
  END IF;

  -- 3) clear this account's previously seeded history (idempotent)
  DELETE FROM trade_history WHERE account_id=v_acc;
  DELETE FROM transactions  WHERE account_id=v_acc;
  DELETE FROM positions     WHERE account_id=v_acc;

  -- 4) closed trades, oldest first — position + trade_history + profit/loss tx
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.60,4379.180,4359.189,0,0,1199.46,'2026-09-01 15:46:00+00','2026-09-01 10:01:00+00','2026-09-01 15:46:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.60,4379.180,4359.189,0,0,1199.46,'2026-09-01 10:01:00+00','2026-09-01 15:46:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1199.46,11199.46,v_pos,'Close XAUUSD sell 0.60 lots @ 4359.189','2026-09-01 15:46:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.55,4335.000,4355.005,0,0,1100.28,'2026-09-02 15:18:00+00','2026-09-02 12:34:00+00','2026-09-02 15:18:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.55,4335.000,4355.005,0,0,1100.28,'2026-09-02 12:34:00+00','2026-09-02 15:18:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1100.28,12299.74,v_pos,'Close XAUUSD buy 0.55 lots @ 4355.005','2026-09-02 15:18:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.65,4400.000,4425.000,0,0,1625.00,'2026-09-03 13:53:00+00','2026-09-03 11:20:00+00','2026-09-03 13:53:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.65,4400.000,4425.000,0,0,1625.00,'2026-09-03 11:20:00+00','2026-09-03 13:53:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1625.00,13924.74,v_pos,'Close XAUUSD buy 0.65 lots @ 4425.000','2026-09-03 13:53:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.70,4470.000,4450.000,0,0,1400.00,'2026-09-04 13:06:00+00','2026-09-04 10:21:00+00','2026-09-04 13:06:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.70,4470.000,4450.000,0,0,1400.00,'2026-09-04 10:21:00+00','2026-09-04 13:06:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1400.00,15324.74,v_pos,'Close XAUUSD sell 0.70 lots @ 4450.000','2026-09-04 13:06:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.50,4400.000,4390.000,0,0,-500.00,'2026-09-07 12:37:00+00','2026-09-07 09:21:00+00','2026-09-07 12:37:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.50,4400.000,4390.000,0,0,-500.00,'2026-09-07 09:21:00+00','2026-09-07 12:37:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'loss',-500.00,14824.74,v_pos,'Close XAUUSD buy 0.50 lots @ 4390.000','2026-09-07 12:37:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.60,4400.000,4375.000,0,0,1500.00,'2026-09-08 14:39:00+00','2026-09-08 10:23:00+00','2026-09-08 14:39:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.60,4400.000,4375.000,0,0,1500.00,'2026-09-08 10:23:00+00','2026-09-08 14:39:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1500.00,16324.74,v_pos,'Close XAUUSD sell 0.60 lots @ 4375.000','2026-09-08 14:39:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.49,4360.000,4380.000,0,0,980.00,'2026-09-09 13:44:00+00','2026-09-09 08:06:00+00','2026-09-09 13:44:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.49,4360.000,4380.000,0,0,980.00,'2026-09-09 08:06:00+00','2026-09-09 13:44:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',980.00,17304.74,v_pos,'Close XAUUSD buy 0.49 lots @ 4380.000','2026-09-09 13:44:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.70,4400.000,4375.000,0,0,1750.00,'2026-09-10 16:04:00+00','2026-09-10 10:00:00+00','2026-09-10 16:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.70,4400.000,4375.000,0,0,1750.00,'2026-09-10 10:00:00+00','2026-09-10 16:04:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1750.00,19054.74,v_pos,'Close XAUUSD sell 0.70 lots @ 4375.000','2026-09-10 16:04:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.43,4320.000,4340.000,0,0,860.00,'2026-09-11 15:39:00+00','2026-09-11 11:27:00+00','2026-09-11 15:39:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.43,4320.000,4340.000,0,0,860.00,'2026-09-11 11:27:00+00','2026-09-11 15:39:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',860.00,19914.74,v_pos,'Close XAUUSD buy 0.43 lots @ 4340.000','2026-09-11 15:39:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.55,4330.000,4305.000,0,0,1375.00,'2026-09-14 11:44:00+00','2026-09-14 07:04:00+00','2026-09-14 11:44:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.55,4330.000,4305.000,0,0,1375.00,'2026-09-14 07:04:00+00','2026-09-14 11:44:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1375.00,21289.74,v_pos,'Close XAUUSD sell 0.55 lots @ 4305.000','2026-09-14 11:44:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.60,4300.000,4275.000,0,0,1500.00,'2026-09-16 12:55:00+00','2026-09-16 07:38:00+00','2026-09-16 12:55:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.60,4300.000,4275.000,0,0,1500.00,'2026-09-16 07:38:00+00','2026-09-16 12:55:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1500.00,22789.74,v_pos,'Close XAUUSD sell 0.60 lots @ 4275.000','2026-09-16 12:55:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.80,4280.000,4305.000,0,0,2000.00,'2026-09-17 16:24:00+00','2026-09-17 11:05:00+00','2026-09-17 16:24:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.80,4280.000,4305.000,0,0,2000.00,'2026-09-17 11:05:00+00','2026-09-17 16:24:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',2000.00,24789.74,v_pos,'Close XAUUSD buy 0.80 lots @ 4305.000','2026-09-17 16:24:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.47,4350.000,4370.000,0,0,940.00,'2026-09-18 13:40:00+00','2026-09-18 10:57:00+00','2026-09-18 13:40:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.47,4350.000,4370.000,0,0,940.00,'2026-09-18 10:57:00+00','2026-09-18 13:40:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',940.00,25729.74,v_pos,'Close XAUUSD buy 0.47 lots @ 4370.000','2026-09-18 13:40:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.64,4370.000,4350.000,0,0,1280.00,'2026-09-21 12:43:00+00','2026-09-21 09:50:00+00','2026-09-21 12:43:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.64,4370.000,4350.000,0,0,1280.00,'2026-09-21 09:50:00+00','2026-09-21 12:43:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1280.00,27009.74,v_pos,'Close XAUUSD sell 0.64 lots @ 4350.000','2026-09-21 12:43:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.50,4330.000,4320.000,0,0,-500.00,'2026-09-22 13:07:00+00','2026-09-22 10:13:00+00','2026-09-22 13:07:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.50,4330.000,4320.000,0,0,-500.00,'2026-09-22 10:13:00+00','2026-09-22 13:07:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'loss',-500.00,26509.74,v_pos,'Close XAUUSD buy 0.50 lots @ 4320.000','2026-09-22 13:07:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.65,4340.000,4318.000,0,0,1430.00,'2026-09-23 11:06:00+00','2026-09-23 09:54:00+00','2026-09-23 11:06:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.65,4340.000,4318.000,0,0,1430.00,'2026-09-23 09:54:00+00','2026-09-23 11:06:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1430.00,27939.74,v_pos,'Close XAUUSD sell 0.65 lots @ 4318.000','2026-09-23 11:06:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.85,4260.000,4238.820,0,0,1800.30,'2026-09-28 11:01:00+00','2026-09-28 10:29:00+00','2026-09-28 11:01:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.85,4260.000,4238.820,0,0,1800.30,'2026-09-28 10:29:00+00','2026-09-28 11:01:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1800.30,29740.04,v_pos,'Close XAUUSD sell 0.85 lots @ 4238.820','2026-09-28 11:01:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.55,4140.000,4167.040,0,0,1487.20,'2026-09-29 13:47:00+00','2026-09-29 10:09:00+00','2026-09-29 13:47:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.55,4140.000,4167.040,0,0,1487.20,'2026-09-29 10:09:00+00','2026-09-29 13:47:00+00','manual');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,reference_id,description,created_at)
   VALUES (v_uid,v_acc,'profit',1487.20,31227.24,v_pos,'Close XAUUSD buy 0.55 lots @ 4167.040','2026-09-29 13:47:00+00');

  -- 5) final balance
  UPDATE trading_accounts SET balance=31227.24,equity=31227.24,free_margin=31227.24,margin_used=0,margin_level=0,updated_at=now() WHERE id=v_acc;

  RAISE NOTICE 'Demo account % for imranaccl71@gmail.com: balance 31227.24', v_accnum;
END $$;
COMMIT;
