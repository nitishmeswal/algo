-- AlgoTrader AI: Persistence Layer
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ============================================================
-- CYCLES: Every AI reasoning cycle is stored here
-- ============================================================
CREATE TABLE IF NOT EXISTS cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol TEXT NOT NULL,
  model TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'paper',
  price NUMERIC NOT NULL,
  change_24h NUMERIC DEFAULT 0,
  indicators JSONB DEFAULT '{}',
  prompt_tokens INTEGER,
  raw_response TEXT,
  action TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  reasoning TEXT,
  trade_executed BOOLEAN DEFAULT FALSE,
  trade_side TEXT,
  trade_amount_usdt NUMERIC,
  trade_price NUMERIC,
  pnl_after NUMERIC,
  balance_after NUMERIC,
  error TEXT,
  latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cycles_symbol_ts ON cycles(symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_cycles_model ON cycles(model);

-- ============================================================
-- TRADES: Every executed trade (paper or live)
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  cost_usdt NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  pnl NUMERIC DEFAULT 0,
  model TEXT NOT NULL,
  reasoning TEXT,
  mode TEXT NOT NULL DEFAULT 'paper',
  paper BOOLEAN DEFAULT TRUE,
  balance_after NUMERIC NOT NULL,
  indicators_at_trade JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol_ts ON trades(symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_trades_model ON trades(model);
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON trades(pnl);

-- ============================================================
-- PERFORMANCE_SNAPSHOTS: Periodic portfolio metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol TEXT NOT NULL,
  model TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'paper',
  balance_usdt NUMERIC NOT NULL,
  total_pnl NUMERIC DEFAULT 0,
  total_pnl_pct NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  max_drawdown NUMERIC DEFAULT 0,
  sharpe_ratio NUMERIC DEFAULT 0,
  avg_profit NUMERIC DEFAULT 0,
  avg_loss NUMERIC DEFAULT 0,
  profit_factor NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_perf_symbol_model ON performance_snapshots(symbol, model, ts DESC);

-- ============================================================
-- ERRORS: Track failures for debugging
-- ============================================================
CREATE TABLE IF NOT EXISTS errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol TEXT NOT NULL,
  model TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  cycle_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_errors_ts ON errors(ts DESC);

-- ============================================================
-- MARKET_SNAPSHOTS: Periodic indicator snapshots (optional, for backtesting)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL,
  change_24h NUMERIC DEFAULT 0,
  indicators JSONB DEFAULT '{}',
  volume NUMERIC,
  timeframe TEXT DEFAULT '5m'
);

CREATE INDEX IF NOT EXISTS idx_market_symbol_ts ON market_snapshots(symbol, ts DESC);
