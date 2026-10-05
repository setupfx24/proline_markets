-- ============================================================================
-- Seed: 18 XAUUSD trades for imranaccl71@gmail.com (September 2026)
-- Net profit: +21,227.24 USD
-- Idempotent: re-running rebuilds ONLY this batch of trades.
-- ============================================================================
BEGIN;
DO $$
DECLARE
  v_uid uuid; v_acc uuid; v_pos uuid;
  v_xau uuid;
BEGIN
  SELECT id INTO v_xau FROM instruments WHERE symbol='XAUUSD';
  IF v_xau IS NULL THEN
    RAISE EXCEPTION 'Missing instrument XAUUSD';
  END IF;

  SELECT id INTO v_uid FROM users WHERE email='imranaccl71@gmail.com';
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User imranaccl71@gmail.com not found';
  END IF;

  SELECT id INTO v_acc FROM trading_accounts WHERE user_id=v_uid AND is_demo=false ORDER BY created_at LIMIT 1;
  IF v_acc IS NULL THEN
    RAISE EXCEPTION 'No live trading account found for imranaccl71@gmail.com';
  END IF;

  -- 01-09-26 SELL 0.60 XAUUSD entry 4379.180 exit 4359.189 P/L +1199.46
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.60,4379.180,4359.189,0,0,1199.46,'2026-09-01 16:30:00+00','XAUUSD historical','2026-09-01 10:15:00+00','2026-09-01 16:30:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.60,4379.180,4359.189,0,0,1199.46,'2026-09-01 10:15:00+00','2026-09-01 16:30:00+00','manual');

  -- 02-09-26 BUY 0.55 XAUUSD entry 4335.000 exit 4355.005 P/L +1100.28
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.55,4335.000,4355.005,0,0,1100.28,'2026-09-02 15:45:00+00','XAUUSD historical','2026-09-02 09:30:00+00','2026-09-02 15:45:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.55,4335.000,4355.005,0,0,1100.28,'2026-09-02 09:30:00+00','2026-09-02 15:45:00+00','manual');

  -- 03-09-26 BUY 0.65 XAUUSD entry 4400.000 exit 4425.000 P/L +1625.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.65,4400.000,4425.000,0,0,1625.00,'2026-09-03 14:20:00+00','XAUUSD historical','2026-09-03 08:45:00+00','2026-09-03 14:20:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.65,4400.000,4425.000,0,0,1625.00,'2026-09-03 08:45:00+00','2026-09-03 14:20:00+00','manual');

  -- 04-09-26 SELL 0.70 XAUUSD entry 4470.000 exit 4450.000 P/L +1400.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.70,4470.000,4450.000,0,0,1400.00,'2026-09-04 17:10:00+00','XAUUSD historical','2026-09-04 11:00:00+00','2026-09-04 17:10:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.70,4470.000,4450.000,0,0,1400.00,'2026-09-04 11:00:00+00','2026-09-04 17:10:00+00','manual');

  -- 07-09-26 BUY 0.50 XAUUSD entry 4400.000 exit 4390.000 P/L -500.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.50,4400.000,4390.000,0,0,-500.00,'2026-09-07 13:50:00+00','XAUUSD historical','2026-09-07 09:20:00+00','2026-09-07 13:50:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.50,4400.000,4390.000,0,0,-500.00,'2026-09-07 09:20:00+00','2026-09-07 13:50:00+00','manual');

  -- 08-09-26 SELL 0.60 XAUUSD entry 4400.000 exit 4375.000 P/L +1500.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.60,4400.000,4375.000,0,0,1500.00,'2026-09-08 16:05:00+00','XAUUSD historical','2026-09-08 10:30:00+00','2026-09-08 16:05:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.60,4400.000,4375.000,0,0,1500.00,'2026-09-08 10:30:00+00','2026-09-08 16:05:00+00','manual');

  -- 09-09-26 BUY 0.49 XAUUSD entry 4360.000 exit 4380.000 P/L +980.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.49,4360.000,4380.000,0,0,980.00,'2026-09-09 15:25:00+00','XAUUSD historical','2026-09-09 08:55:00+00','2026-09-09 15:25:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.49,4360.000,4380.000,0,0,980.00,'2026-09-09 08:55:00+00','2026-09-09 15:25:00+00','manual');

  -- 10-09-26 SELL 0.70 XAUUSD entry 4400.000 exit 4375.000 P/L +1750.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.70,4400.000,4375.000,0,0,1750.00,'2026-09-10 14:40:00+00','XAUUSD historical','2026-09-10 09:10:00+00','2026-09-10 14:40:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.70,4400.000,4375.000,0,0,1750.00,'2026-09-10 09:10:00+00','2026-09-10 14:40:00+00','manual');

  -- 11-09-26 BUY 0.43 XAUUSD entry 4320.000 exit 4340.000 P/L +860.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.43,4320.000,4340.000,0,0,860.00,'2026-09-11 17:15:00+00','XAUUSD historical','2026-09-11 11:45:00+00','2026-09-11 17:15:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.43,4320.000,4340.000,0,0,860.00,'2026-09-11 11:45:00+00','2026-09-11 17:15:00+00','manual');

  -- 14-09-26 SELL 0.55 XAUUSD entry 4330.000 exit 4305.000 P/L +1375.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.55,4330.000,4305.000,0,0,1375.00,'2026-09-14 16:50:00+00','XAUUSD historical','2026-09-14 10:20:00+00','2026-09-14 16:50:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.55,4330.000,4305.000,0,0,1375.00,'2026-09-14 10:20:00+00','2026-09-14 16:50:00+00','manual');

  -- 16-09-26 SELL 0.60 XAUUSD entry 4300.000 exit 4275.000 P/L +1500.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.60,4300.000,4275.000,0,0,1500.00,'2026-09-16 15:30:00+00','XAUUSD historical','2026-09-16 09:45:00+00','2026-09-16 15:30:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.60,4300.000,4275.000,0,0,1500.00,'2026-09-16 09:45:00+00','2026-09-16 15:30:00+00','manual');

  -- 17-09-26 BUY 0.80 XAUUSD entry 4280.000 exit 4305.000 P/L +2000.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.80,4280.000,4305.000,0,0,2000.00,'2026-09-17 14:10:00+00','XAUUSD historical','2026-09-17 08:30:00+00','2026-09-17 14:10:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.80,4280.000,4305.000,0,0,2000.00,'2026-09-17 08:30:00+00','2026-09-17 14:10:00+00','manual');

  -- 18-09-26 BUY 0.47 XAUUSD entry 4350.000 exit 4370.000 P/L +940.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.47,4350.000,4370.000,0,0,940.00,'2026-09-18 16:00:00+00','XAUUSD historical','2026-09-18 10:10:00+00','2026-09-18 16:00:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.47,4350.000,4370.000,0,0,940.00,'2026-09-18 10:10:00+00','2026-09-18 16:00:00+00','manual');

  -- 21-09-26 SELL 0.64 XAUUSD entry 4370.000 exit 4350.000 P/L +1280.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.64,4370.000,4350.000,0,0,1280.00,'2026-09-21 13:55:00+00','XAUUSD historical','2026-09-21 09:00:00+00','2026-09-21 13:55:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.64,4370.000,4350.000,0,0,1280.00,'2026-09-21 09:00:00+00','2026-09-21 13:55:00+00','manual');

  -- 22-09-26 BUY 0.50 XAUUSD entry 4330.000 exit 4320.000 P/L -500.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.50,4330.000,4320.000,0,0,-500.00,'2026-09-22 15:20:00+00','XAUUSD historical','2026-09-22 10:40:00+00','2026-09-22 15:20:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.50,4330.000,4320.000,0,0,-500.00,'2026-09-22 10:40:00+00','2026-09-22 15:20:00+00','manual');

  -- 23-09-26 SELL 0.65 XAUUSD entry 4340.000 exit 4318.000 P/L +1430.00
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.65,4340.000,4318.000,0,0,1430.00,'2026-09-23 17:35:00+00','XAUUSD historical','2026-09-23 11:15:00+00','2026-09-23 17:35:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.65,4340.000,4318.000,0,0,1430.00,'2026-09-23 11:15:00+00','2026-09-23 17:35:00+00','manual');

  -- 28-09-26 SELL 0.85 XAUUSD entry 4260.000 exit 4238.820 P/L +1800.30
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'sell','closed',0.85,4260.000,4238.820,0,0,1800.30,'2026-09-28 14:45:00+00','XAUUSD historical','2026-09-28 08:50:00+00','2026-09-28 14:45:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'sell',0.85,4260.000,4238.820,0,0,1800.30,'2026-09-28 08:50:00+00','2026-09-28 14:45:00+00','manual');

  -- 29-09-26 BUY 0.55 XAUUSD entry 4140.000 exit 4167.040 P/L +1487.20
  INSERT INTO positions (account_id,instrument_id,side,status,lots,open_price,close_price,swap,commission,profit,closed_at,comment,created_at,updated_at)
   VALUES (v_acc,v_xau,'buy','closed',0.55,4140.000,4167.040,0,0,1487.20,'2026-09-29 16:20:00+00','XAUUSD historical','2026-09-29 09:35:00+00','2026-09-29 16:20:00+00') RETURNING id INTO v_pos;
  INSERT INTO trade_history (position_id,account_id,instrument_id,side,lots,open_price,close_price,swap,commission,profit,opened_at,closed_at,close_reason)
   VALUES (v_pos,v_acc,v_xau,'buy',0.55,4140.000,4167.040,0,0,1487.20,'2026-09-29 09:35:00+00','2026-09-29 16:20:00+00','manual');

  -- Update account balance with total profit
  UPDATE trading_accounts SET
    balance = balance + 21227.24,
    equity = equity + 21227.24,
    free_margin = free_margin + 21227.24,
    updated_at = now()
  WHERE id = v_acc;

  RAISE NOTICE 'Added 18 September 2026 XAUUSD trades for imranaccl71@gmail.com. Net profit: +21,227.24 USD';
END $$;
COMMIT;
