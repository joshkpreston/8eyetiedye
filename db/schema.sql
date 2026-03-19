-- 8EyeTieDye Database Schema (Cloudflare D1 / SQLite)

-- designs: all generated designs (public gallery for 30 days, permanent if purchased)
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT,                          -- randomly generated design name
  username TEXT,                      -- roller's random username
  image_url TEXT NOT NULL,
  prompt TEXT,
  rarity TEXT NOT NULL DEFAULT 'common',
  is_public INTEGER DEFAULT 1,       -- visible in gallery
  purchased_at TEXT,
  expires_at TEXT,                    -- 30 days from creation (gallery expiry)
  created_at TEXT DEFAULT (datetime('now'))
);

-- order_groups: one per Stripe checkout session (supports multi-item orders)
CREATE TABLE IF NOT EXISTS order_groups (
  id TEXT PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount_cents INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- orders: individual line items within an order group
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_group_id TEXT REFERENCES order_groups(id),
  design_id TEXT NOT NULL REFERENCES designs(id),
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  pod_provider TEXT NOT NULL,         -- 'printful' | 'gooten'
  pod_order_id TEXT,
  product_type TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  size TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_url TEXT,
  tracking_number TEXT,
  amount_cents INTEGER NOT NULL,
  refund_status TEXT,                 -- 'partial' | 'full'
  refund_amount_cents INTEGER,
  dispute_status TEXT,                -- 'warning_needs_response' | 'needs_response' | 'won' | 'lost'
  stripe_payment_intent_id TEXT,
  customer_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- users: accounts (created via magic link or OAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  username TEXT UNIQUE,               -- randomly generated username
  google_id TEXT UNIQUE,              -- Google OAuth ID
  avatar_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  stripe_card_fingerprint TEXT,
  roll_credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- mystery_pack_purchases: purchased design packs
CREATE TABLE IF NOT EXISTS mystery_pack_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  stripe_session_id TEXT,
  pack_size INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- user_designs: links users to designs they own (from purchases or mystery packs)
CREATE TABLE IF NOT EXISTS user_designs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  design_id TEXT NOT NULL REFERENCES designs(id),
  source TEXT NOT NULL,               -- 'purchase' | 'mystery_pack' | 'roll'
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, design_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_designs_session ON designs(session_id);
CREATE INDEX IF NOT EXISTS idx_designs_user ON designs(user_id);
CREATE INDEX IF NOT EXISTS idx_designs_expires ON designs(expires_at);
CREATE INDEX IF NOT EXISTS idx_designs_created ON designs(created_at);
CREATE INDEX IF NOT EXISTS idx_designs_public ON designs(is_public, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_group ON orders(order_group_id);
CREATE INDEX IF NOT EXISTS idx_orders_design ON orders(design_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_user_designs_user ON user_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_designs_design ON user_designs(design_id);
CREATE INDEX IF NOT EXISTS idx_order_groups_stripe ON order_groups(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_mystery_packs_user ON mystery_pack_purchases(user_id);
