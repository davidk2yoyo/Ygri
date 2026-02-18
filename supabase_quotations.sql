-- ============================================================
-- QUOTATION MODULE - Run this in Supabase SQL Editor
-- ============================================================

-- 1. Suppliers table (internal use only, hidden from client PDF)
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  email text,
  sales_person text,
  wechat_or_whatsapp text,
  website text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Catalog items (reusable across projects)
CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_number text,
  description text NOT NULL,
  picture_url text,
  default_price numeric(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Quotations (one per track, editable across stages)
CREATE TABLE IF NOT EXISTS quotations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id uuid NOT NULL,
  quote_number text UNIQUE,
  type text NOT NULL CHECK (type IN ('product', 'service')),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'EUR')),
  -- Product-only fields
  incoterm text,
  delivery_time text,
  -- Shared
  negotiation_term text,
  notes text,
  total_amount numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Quotation line items
CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES catalog_items(id),  -- null if custom
  item_number text,
  description text,
  picture_url text,
  price numeric(12,2) DEFAULT 0,
  quantity integer DEFAULT 1,
  supplier_id uuid REFERENCES suppliers(id),          -- product only, hidden from PDF
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. Auto-generate quote number (format: YYYY-NN)
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS text AS $$
DECLARE
  year_prefix text := to_char(now(), 'YYYY');
  next_seq integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN quote_number LIKE year_prefix || '-%'
    THEN (split_part(quote_number, '-', 2))::integer
    ELSE 0 END
  ), 0) + 1
  INTO next_seq
  FROM quotations
  WHERE quote_number LIKE year_prefix || '-%';

  RETURN year_prefix || '-' || LPAD(next_seq::text, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign quote number on insert
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := generate_quote_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_quote_number ON quotations;
CREATE TRIGGER trg_set_quote_number
  BEFORE INSERT OR UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION set_quote_number();

-- 6. RLS policies (adjust to your auth setup)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "auth_all_suppliers" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_catalog_items" ON catalog_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_quotations" ON quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_quotation_items" ON quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Storage bucket for quotation/item pictures (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('quotation-images', 'quotation-images', true);

-- 8. Migration: add incoterm_location column (run if table already exists)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS incoterm_location text;
