-- 8EyeTieDye Database Schema (Cloudflare D1 / SQLite)

-- designs: purchased designs (permanent)
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  image_url TEXT NOT NULL,
  prompt TEXT,
  rarity TEXT NOT NULL DEFAULT 'common',
  purchased_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- orders: stripe payment + POD fulfillment
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL REFERENCES designs(id),
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  pod_provider TEXT NOT NULL, -- 'printful' | 'gooten'
  pod_order_id TEXT,
  product_type TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_url TEXT,
  tracking_number TEXT,
  amount_cents INTEGER NOT NULL,
  refund_status TEXT, -- 'partial' | 'full'
  refund_amount_cents INTEGER,
  dispute_status TEXT, -- 'warning_needs_response' | 'needs_response' | 'won' | 'lost'
  stripe_payment_intent_id TEXT,
  customer_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- users: optional accounts (created at payment)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  stripe_card_fingerprint TEXT,
  roll_credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_designs_session ON designs(session_id);
CREATE INDEX IF NOT EXISTS idx_designs_user ON designs(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_design ON orders(design_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
