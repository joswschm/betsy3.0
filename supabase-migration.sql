-- ============================================================
-- Betsy's Commission Tracker — Supabase Migration
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- STEP 1: Drop any existing tables from previous project
-- (Add any table names from your old project here)
DROP TABLE IF EXISTS commission_entries CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS factories CASCADE;
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS dashboard_summaries CASCADE;
DROP TABLE IF EXISTS extraction_logs CASCADE;
-- Common names from previous attempts:
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS sales_data CASCADE;
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS line_items CASCADE;
DROP TABLE IF EXISTS sources CASCADE;

-- ============================================================
-- STEP 2: Create new schema
-- ============================================================

-- Factories: registry of known report sources
CREATE TABLE factories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('excel', 'pdf')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the 4 known factories
INSERT INTO factories (name, display_name, format) VALUES
  ('hat', 'HAT Commissions', 'excel'),
  ('mg', 'MG (Marble Granite)', 'excel'),
  ('darran', 'DARRAN', 'pdf'),
  ('symphony', 'SYMPHONY', 'pdf');

-- Reports: uploaded file metadata
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  report_period TEXT,              -- e.g., 'OCT 2025'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  extracted_row_count INT DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_factory ON reports(factory_id);
CREATE INDEX idx_reports_period ON reports(report_period);

-- Commission Entries: the core data (normalized highlighted rows)
CREATE TABLE commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,

  -- Common normalized fields
  factory_name TEXT NOT NULL,
  customer_name TEXT,
  invoice_number TEXT,
  order_number TEXT,
  invoice_date DATE,
  order_date DATE,
  product_category TEXT,
  item_description TEXT,
  quantity NUMERIC,
  unit_price NUMERIC(12,2),
  sales_amount NUMERIC(12,2),
  commission_rate NUMERIC(6,4),     -- stored as decimal, e.g., 0.08 for 8%
  commission_amount NUMERIC(12,2),
  region TEXT,

  -- Split tracking
  is_split BOOLEAN DEFAULT false,
  split_with TEXT,
  split_amount NUMERIC(12,2),
  notes TEXT,

  -- Raw data from the original report for reference
  raw_data JSONB,
  row_number INT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entries_report ON commission_entries(report_id);
CREATE INDEX idx_entries_factory ON commission_entries(factory_id);
CREATE INDEX idx_entries_customer ON commission_entries(customer_name);
CREATE INDEX idx_entries_invoice_date ON commission_entries(invoice_date);
CREATE INDEX idx_entries_factory_name ON commission_entries(factory_name);

-- Chat History: persist LLM conversations (optional)
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 3: Enable Row Level Security (RLS)
-- For now, allow all operations (single-user app).
-- Tighten these policies if you add auth later.
-- ============================================================

ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon role (single-user, no auth)
CREATE POLICY "Allow all on factories" ON factories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reports" ON reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on commission_entries" ON commission_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on chat_history" ON chat_history FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Done! You should see 4 factories seeded in the factories table.
-- ============================================================
