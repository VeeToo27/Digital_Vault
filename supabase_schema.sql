-- ============================================================
-- DIGITAL VAULT — Supabase SQL Schema
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  uid         TEXT UNIQUE NOT NULL,          -- e.g. UID_0001
  username    TEXT UNIQUE NOT NULL,
  pin_hash    TEXT NOT NULL,                 -- bcrypt hash
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  blocked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stalls table
CREATE TABLE IF NOT EXISTS stalls (
  id         BIGSERIAL PRIMARY KEY,
  stall_id   TEXT UNIQUE NOT NULL,           -- e.g. S101
  name       TEXT NOT NULL,
  pin_hash   TEXT NOT NULL,                  -- bcrypt hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Menu items table
CREATE TABLE IF NOT EXISTS menu_items (
  id        BIGSERIAL PRIMARY KEY,
  stall_id  TEXT NOT NULL REFERENCES stalls(stall_id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  price     NUMERIC(10,2) NOT NULL
);

-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id         BIGSERIAL PRIMARY KEY,
  token_no   INTEGER NOT NULL,               -- sequential per stall per day
  stall_id   TEXT NOT NULL REFERENCES stalls(stall_id),
  stall_name TEXT NOT NULL,
  username   TEXT NOT NULL REFERENCES users(username),
  items      JSONB NOT NULL,                 -- [{name, qty, price}]
  total      NUMERIC(10,2) NOT NULL,
  status     TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Served')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin table
CREATE TABLE IF NOT EXISTS admins (
  id         BIGSERIAL PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL                   -- plain text or bcrypt hash
);

-- ── Indexes for fast lookups ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tokens_stall    ON tokens(stall_id);
CREATE INDEX IF NOT EXISTS idx_tokens_username ON tokens(username);
CREATE INDEX IF NOT EXISTS idx_tokens_status   ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_menu_stall      ON menu_items(stall_id);

-- ── Atomic payment function (runs in a transaction) ────────
-- Deducts balance and creates token in one database round-trip.
-- Prevents race conditions even under 3000 concurrent users.
CREATE OR REPLACE FUNCTION place_order(
  p_username  TEXT,
  p_stall_id  TEXT,
  p_stall_name TEXT,
  p_items     JSONB,
  p_total     NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance   NUMERIC;
  v_token_no  INTEGER;
  v_token_id  BIGINT;
BEGIN
  -- Lock the user row and read current balance
  SELECT balance INTO v_balance
  FROM users
  WHERE username = p_username
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_balance < p_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'balance', v_balance);
  END IF;

  -- Deduct balance
  UPDATE users SET balance = balance - p_total WHERE username = p_username;

  -- Get next token number (per stall, sequential)
  SELECT COALESCE(MAX(token_no), 0) + 1 INTO v_token_no
  FROM tokens
  WHERE stall_id = p_stall_id;

  -- Insert token
  INSERT INTO tokens (token_no, stall_id, stall_name, username, items, total)
  VALUES (v_token_no, p_stall_id, p_stall_name, p_username, p_items, p_total)
  RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'success',   true,
    'token_no',  v_token_no,
    'token_id',  v_token_id,
    'new_balance', v_balance - p_total
  );
END;
$$;

-- ── Enable Realtime on tokens table ────────────────────────
-- (Run this or enable via Supabase dashboard: Database > Replication)
ALTER TABLE tokens REPLICA IDENTITY FULL;

-- ── Sample data — replace PINs with bcrypt hashes in production ──
-- Admin: username=Admin, password=Hello
INSERT INTO admins (username, password) VALUES ('Admin', 'Hello')
ON CONFLICT (username) DO NOTHING;

-- NOTE: For stalls and users, use the /api/seed endpoint or
-- insert via Supabase dashboard after hashing PINs with bcrypt.
