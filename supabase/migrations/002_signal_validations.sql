-- AlgoTrader AI: Signal Validation Layer
-- Run this AFTER 001_trading_tables.sql in Supabase Dashboard → SQL Editor

-- ============================================================
-- SIGNAL_VALIDATIONS: Was the AI's BUY/SELL decision correct?
-- After each trade, the system waits N cycles then checks if
-- the price moved in the predicted direction.
-- ============================================================
CREATE TABLE IF NOT EXISTS signal_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  model TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  price_change_pct NUMERIC NOT NULL,
  signal_correct BOOLEAN NOT NULL,
  confidence_at_entry INTEGER NOT NULL,
  cycles_elapsed INTEGER NOT NULL,
  ts_entry TIMESTAMPTZ NOT NULL,
  ts_validated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validations_symbol ON signal_validations(symbol, ts_validated DESC);
CREATE INDEX IF NOT EXISTS idx_validations_correct ON signal_validations(signal_correct);
CREATE INDEX IF NOT EXISTS idx_validations_model ON signal_validations(model);

-- Add error_context to errors table for richer debugging
ALTER TABLE errors ADD COLUMN IF NOT EXISTS error_context JSONB DEFAULT '{}';
ALTER TABLE errors ADD COLUMN IF NOT EXISTS recoverable BOOLEAN DEFAULT TRUE;
ALTER TABLE errors ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
