-- ============================================================================
-- Seed: client Muhammad Saud <saudkhanuae31@gmail.com>
-- Account opened: 2025-11-25 10:00:00+00
-- Deposits: 100,000 (02 Jan 2026) + 50,000 (04 Jan 2026) = 150,000 USD
-- Monthly net profit (% of 150,000, withdrawn on the 5th/6th of next month):
--   January  :  4.2%  =    6,300.00 USD
--   February :  3.4%  =    5,100.00 USD
--   March    :  4.9%  =    7,350.00 USD
--   April    :  5.3%  =    7,950.00 USD
--   May      :  4.6%  =    6,900.00 USD
--   June     :  4.1%  =    6,150.00 USD
-- Instruments: XAUUSD 80% / GBPUSD 10% / US100 (USTEC/NQ) 10%
-- 54 closed trades; final balance 156,150.00 USD
-- Idempotent: re-running rebuilds ONLY this user's data. Runs in one tx.
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_uid uuid; v_acc uuid; v_grp uuid; v_pos uuid;
  v_xau uuid; v_gbp uuid; v_tec uuid;
  v_accnum text; v_accbig bigint;
BEGIN
  SELECT id INTO v_xau FROM instruments WHERE symbol='XAUUSD';
  SELECT id INTO v_gbp FROM instruments WHERE symbol='GBPUSD';
  SELECT id INTO v_tec FROM instruments WHERE symbol='US100';
  IF v_tec IS NULL THEN SELECT id INTO v_tec FROM instruments WHERE symbol='NAS100'; END IF;
  SELECT id INTO v_grp FROM account_groups WHERE name='Standard' ORDER BY created_at LIMIT 1;
  IF v_xau IS NULL OR v_gbp IS NULL OR v_tec IS NULL OR v_grp IS NULL THEN
    RAISE EXCEPTION 'Missing instrument(s) XAUUSD/GBPUSD/US100 or Standard account group';
  END IF;

  -- 1) upsert user
  INSERT INTO users (email,password_hash,first_name,last_name,role,status,kyc_status,country,main_wallet_balance,created_at,updated_at)
  VALUES ('saudkhanuae31@gmail.com', crypt('Proline@2026', gen_salt('bf',12)), 'Muhammad','Saud','user','active','approved','United Arab Emirates',0,'2025-11-25 10:00:00+00','2025-11-25 10:00:00+00')
  ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,status='active',kyc_status='approved',country=EXCLUDED.country,created_at=EXCLUDED.created_at
  RETURNING id INTO v_uid;

  -- 2) clean any prior seeded data for THIS user (idempotent)
  DELETE FROM trade_history WHERE account_id IN (SELECT id FROM trading_accounts WHERE user_id=v_uid);
  DELETE FROM positions     WHERE account_id IN (SELECT id FROM trading_accounts WHERE user_id=v_uid);
  DELETE FROM orders        WHERE account_id IN (SELECT id FROM trading_accounts WHERE user_id=v_uid);
  DELETE FROM transactions  WHERE user_id=v_uid;
  DELETE FROM deposits      WHERE user_id=v_uid;
  DELETE FROM withdrawals   WHERE user_id=v_uid;
  DELETE FROM trading_accounts WHERE user_id=v_uid;

  -- 3) trading account (next numeric account number)
  SELECT COALESCE(MAX(CASE WHEN account_number ~ '^[0-9]+$' THEN account_number::bigint END),700000)+1 INTO v_accbig FROM trading_accounts;
  v_accnum := v_accbig::text;
  INSERT INTO trading_accounts (user_id,account_group_id,account_number,balance,credit,equity,margin_used,free_margin,margin_level,leverage,currency,is_demo,is_active,created_at,updated_at)
  VALUES (v_uid,v_grp,v_accnum,156150.00,0,156150.00,0,156150.00,0,100,'USD',false,true,'2025-11-25 10:00:00+00',now())
  RETURNING id INTO v_acc;

  -- 4) deposits, trades and withdrawals (chronological)
  INSERT INTO deposits (user_id,account_id,amount,currency,method,status,approved_at,created_at)
   VALUES (v_uid,v_acc,100000.00,'USD','bank_transfer','approved','2026-01-02 11:00:00+00','2026-01-02 11:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'deposit',100000.00,100000.00,'Deposit 100,000 USD','2026-01-02 11:00:00+00');
  INSERT INTO deposits (user_id,account_id,amount,currency,method,status,approved_at,created_at)
   VALUES (v_uid,v_acc,50000.00,'USD','bank_transfer','approved','2026-01-04 11:00:00+00','2026-01-04 11:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'deposit',50000.00,150000.00,'Deposit 50,000 USD','2026-01-04 11:00:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1.5,2574.05,2566.01,0,0,1206.47,'2026-01-08 16:38:00+00','XAUUSD historical','2026-01-08 15:12:00+00','2026-01-08 16:38:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1.5,2574.05,2566.01,0,0,1206.47,'2026-01-08 15:12:00+00','2026-01-08 16:38:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2739.64,2733.23,0,0,1281.36,'2026-01-10 16:22:00+00','XAUUSD historical','2026-01-10 12:43:00+00','2026-01-10 16:22:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2739.64,2733.23,0,0,1281.36,'2026-01-10 12:43:00+00','2026-01-10 16:22:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2717.35,2719.37,0,0,-604.80,'2026-01-11 16:28:00+00','XAUUSD historical','2026-01-11 12:36:00+00','2026-01-11 16:28:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2717.35,2719.37,0,0,-604.80,'2026-01-11 12:36:00+00','2026-01-11 16:28:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2708.78,2721.35,0,0,1885.95,'2026-01-13 16:04:00+00','XAUUSD historical','2026-01-13 14:40:00+00','2026-01-13 16:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2708.78,2721.35,0,0,1885.95,'2026-01-13 14:40:00+00','2026-01-13 16:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2597.20,2601.44,0,0,1271.02,'2026-01-14 17:28:00+00','XAUUSD historical','2026-01-14 14:33:00+00','2026-01-14 17:28:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2597.20,2601.44,0,0,1271.02,'2026-01-14 14:33:00+00','2026-01-14 17:28:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2,1.27689,1.27810,0,0,241.45,'2026-01-17 18:10:00+00','GBPUSD historical','2026-01-17 14:03:00+00','2026-01-17 18:10:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2,1.27689,1.27810,0,0,241.45,'2026-01-17 14:03:00+00','2026-01-17 18:10:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1.5,1.28730,1.28989,0,0,388.55,'2026-01-23 21:05:00+00','GBPUSD historical','2026-01-23 18:22:00+00','2026-01-23 21:05:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1.5,1.28730,1.28989,0,0,388.55,'2026-01-23 18:22:00+00','2026-01-23 21:05:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,22050.0,21942.1,0,0,323.67,'2026-01-26 13:06:00+00','US100 historical','2026-01-26 10:02:00+00','2026-01-26 13:06:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,22050.0,21942.1,0,0,323.67,'2026-01-26 10:02:00+00','2026-01-26 13:06:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',1,20525.2,20831.5,0,0,306.33,'2026-01-27 18:06:00+00','US100 historical','2026-01-27 16:57:00+00','2026-01-27 18:06:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',1,20525.2,20831.5,0,0,306.33,'2026-01-27 16:57:00+00','2026-01-27 18:06:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,3780.00,'USD','bank_transfer','completed','2026-02-05 12:00:00+00','2026-02-05 12:00:00+00','2026-02-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',3780.00,152520.00,'January profit withdrawal','2026-02-05 12:00:00+00');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,2520.00,'USD','bank_transfer','completed','2026-02-06 12:30:00+00','2026-02-06 12:30:00+00','2026-02-06 12:30:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',2520.00,150000.00,'January profit withdrawal','2026-02-06 12:30:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2632.50,2626.36,0,0,1228.92,'2026-02-08 19:23:00+00','XAUUSD historical','2026-02-08 18:03:00+00','2026-02-08 19:23:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2632.50,2626.36,0,0,1228.92,'2026-02-08 18:03:00+00','2026-02-08 19:23:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2611.91,2609.95,0,0,-489.60,'2026-02-12 11:04:00+00','XAUUSD historical','2026-02-12 08:26:00+00','2026-02-12 11:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2611.91,2609.95,0,0,-489.60,'2026-02-12 08:26:00+00','2026-02-12 11:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2566.67,2562.74,0,0,1179.54,'2026-02-14 14:03:00+00','XAUUSD historical','2026-02-14 10:55:00+00','2026-02-14 14:03:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2566.67,2562.74,0,0,1179.54,'2026-02-14 10:55:00+00','2026-02-14 14:03:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2726.69,2731.08,0,0,1096.42,'2026-02-18 20:31:00+00','XAUUSD historical','2026-02-18 17:19:00+00','2026-02-18 20:31:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2726.69,2731.08,0,0,1096.42,'2026-02-18 17:19:00+00','2026-02-18 20:31:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2,2703.44,2708.76,0,0,1064.72,'2026-02-19 17:03:00+00','XAUUSD historical','2026-02-19 16:09:00+00','2026-02-19 17:03:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2,2703.44,2708.76,0,0,1064.72,'2026-02-19 16:09:00+00','2026-02-19 17:03:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2,1.26102,1.26234,0,0,264.31,'2026-02-22 13:22:00+00','GBPUSD historical','2026-02-22 10:14:00+00','2026-02-22 13:22:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2,1.26102,1.26234,0,0,264.31,'2026-02-22 10:14:00+00','2026-02-22 13:22:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1,1.25958,1.26204,0,0,245.69,'2026-02-23 18:57:00+00','GBPUSD historical','2026-02-23 15:40:00+00','2026-02-23 18:57:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1,1.25958,1.26204,0,0,245.69,'2026-02-23 15:40:00+00','2026-02-23 18:57:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,21698.0,21609.6,0,0,265.23,'2026-02-24 11:05:00+00','US100 historical','2026-02-24 08:39:00+00','2026-02-24 11:05:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,21698.0,21609.6,0,0,265.23,'2026-02-24 08:39:00+00','2026-02-24 11:05:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',1,21526.4,21771.2,0,0,244.77,'2026-02-26 21:27:00+00','US100 historical','2026-02-26 17:39:00+00','2026-02-26 21:27:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',1,21526.4,21771.2,0,0,244.77,'2026-02-26 17:39:00+00','2026-02-26 21:27:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,3060.00,'USD','bank_transfer','completed','2026-03-05 12:00:00+00','2026-03-05 12:00:00+00','2026-03-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',3060.00,152040.00,'February profit withdrawal','2026-03-05 12:00:00+00');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,2040.00,'USD','bank_transfer','completed','2026-03-06 12:30:00+00','2026-03-06 12:30:00+00','2026-03-06 12:30:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',2040.00,150000.00,'February profit withdrawal','2026-03-06 12:30:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2659.06,2651.59,0,0,1866.36,'2026-03-08 12:40:00+00','XAUUSD historical','2026-03-08 08:57:00+00','2026-03-08 12:40:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2659.06,2651.59,0,0,1866.36,'2026-03-08 08:57:00+00','2026-03-08 12:40:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2699.26,2704.42,0,0,1289.06,'2026-03-10 21:15:00+00','XAUUSD historical','2026-03-10 18:49:00+00','2026-03-10 21:15:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2699.26,2704.42,0,0,1289.06,'2026-03-10 18:49:00+00','2026-03-10 21:15:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2721.11,2738.04,0,0,1693.46,'2026-03-12 12:00:00+00','XAUUSD historical','2026-03-12 09:06:00+00','2026-03-12 12:00:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2721.11,2738.04,0,0,1693.46,'2026-03-12 09:06:00+00','2026-03-12 12:00:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2717.33,2724.28,0,0,1736.72,'2026-03-13 13:02:00+00','XAUUSD historical','2026-03-13 12:39:00+00','2026-03-13 13:02:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2717.33,2724.28,0,0,1736.72,'2026-03-13 12:39:00+00','2026-03-13 13:02:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2573.22,2576.04,0,0,-705.60,'2026-03-14 14:13:00+00','XAUUSD historical','2026-03-14 10:29:00+00','2026-03-14 14:13:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2573.22,2576.04,0,0,-705.60,'2026-03-14 10:29:00+00','2026-03-14 14:13:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1,1.27228,1.26884,0,0,344.08,'2026-03-16 21:17:00+00','GBPUSD historical','2026-03-16 17:02:00+00','2026-03-16 21:17:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1,1.27228,1.26884,0,0,344.08,'2026-03-16 17:02:00+00','2026-03-16 21:17:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1,1.28104,1.27713,0,0,390.92,'2026-03-17 12:34:00+00','GBPUSD historical','2026-03-17 08:14:00+00','2026-03-17 12:34:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1,1.28104,1.27713,0,0,390.92,'2026-03-17 08:14:00+00','2026-03-17 12:34:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',2,21009.9,20814.8,0,0,390.29,'2026-03-18 15:54:00+00','US100 historical','2026-03-18 13:31:00+00','2026-03-18 15:54:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',2,21009.9,20814.8,0,0,390.29,'2026-03-18 13:31:00+00','2026-03-18 15:54:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',2,22257.8,22430.2,0,0,344.71,'2026-03-23 16:53:00+00','US100 historical','2026-03-23 11:45:00+00','2026-03-23 16:53:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',2,22257.8,22430.2,0,0,344.71,'2026-03-23 11:45:00+00','2026-03-23 16:53:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,4410.00,'USD','bank_transfer','completed','2026-04-05 12:00:00+00','2026-04-05 12:00:00+00','2026-04-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',4410.00,152940.00,'March profit withdrawal','2026-04-05 12:00:00+00');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,2940.00,'USD','bank_transfer','completed','2026-04-06 12:30:00+00','2026-04-06 12:30:00+00','2026-04-06 12:30:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',2940.00,150000.00,'March profit withdrawal','2026-04-06 12:30:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2700.74,2683.45,0,0,1728.83,'2026-04-07 22:47:00+00','XAUUSD historical','2026-04-07 17:57:00+00','2026-04-07 22:47:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2700.74,2683.45,0,0,1728.83,'2026-04-07 17:57:00+00','2026-04-07 22:47:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2698.58,2684.79,0,0,1379.00,'2026-04-10 21:02:00+00','XAUUSD historical','2026-04-10 16:16:00+00','2026-04-10 21:02:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2698.58,2684.79,0,0,1379.00,'2026-04-10 16:16:00+00','2026-04-10 21:02:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2584.52,2576.57,0,0,1988.62,'2026-04-11 21:04:00+00','XAUUSD historical','2026-04-11 18:29:00+00','2026-04-11 21:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2584.52,2576.57,0,0,1988.62,'2026-04-11 18:29:00+00','2026-04-11 21:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2717.26,2714.72,0,0,-763.20,'2026-04-13 11:28:00+00','XAUUSD historical','2026-04-13 08:58:00+00','2026-04-13 11:28:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2717.26,2714.72,0,0,-763.20,'2026-04-13 08:58:00+00','2026-04-13 11:28:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2700.96,2690.83,0,0,2026.75,'2026-04-19 21:26:00+00','XAUUSD historical','2026-04-19 17:02:00+00','2026-04-19 21:26:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2700.96,2690.83,0,0,2026.75,'2026-04-19 17:02:00+00','2026-04-19 21:26:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2.5,1.27217,1.27391,0,0,435.02,'2026-04-20 14:26:00+00','GBPUSD historical','2026-04-20 10:26:00+00','2026-04-20 14:26:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2.5,1.27217,1.27391,0,0,435.02,'2026-04-20 10:26:00+00','2026-04-20 14:26:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1.5,1.27584,1.27344,0,0,359.98,'2026-04-23 20:23:00+00','GBPUSD historical','2026-04-23 16:08:00+00','2026-04-23 20:23:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1.5,1.27584,1.27344,0,0,359.98,'2026-04-23 16:08:00+00','2026-04-23 20:23:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',1,20810.3,20479.0,0,0,331.32,'2026-04-25 17:48:00+00','US100 historical','2026-04-25 13:40:00+00','2026-04-25 17:48:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',1,20810.3,20479.0,0,0,331.32,'2026-04-25 13:40:00+00','2026-04-25 17:48:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',1,20344.4,20808.1,0,0,463.68,'2026-04-26 18:38:00+00','US100 historical','2026-04-26 16:40:00+00','2026-04-26 18:38:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',1,20344.4,20808.1,0,0,463.68,'2026-04-26 16:40:00+00','2026-04-26 18:38:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,4770.00,'USD','bank_transfer','completed','2026-05-05 12:00:00+00','2026-05-05 12:00:00+00','2026-05-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',4770.00,153180.00,'April profit withdrawal','2026-05-05 12:00:00+00');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,3180.00,'USD','bank_transfer','completed','2026-05-06 12:30:00+00','2026-05-06 12:30:00+00','2026-05-06 12:30:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',3180.00,150000.00,'April profit withdrawal','2026-05-06 12:30:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2592.94,2604.44,0,0,1725.62,'2026-05-08 16:12:00+00','XAUUSD historical','2026-05-08 11:47:00+00','2026-05-08 16:12:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2592.94,2604.44,0,0,1725.62,'2026-05-08 11:47:00+00','2026-05-08 16:12:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2693.01,2698.79,0,0,1733.86,'2026-05-11 12:59:00+00','XAUUSD historical','2026-05-11 09:59:00+00','2026-05-11 12:59:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2693.01,2698.79,0,0,1733.86,'2026-05-11 09:59:00+00','2026-05-11 12:59:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2601.49,2596.54,0,0,1483.84,'2026-05-13 11:17:00+00','XAUUSD historical','2026-05-13 08:46:00+00','2026-05-13 11:17:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2601.49,2596.54,0,0,1483.84,'2026-05-13 08:46:00+00','2026-05-13 11:17:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2631.63,2628.98,0,0,-662.40,'2026-05-15 12:29:00+00','XAUUSD historical','2026-05-15 10:53:00+00','2026-05-15 12:29:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2631.63,2628.98,0,0,-662.40,'2026-05-15 10:53:00+00','2026-05-15 12:29:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2734.31,2728.11,0,0,1239.08,'2026-05-18 13:27:00+00','XAUUSD historical','2026-05-18 10:08:00+00','2026-05-18 13:27:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2734.31,2728.11,0,0,1239.08,'2026-05-18 10:08:00+00','2026-05-18 13:27:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1,1.27258,1.27610,0,0,352.28,'2026-05-21 15:40:00+00','GBPUSD historical','2026-05-21 14:49:00+00','2026-05-21 15:40:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1,1.27258,1.27610,0,0,352.28,'2026-05-21 14:49:00+00','2026-05-21 15:40:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1,1.27102,1.26764,0,0,337.72,'2026-05-22 18:04:00+00','GBPUSD historical','2026-05-22 13:17:00+00','2026-05-22 18:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1,1.27102,1.26764,0,0,337.72,'2026-05-22 13:17:00+00','2026-05-22 18:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,21345.6,21234.9,0,0,332.04,'2026-05-24 20:42:00+00','US100 historical','2026-05-24 16:11:00+00','2026-05-24 20:42:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,21345.6,21234.9,0,0,332.04,'2026-05-24 16:11:00+00','2026-05-24 20:42:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',1,22135.3,21777.3,0,0,357.96,'2026-05-26 23:35:00+00','US100 historical','2026-05-26 18:04:00+00','2026-05-26 23:35:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',1,22135.3,21777.3,0,0,357.96,'2026-05-26 18:04:00+00','2026-05-26 23:35:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,4140.00,'USD','bank_transfer','completed','2026-06-05 12:00:00+00','2026-06-05 12:00:00+00','2026-06-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',4140.00,152760.00,'May profit withdrawal','2026-06-05 12:00:00+00');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,2760.00,'USD','bank_transfer','completed','2026-06-06 12:30:00+00','2026-06-06 12:30:00+00','2026-06-06 12:30:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',2760.00,150000.00,'May profit withdrawal','2026-06-06 12:30:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2734.71,2739.56,0,0,1212.38,'2026-06-07 12:48:00+00','XAUUSD historical','2026-06-07 08:48:00+00','2026-06-07 12:48:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2734.71,2739.56,0,0,1212.38,'2026-06-07 08:48:00+00','2026-06-07 12:48:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2687.59,2681.51,0,0,1216.55,'2026-06-08 14:57:00+00','XAUUSD historical','2026-06-08 12:49:00+00','2026-06-08 14:57:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2687.59,2681.51,0,0,1216.55,'2026-06-08 12:49:00+00','2026-06-08 14:57:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2632.51,2638.89,0,0,1914.20,'2026-06-09 23:40:00+00','XAUUSD historical','2026-06-09 18:32:00+00','2026-06-09 23:40:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2632.51,2638.89,0,0,1914.20,'2026-06-09 18:32:00+00','2026-06-09 23:40:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2711.00,2705.10,0,0,-590.40,'2026-06-14 21:26:00+00','XAUUSD historical','2026-06-14 17:26:00+00','2026-06-14 21:26:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2711.00,2705.10,0,0,-590.40,'2026-06-14 17:26:00+00','2026-06-14 21:26:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2630.90,2638.68,0,0,1167.27,'2026-06-15 13:34:00+00','XAUUSD historical','2026-06-15 10:54:00+00','2026-06-15 13:34:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2630.90,2638.68,0,0,1167.27,'2026-06-15 10:54:00+00','2026-06-15 13:34:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2.5,1.27306,1.27413,0,0,267.63,'2026-06-17 10:11:00+00','GBPUSD historical','2026-06-17 09:48:00+00','2026-06-17 10:11:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2.5,1.27306,1.27413,0,0,267.63,'2026-06-17 09:48:00+00','2026-06-17 10:11:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',2,1.24247,1.24073,0,0,347.37,'2026-06-20 15:25:00+00','GBPUSD historical','2026-06-20 10:14:00+00','2026-06-20 15:25:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',2,1.24247,1.24073,0,0,347.37,'2026-06-20 10:14:00+00','2026-06-20 15:25:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',2,21290.8,21466.4,0,0,351.25,'2026-06-21 23:46:00+00','US100 historical','2026-06-21 18:30:00+00','2026-06-21 23:46:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',2,21290.8,21466.4,0,0,351.25,'2026-06-21 18:30:00+00','2026-06-21 23:46:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',3,21854.5,21942.4,0,0,263.75,'2026-06-24 18:29:00+00','US100 historical','2026-06-24 13:57:00+00','2026-06-24 18:29:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',3,21854.5,21942.4,0,0,263.75,'2026-06-24 13:57:00+00','2026-06-24 18:29:00+00','manual');

  RAISE NOTICE 'Seeded % % (account %): balance %', 'Muhammad','Saud', v_accnum, 156150.00;
END $$;
COMMIT;
