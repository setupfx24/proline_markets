-- TimescaleDB Market Data Schema

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TICK DATA (real-time price ticks)
-- ============================================

CREATE TABLE ticks (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    bid DECIMAL(18,8) NOT NULL,
    ask DECIMAL(18,8) NOT NULL,
    bid_volume DECIMAL(18,4) DEFAULT 0,
    ask_volume DECIMAL(18,4) DEFAULT 0,
    spread DECIMAL(18,8) GENERATED ALWAYS AS (ask - bid) STORED
);

SELECT create_hypertable('ticks', 'time');
CREATE INDEX idx_ticks_symbol ON ticks (symbol, time DESC);

-- ============================================
-- OHLCV BARS (aggregated candle data)
-- ============================================

CREATE TABLE ohlcv_1m (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DECIMAL(18,8) NOT NULL,
    high DECIMAL(18,8) NOT NULL,
    low DECIMAL(18,8) NOT NULL,
    close DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,4) DEFAULT 0,
    tick_count INT DEFAULT 0
);

SELECT create_hypertable('ohlcv_1m', 'time');
CREATE INDEX idx_ohlcv_1m_symbol ON ohlcv_1m (symbol, time DESC);

CREATE TABLE ohlcv_5m (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DECIMAL(18,8) NOT NULL,
    high DECIMAL(18,8) NOT NULL,
    low DECIMAL(18,8) NOT NULL,
    close DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,4) DEFAULT 0,
    tick_count INT DEFAULT 0
);
SELECT create_hypertable('ohlcv_5m', 'time');
CREATE INDEX idx_ohlcv_5m_symbol ON ohlcv_5m (symbol, time DESC);

CREATE TABLE ohlcv_15m (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DECIMAL(18,8) NOT NULL,
    high DECIMAL(18,8) NOT NULL,
    low DECIMAL(18,8) NOT NULL,
    close DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,4) DEFAULT 0,
    tick_count INT DEFAULT 0
);
SELECT create_hypertable('ohlcv_15m', 'time');
CREATE INDEX idx_ohlcv_15m_symbol ON ohlcv_15m (symbol, time DESC);

CREATE TABLE ohlcv_1h (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DECIMAL(18,8) NOT NULL,
    high DECIMAL(18,8) NOT NULL,
    low DECIMAL(18,8) NOT NULL,
    close DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,4) DEFAULT 0,
    tick_count INT DEFAULT 0
);
SELECT create_hypertable('ohlcv_1h', 'time');
CREATE INDEX idx_ohlcv_1h_symbol ON ohlcv_1h (symbol, time DESC);

CREATE TABLE ohlcv_4h (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DECIMAL(18,8) NOT NULL,
    high DECIMAL(18,8) NOT NULL,
    low DECIMAL(18,8) NOT NULL,
    close DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,4) DEFAULT 0,
    tick_count INT DEFAULT 0
);
SELECT create_hypertable('ohlcv_4h', 'time');
CREATE INDEX idx_ohlcv_4h_symbol ON ohlcv_4h (symbol, time DESC);

CREATE TABLE ohlcv_1d (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DECIMAL(18,8) NOT NULL,
    high DECIMAL(18,8) NOT NULL,
    low DECIMAL(18,8) NOT NULL,
    close DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,4) DEFAULT 0,
    tick_count INT DEFAULT 0
);
SELECT create_hypertable('ohlcv_1d', 'time');
CREATE INDEX idx_ohlcv_1d_symbol ON ohlcv_1d (symbol, time DESC);

CREATE TABLE ohlcv_1w (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    open DECIMAL(18,8) NOT NULL,
    high DECIMAL(18,8) NOT NULL,
    low DECIMAL(18,8) NOT NULL,
    close DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,4) DEFAULT 0,
    tick_count INT DEFAULT 0
);
SELECT create_hypertable('ohlcv_1w', 'time');
CREATE INDEX idx_ohlcv_1w_symbol ON ohlcv_1w (symbol, time DESC);

-- ============================================
-- Continuous Aggregates for auto-rollup
-- ============================================

CREATE MATERIALIZED VIEW ohlcv_5m_agg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS time,
    symbol,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(tick_count) AS tick_count
FROM ohlcv_1m
GROUP BY time_bucket('5 minutes', time), symbol;

CREATE MATERIALIZED VIEW ohlcv_1h_agg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS time,
    symbol,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume,
    sum(tick_count) AS tick_count
FROM ohlcv_1m
GROUP BY time_bucket('1 hour', time), symbol;

-- Retention policy: keep ticks for 30 days, 1m bars for 1 year
SELECT add_retention_policy('ticks', INTERVAL '30 days');
SELECT add_retention_policy('ohlcv_1m', INTERVAL '1 year');
