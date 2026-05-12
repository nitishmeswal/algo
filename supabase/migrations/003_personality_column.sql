-- Add personality column to cycles and trades tables
-- This tracks which agent personality preset made each decision/trade

ALTER TABLE cycles ADD COLUMN IF NOT EXISTS personality TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS personality TEXT;

-- Index for filtering by personality
CREATE INDEX IF NOT EXISTS idx_cycles_personality ON cycles(personality);
CREATE INDEX IF NOT EXISTS idx_trades_personality ON trades(personality);
