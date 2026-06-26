-- ============================================================================
-- Seed: client Muhammad Saud <saudkhanuae31@gmail.com>
-- Account opened: 2025-11-25 10:00:00+00
-- Deposits: 100,000 (02 Jan 2026) + 50,000 (04 Jan 2026) = 150,000 (USDT)
-- Monthly net profit (% of 150,000, withdrawn in USDT on the 5th of next month):
--   January  :  4.5%  =    6,750.00
--   February :  4.3%  =    6,450.00
--   March    :  4.9%  =    7,350.00
--   April    :  5.0%  =    7,500.00
--   May      :  4.6%  =    6,900.00
--   June     :  4.4%  =    6,600.00
-- Instruments: XAUUSD 80% / GBPUSD 10% / US100 (USTEC/NQ) 10%
-- 90 closed trades; final balance 156,600.00 USD
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
  VALUES (v_uid,v_grp,v_accnum,156600.00,0,156600.00,0,156600.00,0,100,'USD',false,true,'2025-11-25 10:00:00+00',now())
  RETURNING id INTO v_acc;

  -- 4) deposits, trades and withdrawals (chronological)
  INSERT INTO deposits (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,transaction_id,approved_at,created_at)
   VALUES (v_uid,v_acc,100000.00,'USDT','crypto_usdt','approved','TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu','2a260e8846df35ea48e960f970266ba1894a518d30371883b331d61582cd8172','bf4178951a1fbfc4','2026-01-02 11:00:00+00','2026-01-02 11:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'deposit',100000.00,100000.00,'USDT deposit 100,000','2026-01-02 11:00:00+00');
  INSERT INTO deposits (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,transaction_id,approved_at,created_at)
   VALUES (v_uid,v_acc,50000.00,'USDT','crypto_usdt','approved','TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu','173762a966571583fccc80d620bea68f8f808f7ee2c3d5bf47dd6d610ac15e10','5fd7a2715c71e6e6','2026-01-04 11:00:00+00','2026-01-04 11:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'deposit',50000.00,150000.00,'USDT deposit 50,000','2026-01-04 11:00:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2683.09,2680.20,0,0,722.06,'2026-01-07 21:08:00+00','XAUUSD historical','2026-01-07 17:13:00+00','2026-01-07 21:08:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2683.09,2680.20,0,0,722.06,'2026-01-07 17:13:00+00','2026-01-07 21:08:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2602.61,2606.77,0,0,-415.80,'2026-01-08 14:13:00+00','XAUUSD historical','2026-01-08 09:01:00+00','2026-01-08 14:13:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2602.61,2606.77,0,0,-415.80,'2026-01-08 09:01:00+00','2026-01-08 14:13:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2627.33,2624.29,0,0,760.69,'2026-01-10 18:45:00+00','XAUUSD historical','2026-01-10 15:37:00+00','2026-01-10 18:45:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2627.33,2624.29,0,0,760.69,'2026-01-10 15:37:00+00','2026-01-10 18:45:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2692.80,2695.36,0,0,768.55,'2026-01-11 18:10:00+00','XAUUSD historical','2026-01-11 14:03:00+00','2026-01-11 18:10:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2692.80,2695.36,0,0,768.55,'2026-01-11 14:03:00+00','2026-01-11 18:10:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2730.29,2737.54,0,0,1086.92,'2026-01-12 21:05:00+00','XAUUSD historical','2026-01-12 18:22:00+00','2026-01-12 21:05:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2730.29,2737.54,0,0,1086.92,'2026-01-12 18:22:00+00','2026-01-12 21:05:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2722.69,2718.93,0,0,1128.72,'2026-01-14 13:06:00+00','XAUUSD historical','2026-01-14 10:02:00+00','2026-01-14 13:06:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2722.69,2718.93,0,0,1128.72,'2026-01-14 10:02:00+00','2026-01-14 13:06:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2617.13,2623.28,0,0,922.19,'2026-01-15 18:06:00+00','XAUUSD historical','2026-01-15 16:57:00+00','2026-01-15 18:06:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2617.13,2623.28,0,0,922.19,'2026-01-15 16:57:00+00','2026-01-15 18:06:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2630.71,2628.44,0,0,-340.20,'2026-01-16 13:46:00+00','XAUUSD historical','2026-01-16 11:17:00+00','2026-01-16 13:46:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2630.71,2628.44,0,0,-340.20,'2026-01-16 11:17:00+00','2026-01-16 13:46:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1.5,2673.09,2667.98,0,0,766.87,'2026-01-17 12:10:00+00','XAUUSD historical','2026-01-17 08:51:00+00','2026-01-17 12:10:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1.5,2673.09,2667.98,0,0,766.87,'2026-01-17 08:51:00+00','2026-01-17 12:10:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1,1.28514,1.28732,0,0,218.26,'2026-01-18 20:30:00+00','GBPUSD historical','2026-01-18 17:22:00+00','2026-01-18 20:30:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1,1.28514,1.28732,0,0,218.26,'2026-01-18 17:22:00+00','2026-01-18 20:30:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',2,1.26014,1.25898,0,0,232.21,'2026-01-19 19:23:00+00','GBPUSD historical','2026-01-19 18:03:00+00','2026-01-19 19:23:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',2,1.26014,1.25898,0,0,232.21,'2026-01-19 18:03:00+00','2026-01-19 19:23:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2.5,1.25442,1.25532,0,0,224.53,'2026-01-20 11:04:00+00','GBPUSD historical','2026-01-20 08:26:00+00','2026-01-20 11:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2.5,1.25442,1.25532,0,0,224.53,'2026-01-20 08:26:00+00','2026-01-20 11:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,19796.3,19708.0,0,0,264.80,'2026-01-22 14:03:00+00','US100 historical','2026-01-22 10:55:00+00','2026-01-22 14:03:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,19796.3,19708.0,0,0,264.80,'2026-01-22 10:55:00+00','2026-01-22 14:03:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',2,22107.8,22212.6,0,0,209.58,'2026-01-24 20:31:00+00','US100 historical','2026-01-24 17:19:00+00','2026-01-24 20:31:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',2,22107.8,22212.6,0,0,209.58,'2026-01-24 17:19:00+00','2026-01-24 20:31:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',2,21771.8,21872.1,0,0,200.62,'2026-01-27 17:03:00+00','US100 historical','2026-01-27 16:09:00+00','2026-01-27 17:03:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',2,21771.8,21872.1,0,0,200.62,'2026-01-27 16:09:00+00','2026-01-27 17:03:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,6750.00,'USDT','crypto_usdt','completed','TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu','fdafeca2c88a3b48b34d30fd69aa907058e0060205f08a8a36fb72a07e9c5e72','2026-02-05 12:00:00+00','2026-02-05 12:00:00+00','2026-02-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',6750.00,150000.00,'January profit withdrawal (USDT)','2026-02-05 12:00:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2597.57,2600.87,0,0,824.14,'2026-02-09 20:06:00+00','XAUUSD historical','2026-02-09 18:23:00+00','2026-02-09 20:06:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2597.57,2600.87,0,0,824.14,'2026-02-09 18:23:00+00','2026-02-09 20:06:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2735.02,2736.10,0,0,-325.08,'2026-02-11 19:25:00+00','XAUUSD historical','2026-02-11 17:42:00+00','2026-02-11 19:25:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2735.02,2736.10,0,0,-325.08,'2026-02-11 17:42:00+00','2026-02-11 19:25:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2690.81,2683.38,0,0,742.60,'2026-02-12 19:02:00+00','XAUUSD historical','2026-02-12 16:46:00+00','2026-02-12 19:02:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2690.81,2683.38,0,0,742.60,'2026-02-12 16:46:00+00','2026-02-12 19:02:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2706.22,2702.48,0,0,935.42,'2026-02-13 14:15:00+00','XAUUSD historical','2026-02-13 11:49:00+00','2026-02-13 14:15:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2706.22,2702.48,0,0,935.42,'2026-02-13 11:49:00+00','2026-02-13 14:15:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2721.11,2730.88,0,0,977.10,'2026-02-15 12:00:00+00','XAUUSD historical','2026-02-15 09:06:00+00','2026-02-15 12:00:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2721.11,2730.88,0,0,977.10,'2026-02-15 09:06:00+00','2026-02-15 12:00:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2717.33,2721.04,0,0,928.48,'2026-02-16 13:02:00+00','XAUUSD historical','2026-02-16 12:39:00+00','2026-02-16 13:02:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2717.33,2721.04,0,0,928.48,'2026-02-16 12:39:00+00','2026-02-16 13:02:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2573.22,2574.81,0,0,-397.32,'2026-02-17 14:13:00+00','XAUUSD historical','2026-02-17 10:29:00+00','2026-02-17 14:13:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2573.22,2574.81,0,0,-397.32,'2026-02-17 10:29:00+00','2026-02-17 14:13:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2676.23,2669.15,0,0,707.85,'2026-02-18 21:17:00+00','XAUUSD historical','2026-02-18 17:02:00+00','2026-02-18 21:17:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2676.23,2669.15,0,0,707.85,'2026-02-18 17:02:00+00','2026-02-18 21:17:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2707.76,2700.09,0,0,766.81,'2026-02-19 12:34:00+00','XAUUSD historical','2026-02-19 08:14:00+00','2026-02-19 12:34:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2707.76,2700.09,0,0,766.81,'2026-02-19 08:14:00+00','2026-02-19 12:34:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',2,1.26519,1.26413,0,0,211.14,'2026-02-20 15:54:00+00','GBPUSD historical','2026-02-20 13:31:00+00','2026-02-20 15:54:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',2,1.26519,1.26413,0,0,211.14,'2026-02-20 13:31:00+00','2026-02-20 15:54:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2,1.28919,1.29020,0,0,202.20,'2026-02-21 16:53:00+00','GBPUSD historical','2026-02-21 11:45:00+00','2026-02-21 16:53:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2,1.28919,1.29020,0,0,202.20,'2026-02-21 11:45:00+00','2026-02-21 16:53:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1.5,1.27120,1.26966,0,0,231.66,'2026-02-22 17:11:00+00','GBPUSD historical','2026-02-22 15:42:00+00','2026-02-22 17:11:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1.5,1.27120,1.26966,0,0,231.66,'2026-02-22 15:42:00+00','2026-02-22 17:11:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',2,22287.8,22372.1,0,0,168.58,'2026-02-24 18:44:00+00','US100 historical','2026-02-24 17:29:00+00','2026-02-24 18:44:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',2,22287.8,22372.1,0,0,168.58,'2026-02-24 17:29:00+00','2026-02-24 18:44:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',1,19776.9,19550.0,0,0,226.94,'2026-02-25 15:14:00+00','US100 historical','2026-02-25 10:24:00+00','2026-02-25 15:14:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',1,19776.9,19550.0,0,0,226.94,'2026-02-25 10:24:00+00','2026-02-25 15:14:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',2,22268.3,22393.0,0,0,249.48,'2026-02-26 19:45:00+00','US100 historical','2026-02-26 14:37:00+00','2026-02-26 19:45:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',2,22268.3,22393.0,0,0,249.48,'2026-02-26 14:37:00+00','2026-02-26 19:45:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,6450.00,'USDT','crypto_usdt','completed','TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu','a9a49684fb87ca02332c6e3133057c22ddb213652d3942319eddc0e545781726','2026-03-05 12:00:00+00','2026-03-05 12:00:00+00','2026-03-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',6450.00,150000.00,'February profit withdrawal (USDT)','2026-03-05 12:00:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2624.23,2627.08,0,0,854.28,'2026-03-08 19:08:00+00','XAUUSD historical','2026-03-08 14:29:00+00','2026-03-08 19:08:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2624.23,2627.08,0,0,854.28,'2026-03-08 14:29:00+00','2026-03-08 19:08:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2,2698.95,2697.10,0,0,-370.44,'2026-03-09 16:49:00+00','XAUUSD historical','2026-03-09 14:46:00+00','2026-03-09 16:49:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2,2698.95,2697.10,0,0,-370.44,'2026-03-09 14:46:00+00','2026-03-09 16:49:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2674.52,2669.49,0,0,1005.80,'2026-03-13 11:57:00+00','XAUUSD historical','2026-03-13 09:15:00+00','2026-03-13 11:57:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2674.52,2669.49,0,0,1005.80,'2026-03-13 09:15:00+00','2026-03-13 11:57:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2673.99,2676.93,0,0,881.70,'2026-03-14 17:39:00+00','XAUUSD historical','2026-03-14 12:13:00+00','2026-03-14 17:39:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2673.99,2676.93,0,0,881.70,'2026-03-14 12:13:00+00','2026-03-14 17:39:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2577.03,2584.49,0,0,745.99,'2026-03-15 11:02:00+00','XAUUSD historical','2026-03-15 10:49:00+00','2026-03-15 11:02:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2577.03,2584.49,0,0,745.99,'2026-03-15 10:49:00+00','2026-03-15 11:02:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2710.69,2722.64,0,0,1195.35,'2026-03-16 21:35:00+00','XAUUSD historical','2026-03-16 18:17:00+00','2026-03-16 21:35:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2710.69,2722.64,0,0,1195.35,'2026-03-16 18:17:00+00','2026-03-16 21:35:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2579.20,2586.46,0,0,1089.04,'2026-03-17 11:11:00+00','XAUUSD historical','2026-03-17 09:13:00+00','2026-03-17 11:11:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2579.20,2586.46,0,0,1089.04,'2026-03-17 09:13:00+00','2026-03-17 11:11:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2668.02,2674.23,0,0,931.04,'2026-03-18 13:59:00+00','XAUUSD historical','2026-03-18 12:18:00+00','2026-03-18 13:59:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2668.02,2674.23,0,0,931.04,'2026-03-18 12:18:00+00','2026-03-18 13:59:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2601.49,2603.00,0,0,-452.76,'2026-03-20 11:17:00+00','XAUUSD historical','2026-03-20 08:46:00+00','2026-03-20 11:17:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2601.49,2603.00,0,0,-452.76,'2026-03-20 08:46:00+00','2026-03-20 11:17:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2.5,1.25990,1.26100,0,0,275.72,'2026-03-21 12:29:00+00','GBPUSD historical','2026-03-21 10:53:00+00','2026-03-21 12:29:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2.5,1.25990,1.26100,0,0,275.72,'2026-03-21 10:53:00+00','2026-03-21 12:29:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',2,1.28842,1.28753,0,0,178.01,'2026-03-22 13:27:00+00','GBPUSD historical','2026-03-22 10:08:00+00','2026-03-22 13:27:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',2,1.28842,1.28753,0,0,178.01,'2026-03-22 10:08:00+00','2026-03-22 13:27:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1,1.27258,1.27539,0,0,281.27,'2026-03-23 15:40:00+00','GBPUSD historical','2026-03-23 14:49:00+00','2026-03-23 15:40:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1,1.27258,1.27539,0,0,281.27,'2026-03-23 14:49:00+00','2026-03-23 15:40:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',1,21312.9,21063.3,0,0,249.62,'2026-03-24 18:04:00+00','US100 historical','2026-03-24 13:17:00+00','2026-03-24 18:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',1,21312.9,21063.3,0,0,249.62,'2026-03-24 13:17:00+00','2026-03-24 18:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,21345.6,21273.2,0,0,217.26,'2026-03-26 20:42:00+00','US100 historical','2026-03-26 16:11:00+00','2026-03-26 20:42:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,21345.6,21273.2,0,0,217.26,'2026-03-26 16:11:00+00','2026-03-26 20:42:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',1,22135.3,21867.2,0,0,268.12,'2026-03-27 23:35:00+00','US100 historical','2026-03-27 18:04:00+00','2026-03-27 23:35:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',1,22135.3,21867.2,0,0,268.12,'2026-03-27 18:04:00+00','2026-03-27 23:35:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,7350.00,'USDT','crypto_usdt','completed','TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu','9625df8557c4f953f108747270964bfacf013e4f649d09a2cdd9c0e6dfa62233','2026-04-05 12:00:00+00','2026-04-05 12:00:00+00','2026-04-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',7350.00,150000.00,'March profit withdrawal (USDT)','2026-04-05 12:00:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2635.21,2629.48,0,0,1431.37,'2026-04-07 16:25:00+00','XAUUSD historical','2026-04-07 11:02:00+00','2026-04-07 16:25:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2635.21,2629.48,0,0,1431.37,'2026-04-07 11:02:00+00','2026-04-07 16:25:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2677.52,2673.74,0,0,-378.00,'2026-04-08 20:09:00+00','XAUUSD historical','2026-04-08 16:39:00+00','2026-04-08 20:09:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2677.52,2673.74,0,0,-378.00,'2026-04-08 16:39:00+00','2026-04-08 20:09:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2697.57,2706.67,0,0,909.69,'2026-04-10 16:38:00+00','XAUUSD historical','2026-04-10 13:03:00+00','2026-04-10 16:38:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2697.57,2706.67,0,0,909.69,'2026-04-10 13:03:00+00','2026-04-10 16:38:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2631.82,2637.97,0,0,922.43,'2026-04-13 19:39:00+00','XAUUSD historical','2026-04-13 14:11:00+00','2026-04-13 19:39:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2631.82,2637.97,0,0,922.43,'2026-04-13 14:11:00+00','2026-04-13 19:39:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2689.56,2691.10,0,0,-462.00,'2026-04-15 23:53:00+00','XAUUSD historical','2026-04-15 18:14:00+00','2026-04-15 23:53:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2689.56,2691.10,0,0,-462.00,'2026-04-15 18:14:00+00','2026-04-15 23:53:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2590.70,2586.32,0,0,876.65,'2026-04-18 20:23:00+00','XAUUSD historical','2026-04-18 15:22:00+00','2026-04-18 20:23:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2590.70,2586.32,0,0,876.65,'2026-04-18 15:22:00+00','2026-04-18 20:23:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2564.23,2559.87,0,0,872.84,'2026-04-19 12:16:00+00','XAUUSD historical','2026-04-19 11:28:00+00','2026-04-19 12:16:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2564.23,2559.87,0,0,872.84,'2026-04-19 11:28:00+00','2026-04-19 12:16:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2684.34,2690.48,0,0,920.45,'2026-04-20 14:54:00+00','XAUUSD historical','2026-04-20 11:30:00+00','2026-04-20 14:54:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2684.34,2690.48,0,0,920.45,'2026-04-20 11:30:00+00','2026-04-20 14:54:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2627.18,2633.22,0,0,906.57,'2026-04-21 17:19:00+00','XAUUSD historical','2026-04-21 13:58:00+00','2026-04-21 17:19:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2627.18,2633.22,0,0,906.57,'2026-04-21 13:58:00+00','2026-04-21 17:19:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1,1.27693,1.27490,0,0,203.44,'2026-04-22 21:46:00+00','GBPUSD historical','2026-04-22 16:29:00+00','2026-04-22 21:46:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1,1.27693,1.27490,0,0,203.44,'2026-04-22 16:29:00+00','2026-04-22 21:46:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1.5,1.28699,1.28869,0,0,255.46,'2026-04-23 15:26:00+00','GBPUSD historical','2026-04-23 14:11:00+00','2026-04-23 15:26:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1.5,1.28699,1.28869,0,0,255.46,'2026-04-23 14:11:00+00','2026-04-23 15:26:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1,1.26549,1.26840,0,0,291.10,'2026-04-24 18:32:00+00','GBPUSD historical','2026-04-24 14:37:00+00','2026-04-24 18:32:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1,1.26549,1.26840,0,0,291.10,'2026-04-24 14:37:00+00','2026-04-24 18:32:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',3,21326.4,21415.7,0,0,268.00,'2026-04-25 18:16:00+00','US100 historical','2026-04-25 13:07:00+00','2026-04-25 18:16:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',3,21326.4,21415.7,0,0,268.00,'2026-04-25 13:07:00+00','2026-04-25 18:16:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,20997.3,20898.7,0,0,295.70,'2026-04-26 09:12:00+00','US100 historical','2026-04-26 08:06:00+00','2026-04-26 09:12:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,20997.3,20898.7,0,0,295.70,'2026-04-26 08:06:00+00','2026-04-26 09:12:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',1,19772.0,19585.7,0,0,186.30,'2026-04-27 11:57:00+00','US100 historical','2026-04-27 10:30:00+00','2026-04-27 11:57:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',1,19772.0,19585.7,0,0,186.30,'2026-04-27 10:30:00+00','2026-04-27 11:57:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,7500.00,'USDT','crypto_usdt','completed','TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu','e93ebbae4d0711fec0e050e10a8955e02592b903b4374d7def96b19f88cbba4b','2026-05-05 12:00:00+00','2026-05-05 12:00:00+00','2026-05-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',7500.00,150000.00,'April profit withdrawal (USDT)','2026-05-05 12:00:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2736.68,2740.75,0,0,1016.40,'2026-05-07 11:03:00+00','XAUUSD historical','2026-05-07 09:40:00+00','2026-05-07 11:03:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2736.68,2740.75,0,0,1016.40,'2026-05-07 09:40:00+00','2026-05-07 11:03:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2653.02,2656.44,0,0,1026.80,'2026-05-08 19:49:00+00','XAUUSD historical','2026-05-08 18:58:00+00','2026-05-08 19:49:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2653.02,2656.44,0,0,1026.80,'2026-05-08 18:58:00+00','2026-05-08 19:49:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2607.28,2603.31,0,0,993.73,'2026-05-10 19:04:00+00','XAUUSD historical','2026-05-10 17:59:00+00','2026-05-10 19:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2607.28,2603.31,0,0,993.73,'2026-05-10 17:59:00+00','2026-05-10 19:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2650.32,2652.06,0,0,-347.76,'2026-05-11 19:32:00+00','XAUUSD historical','2026-05-11 18:03:00+00','2026-05-11 19:32:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2650.32,2652.06,0,0,-347.76,'2026-05-11 18:03:00+00','2026-05-11 19:32:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1.5,2683.14,2680.31,0,0,-425.04,'2026-05-12 18:12:00+00','XAUUSD historical','2026-05-12 15:50:00+00','2026-05-12 18:12:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1.5,2683.14,2680.31,0,0,-425.04,'2026-05-12 15:50:00+00','2026-05-12 18:12:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2674.83,2671.66,0,0,952.01,'2026-05-15 21:24:00+00','XAUUSD historical','2026-05-15 17:56:00+00','2026-05-15 21:24:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2674.83,2671.66,0,0,952.01,'2026-05-15 17:56:00+00','2026-05-15 21:24:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2693.10,2690.29,0,0,843.11,'2026-05-16 22:56:00+00','XAUUSD historical','2026-05-16 18:48:00+00','2026-05-16 22:56:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2693.10,2690.29,0,0,843.11,'2026-05-16 18:48:00+00','2026-05-16 22:56:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1.5,2676.03,2671.36,0,0,700.38,'2026-05-17 14:49:00+00','XAUUSD historical','2026-05-17 13:33:00+00','2026-05-17 14:49:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1.5,2676.03,2671.36,0,0,700.38,'2026-05-17 13:33:00+00','2026-05-17 14:49:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2,2574.19,2570.39,0,0,760.37,'2026-05-18 20:18:00+00','XAUUSD historical','2026-05-18 17:19:00+00','2026-05-18 20:18:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2,2574.19,2570.39,0,0,760.37,'2026-05-18 17:19:00+00','2026-05-18 20:18:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2,1.26368,1.26517,0,0,297.79,'2026-05-19 17:24:00+00','GBPUSD historical','2026-05-19 16:20:00+00','2026-05-19 17:24:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2,1.26368,1.26517,0,0,297.79,'2026-05-19 16:20:00+00','2026-05-19 17:24:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1.5,1.27689,1.27558,0,0,196.74,'2026-05-21 13:30:00+00','GBPUSD historical','2026-05-21 10:54:00+00','2026-05-21 13:30:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1.5,1.27689,1.27558,0,0,196.74,'2026-05-21 10:54:00+00','2026-05-21 13:30:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',1.5,1.24432,1.24562,0,0,195.47,'2026-05-22 15:25:00+00','GBPUSD historical','2026-05-22 12:38:00+00','2026-05-22 15:25:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',1.5,1.24432,1.24562,0,0,195.47,'2026-05-22 12:38:00+00','2026-05-22 15:25:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',1,20519.5,20272.2,0,0,247.29,'2026-05-23 16:59:00+00','US100 historical','2026-05-23 15:34:00+00','2026-05-23 16:59:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',1,20519.5,20272.2,0,0,247.29,'2026-05-23 15:34:00+00','2026-05-23 16:59:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,22043.0,21956.9,0,0,258.19,'2026-05-24 14:53:00+00','US100 historical','2026-05-24 11:19:00+00','2026-05-24 14:53:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,22043.0,21956.9,0,0,258.19,'2026-05-24 11:19:00+00','2026-05-24 14:53:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',3,21979.6,21918.1,0,0,184.52,'2026-05-27 12:20:00+00','US100 historical','2026-05-27 09:13:00+00','2026-05-27 12:20:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',3,21979.6,21918.1,0,0,184.52,'2026-05-27 09:13:00+00','2026-05-27 12:20:00+00','manual');
  INSERT INTO withdrawals (user_id,account_id,amount,currency,method,status,crypto_address,crypto_tx_hash,approved_at,completed_at,created_at)
   VALUES (v_uid,v_acc,6900.00,'USDT','crypto_usdt','completed','TQ9Lm5kS3vN8pHq2wYbR7cZ4dF6gJ1aXu','f1328aeecd3b6007eb095105e8c077886e7e1a86d5de2a7b50c44a123b0b96a8','2026-06-05 12:00:00+00','2026-06-05 12:00:00+00','2026-06-05 12:00:00+00');
  INSERT INTO transactions (user_id,account_id,type,amount,balance_after,description,created_at)
   VALUES (v_uid,v_acc,'withdrawal',6900.00,150000.00,'May profit withdrawal (USDT)','2026-06-05 12:00:00+00');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',3,2580.08,2582.58,0,0,749.45,'2026-06-08 16:41:00+00','XAUUSD historical','2026-06-08 15:48:00+00','2026-06-08 16:41:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',3,2580.08,2582.58,0,0,749.45,'2026-06-08 15:48:00+00','2026-06-08 16:41:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2594.03,2586.22,0,0,781.06,'2026-06-09 20:32:00+00','XAUUSD historical','2026-06-09 16:23:00+00','2026-06-09 20:32:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2594.03,2586.22,0,0,781.06,'2026-06-09 16:23:00+00','2026-06-09 20:32:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',2.5,2573.17,2577.57,0,0,1100.74,'2026-06-10 13:01:00+00','XAUUSD historical','2026-06-10 09:45:00+00','2026-06-10 13:01:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',2.5,2573.17,2577.57,0,0,1100.74,'2026-06-10 09:45:00+00','2026-06-10 13:01:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',2.5,2633.08,2629.89,0,0,797.48,'2026-06-11 22:17:00+00','XAUUSD historical','2026-06-11 18:19:00+00','2026-06-11 22:17:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',2.5,2633.08,2629.89,0,0,797.48,'2026-06-11 18:19:00+00','2026-06-11 22:17:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',1,2570.05,2578.17,0,0,811.55,'2026-06-12 19:26:00+00','XAUUSD historical','2026-06-12 15:36:00+00','2026-06-12 19:26:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',1,2570.05,2578.17,0,0,811.55,'2026-06-12 15:36:00+00','2026-06-12 19:26:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2570.59,2571.70,0,0,-332.64,'2026-06-13 19:40:00+00','XAUUSD historical','2026-06-13 18:13:00+00','2026-06-13 19:40:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2570.59,2571.70,0,0,-332.64,'2026-06-13 18:13:00+00','2026-06-13 19:40:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2595.53,2586.41,0,0,912.36,'2026-06-15 17:00:00+00','XAUUSD historical','2026-06-15 15:59:00+00','2026-06-15 17:00:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2595.53,2586.41,0,0,912.36,'2026-06-15 15:59:00+00','2026-06-15 17:00:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',3,2720.71,2722.07,0,0,-406.56,'2026-06-17 16:08:00+00','XAUUSD historical','2026-06-17 13:43:00+00','2026-06-17 16:08:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',3,2720.71,2722.07,0,0,-406.56,'2026-06-17 13:43:00+00','2026-06-17 16:08:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',1,2672.83,2664.16,0,0,866.56,'2026-06-18 13:39:00+00','XAUUSD historical','2026-06-18 11:20:00+00','2026-06-18 13:39:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',1,2672.83,2664.16,0,0,866.56,'2026-06-18 11:20:00+00','2026-06-18 13:39:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'buy','closed',2.5,1.26204,1.26279,0,0,188.44,'2026-06-19 13:04:00+00','GBPUSD historical','2026-06-19 11:02:00+00','2026-06-19 13:04:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'buy',2.5,1.26204,1.26279,0,0,188.44,'2026-06-19 11:02:00+00','2026-06-19 13:04:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',1.5,1.27950,1.27824,0,0,188.34,'2026-06-20 22:53:00+00','GBPUSD historical','2026-06-20 18:00:00+00','2026-06-20 22:53:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',1.5,1.27950,1.27824,0,0,188.34,'2026-06-20 18:00:00+00','2026-06-20 22:53:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_gbp,'sell','closed',2.5,1.27255,1.27142,0,0,283.22,'2026-06-21 19:37:00+00','GBPUSD historical','2026-06-21 17:10:00+00','2026-06-21 19:37:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_gbp,'sell',2.5,1.27255,1.27142,0,0,283.22,'2026-06-21 17:10:00+00','2026-06-21 19:37:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',2,20953.3,21036.8,0,0,166.96,'2026-06-22 19:32:00+00','US100 historical','2026-06-22 14:23:00+00','2026-06-22 19:32:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',2,20953.3,21036.8,0,0,166.96,'2026-06-22 14:23:00+00','2026-06-22 19:32:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'sell','closed',2,21560.6,21443.9,0,0,233.45,'2026-06-23 16:16:00+00','US100 historical','2026-06-23 15:32:00+00','2026-06-23 16:16:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'sell',2,21560.6,21443.9,0,0,233.45,'2026-06-23 15:32:00+00','2026-06-23 16:16:00+00','manual');
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_tec,'buy','closed',3,22192.3,22278.8,0,0,259.59,'2026-06-24 21:13:00+00','US100 historical','2026-06-24 16:12:00+00','2026-06-24 21:13:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_tec,'buy',3,22192.3,22278.8,0,0,259.59,'2026-06-24 16:12:00+00','2026-06-24 21:13:00+00','manual');

  RAISE NOTICE 'Seeded % % (account %): balance %', 'Muhammad','Saud', v_accnum, 156600.00;
END $$;
COMMIT;
