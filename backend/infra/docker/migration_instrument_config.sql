-- Run on existing DBs: psql -f migration_instrument_config.sql

ALTER TABLE charge_configs DROP CONSTRAINT IF EXISTS charge_configs_charge_type_check;
ALTER TABLE charge_configs ADD CONSTRAINT charge_configs_charge_type_check
    CHECK (charge_type IN ('commission_per_lot', 'commission_per_trade', 'spread_percentage', 'commission_percentage'));

ALTER TABLE spread_configs DROP CONSTRAINT IF EXISTS spread_configs_spread_type_check;
ALTER TABLE spread_configs ADD CONSTRAINT spread_configs_spread_type_check
    CHECK (spread_type IN ('fixed', 'variable', 'pips', 'percentage'));
-- Adds instrument_configs, audit table, energies segment, extra instruments.

INSERT INTO instrument_segments (name, display_name)
VALUES ('energies', 'Energies')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE instruments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS instrument_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL UNIQUE REFERENCES instruments(id) ON DELETE CASCADE,
    commission_value DECIMAL(18, 8),
    commission_type VARCHAR(30) NOT NULL DEFAULT 'per_lot',
    spread_value DECIMAL(18, 8),
    spread_type VARCHAR(20) NOT NULL DEFAULT 'pips',
    price_impact DECIMAL(18, 8) NOT NULL DEFAULT 0,
    swap_long DECIMAL(18, 8) DEFAULT 0,
    swap_short DECIMAL(18, 8) DEFAULT 0,
    swap_free BOOLEAN NOT NULL DEFAULT FALSE,
    min_lot_size DECIMAL(10, 4) DEFAULT 0.01,
    max_lot_size DECIMAL(10, 4) DEFAULT 100,
    leverage_max INT DEFAULT 2000,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_instrument_configs_instrument ON instrument_configs(instrument_id);

CREATE TABLE IF NOT EXISTS instrument_config_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    field_changed VARCHAR(64) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_instrument_config_audit_inst ON instrument_config_audit(instrument_id);

-- Optional: move USOIL to energies for grouping (idempotent)
UPDATE instruments SET segment_id = (SELECT id FROM instrument_segments WHERE name = 'energies' LIMIT 1), updated_at = NOW()
WHERE symbol = 'USOIL' AND EXISTS (SELECT 1 FROM instrument_segments WHERE name = 'energies');

-- New instruments (skip if exists)
INSERT INTO instruments (symbol, display_name, segment_id, base_currency, quote_currency, digits, pip_size, contract_size, min_lot, max_lot)
SELECT v.symbol, v.dname, (SELECT id FROM instrument_segments WHERE name = v.seg LIMIT 1), v.base, v.quote, v.dig, v.pip::decimal, v.cs::decimal, 0.01, 100
FROM (VALUES
    ('XPTUSD', 'Platinum / US Dollar', 'commodities', 'XPT', 'USD', 2, 0.01, 100),
    ('NATGAS', 'Natural Gas', 'energies', 'NG', 'USD', 3, 0.001, 10000),
    ('UKOIL', 'Brent Crude Oil', 'energies', 'OIL', 'USD', 2, 0.01, 1000),
    ('BNBUSD', 'Binance Coin / US Dollar', 'crypto', 'BNB', 'USD', 2, 0.01, 1),
    ('DOGEUSD', 'Dogecoin / US Dollar', 'crypto', 'DOGE', 'USD', 5, 0.00001, 1000),
    ('ADAUSD', 'Cardano / US Dollar', 'crypto', 'ADA', 'USD', 4, 0.0001, 1000),
    ('AUDCAD', 'Australian Dollar / Canadian Dollar', 'forex', 'AUD', 'CAD', 5, 0.0001, 100000),
    ('AUDCHF', 'Australian Dollar / Swiss Franc', 'forex', 'AUD', 'CHF', 5, 0.0001, 100000),
    ('AUDNZD', 'Australian Dollar / NZ Dollar', 'forex', 'AUD', 'NZD', 5, 0.0001, 100000),
    ('CADCHF', 'Canadian Dollar / Swiss Franc', 'forex', 'CAD', 'CHF', 5, 0.0001, 100000),
    ('CHFJPY', 'Swiss Franc / Japanese Yen', 'forex', 'CHF', 'JPY', 3, 0.01, 100000),
    ('EURAUD', 'Euro / Australian Dollar', 'forex', 'EUR', 'AUD', 5, 0.0001, 100000),
    ('EURCAD', 'Euro / Canadian Dollar', 'forex', 'EUR', 'CAD', 5, 0.0001, 100000),
    ('EURNZD', 'Euro / NZ Dollar', 'forex', 'EUR', 'NZD', 5, 0.0001, 100000),
    ('GBPAUD', 'British Pound / Australian Dollar', 'forex', 'GBP', 'AUD', 5, 0.0001, 100000),
    ('GBPCAD', 'British Pound / Canadian Dollar', 'forex', 'GBP', 'CAD', 5, 0.0001, 100000),
    ('GBPNZD', 'British Pound / NZ Dollar', 'forex', 'GBP', 'NZD', 5, 0.0001, 100000),
    ('NZDCAD', 'NZ Dollar / Canadian Dollar', 'forex', 'NZD', 'CAD', 5, 0.0001, 100000),
    ('NZDCHF', 'NZ Dollar / Swiss Franc', 'forex', 'NZD', 'CHF', 5, 0.0001, 100000),
    ('US100', 'US Tech 100', 'indices', 'US100', 'USD', 1, 0.1, 1),
    ('JPN225', 'Japan 225', 'indices', 'JPN225', 'JPY', 1, 1, 1),
    ('AUS200', 'Australia 200', 'indices', 'AUS200', 'AUD', 1, 0.1, 1),
    ('AAPL', 'Apple Inc.', 'stocks', 'AAPL', 'USD', 2, 0.01, 100),
    ('TSLA', 'Tesla Inc.', 'stocks', 'TSLA', 'USD', 2, 0.01, 100),
    ('AMZN', 'Amazon.com Inc.', 'stocks', 'AMZN', 'USD', 2, 0.01, 100),
    ('GOOGL', 'Alphabet Inc.', 'stocks', 'GOOGL', 'USD', 2, 0.01, 100),
    ('MSFT', 'Microsoft Corp.', 'stocks', 'MSFT', 'USD', 2, 0.01, 100),
    ('META', 'Meta Platforms Inc.', 'stocks', 'META', 'USD', 2, 0.01, 100),
    ('NVDA', 'Nvidia Corp.', 'stocks', 'NVDA', 'USD', 2, 0.01, 100),
    ('NFLX', 'Netflix Inc.', 'stocks', 'NFLX', 'USD', 2, 0.01, 100)
) AS v(symbol, dname, seg, base, quote, dig, pip, cs)
WHERE NOT EXISTS (SELECT 1 FROM instruments i WHERE i.symbol = v.symbol);
