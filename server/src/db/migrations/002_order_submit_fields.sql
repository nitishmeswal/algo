-- Extend orders for HTTP submit payload fields.
-- - Add GTD support for time_in_force
-- - Persist advanced ticket fields coming from the client

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_time_in_force_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_time_in_force_check
    CHECK (time_in_force IN ('day', 'gtc', 'gtd', 'ioc', 'fok', 'at_open', 'at_close'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT
    CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
  ADD COLUMN IF NOT EXISTS stop_price NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_tag TEXT,
  ADD COLUMN IF NOT EXISTS display_quantity INTEGER
    CHECK (display_quantity IS NULL OR display_quantity > 0);
