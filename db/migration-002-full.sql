-- Migration 002: Auth, Cart, Gallery, Mystery Packs support
-- Run via: wrangler d1 execute 8eyetiedye-db --file=db/migration-002-full.sql

-- ─── designs table: add columns for gallery, names, expiry ───────────────────
ALTER TABLE designs ADD COLUMN name TEXT;
ALTER TABLE designs ADD COLUMN username TEXT;
ALTER TABLE designs ADD COLUMN expires_at TEXT;
ALTER TABLE designs ADD COLUMN is_public INTEGER DEFAULT 1;

-- ─── users table: add username + OAuth fields ────────────────────────────────
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- ─── order_groups: one per Stripe checkout (multi-item support) ──────────────
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

-- ─── orders table: recreate without UNIQUE on stripe_session_id ──────────────
-- SQLite does not support DROP CONSTRAINT, so we recreate the table.

CREATE TABLE IF NOT EXISTS orders_new (
  id TEXT PRIMARY KEY,
  order_group_id TEXT REFERENCES order_groups(id),
  design_id TEXT NOT NULL REFERENCES designs(id),
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  pod_provider TEXT NOT NULL,
  pod_order_id TEXT,
  product_type TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  size TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_url TEXT,
  tracking_number TEXT,
  amount_cents INTEGER NOT NULL,
  refund_status TEXT,
  refund_amount_cents INTEGER,
  dispute_status TEXT,
  stripe_payment_intent_id TEXT,
  customer_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO orders_new (
  id, order_group_id, design_id, stripe_session_id, stripe_customer_id,
  pod_provider, pod_order_id, product_type, variant_id, size, status,
  tracking_url, tracking_number, amount_cents, refund_status,
  refund_amount_cents, dispute_status, stripe_payment_intent_id,
  customer_email, created_at, updated_at
)
SELECT
  id, NULL, design_id, stripe_session_id, stripe_customer_id,
  pod_provider, pod_order_id, product_type, variant_id, variant_id, status,
  tracking_url, tracking_number, amount_cents, refund_status,
  refund_amount_cents, dispute_status, stripe_payment_intent_id,
  customer_email, created_at, updated_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

-- ─── mystery_pack_purchases ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mystery_pack_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  stripe_session_id TEXT,
  pack_size INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── user_designs: designs owned by a user ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_designs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  design_id TEXT NOT NULL REFERENCES designs(id),
  source TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, design_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_designs_expires ON designs(expires_at);
CREATE INDEX IF NOT EXISTS idx_designs_created ON designs(created_at);
CREATE INDEX IF NOT EXISTS idx_designs_public ON designs(is_public, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_group ON orders(order_group_id);
CREATE INDEX IF NOT EXISTS idx_orders_design ON orders(design_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_user_designs_user ON user_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_designs_design ON user_designs(design_id);
CREATE INDEX IF NOT EXISTS idx_order_groups_stripe ON order_groups(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_mystery_packs_user ON mystery_pack_purchases(user_id);
