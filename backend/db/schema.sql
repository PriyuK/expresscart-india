-- ExpressCart India — Production PostgreSQL Schema (Neon / Supabase / Standard Postgres)

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL,
  chain TEXT NOT NULL,
  city TEXT NOT NULL,
  lane TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  catalog_version TEXT NOT NULL,
  catalog_size_kb INTEGER NOT NULL DEFAULT 412,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  barcode TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  unit TEXT NOT NULL,
  category TEXT NOT NULL,
  mrp INTEGER NOT NULL,
  store_price INTEGER NOT NULL,
  weight_grams INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  bg_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  aisle TEXT NOT NULL,
  gst_percent INTEGER NOT NULL DEFAULT 12,
  offer_type TEXT NOT NULL DEFAULT 'NONE',
  offer_tag TEXT,
  package_color_hex TEXT NOT NULL,
  package_color_name TEXT NOT NULL,
  is_quick_test BOOLEAN NOT NULL DEFAULT FALSE,
  is_high_value_audit BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  aadhaar_last4 TEXT,
  trust_score INTEGER NOT NULL DEFAULT 95,
  wallet_balance INTEGER NOT NULL DEFAULT 1500,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_sessions (
  pin_code TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_phone TEXT NOT NULL,
  member_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  cart1_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  cart2_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_trust_score INTEGER NOT NULL DEFAULT 95,
  payment_method TEXT NOT NULL,
  upi_ref TEXT NOT NULL,
  signature TEXT NOT NULL,
  total_price INTEGER NOT NULL,
  total_mrp INTEGER NOT NULL,
  total_savings INTEGER NOT NULL,
  promo_savings INTEGER NOT NULL DEFAULT 0,
  total_item_count INTEGER NOT NULL,
  cart_weight_grams INTEGER NOT NULL,
  is_family_order BOOLEAN NOT NULL DEFAULT FALSE,
  family_session_code TEXT,
  cart1_item_count INTEGER NOT NULL DEFAULT 0,
  cart1_weight_grams INTEGER NOT NULL DEFAULT 0,
  cart2_item_count INTEGER NOT NULL DEFAULT 0,
  cart2_weight_grams INTEGER NOT NULL DEFAULT 0,
  audit_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_paid_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  security_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  actual_physical_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  exit_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

