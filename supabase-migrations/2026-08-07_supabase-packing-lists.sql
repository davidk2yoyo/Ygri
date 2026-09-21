-- ============================================================
-- PACKING LISTS — one per quotation, mirrors technical_annexes pattern
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS packing_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE UNIQUE,
  pl_number text UNIQUE NOT NULL, -- e.g. PL-0001
  title text NOT NULL DEFAULT 'Packing List',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packing_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_id uuid NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  quotation_item_id uuid REFERENCES quotation_items(id),
  item_number text,
  description text,
  carton_qty integer,
  qty integer,
  length_cm numeric(10,2),
  width_cm numeric(10,2),
  height_cm numeric(10,2),
  cbm numeric(12,4),
  nw numeric(12,2),
  gw numeric(12,2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Auto-generate pl_number
CREATE OR REPLACE FUNCTION generate_pl_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(pl_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM packing_lists;
  NEW.pl_number := 'PL-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_pl_number
  BEFORE INSERT ON packing_lists
  FOR EACH ROW WHEN (NEW.pl_number IS NULL)
  EXECUTE FUNCTION generate_pl_number();

CREATE OR REPLACE FUNCTION touch_packing_list_updated()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER packing_list_updated
  BEFORE UPDATE ON packing_lists
  FOR EACH ROW EXECUTE FUNCTION touch_packing_list_updated();

-- RLS
ALTER TABLE packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_packing_lists" ON packing_lists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_packing_list_items" ON packing_list_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table-level GRANTs — RLS policies alone are NOT enough on this project,
-- every table needs an explicit GRANT to `authenticated` or queries fail
-- with "permission denied for table X" before RLS is even evaluated.
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON packing_list_items TO authenticated;

CREATE INDEX IF NOT EXISTS idx_packing_list_items_packing_list_id ON packing_list_items(packing_list_id);
