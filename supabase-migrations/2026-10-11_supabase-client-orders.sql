-- ============================================================
-- CLIENT ORDERS — a purchase order the CLIENT sends us (Excel, one
-- sheet per supplier), imported as structured lines so we can compare
-- what they asked vs what we quote / buy. Additive.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  track_id uuid REFERENCES tracks(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  reference text,
  order_date date,
  source_file_url text,
  source_file_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','quoted','ordered','closed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_order_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES client_orders(id) ON DELETE CASCADE,
  sheet_name text,
  sheet_row integer,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name_raw text,
  supplier_ref text,
  name text,
  color text,
  qty numeric,
  client_price numeric(12,4),
  client_ref text,
  brand text,
  marking boolean,
  packaging text,
  notes text,
  photo_url text,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  quotation_item_id uuid REFERENCES quotation_items(id) ON DELETE SET NULL,
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','matched','new_product')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_orders_client_id ON client_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_client_order_lines_order_id ON client_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_client_order_lines_supplier_id ON client_order_lines(supplier_id);
CREATE INDEX IF NOT EXISTS idx_client_order_lines_catalog_item_id ON client_order_lines(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_client_order_lines_quotation_item_id ON client_order_lines(quotation_item_id);

ALTER TABLE client_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_client_orders" ON client_orders;
CREATE POLICY "auth_all_client_orders" ON client_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_client_order_lines" ON client_order_lines;
CREATE POLICY "auth_all_client_order_lines" ON client_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON client_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_order_lines TO authenticated;

-- Packaging/marking/brand choices become product options too
ALTER TABLE catalog_item_options DROP CONSTRAINT IF EXISTS catalog_item_options_option_type_check;
ALTER TABLE catalog_item_options ADD CONSTRAINT catalog_item_options_option_type_check
  CHECK (option_type IN ('packaging','box_type','color','logo','brand','other'));

-- Storage for the original Excel and the product photos extracted from it
INSERT INTO storage.buckets (id, name, public) VALUES ('client-orders', 'client-orders', true)
  ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "allow_auth_upload_client_orders" ON storage.objects;
CREATE POLICY "allow_auth_upload_client_orders" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-orders');
DROP POLICY IF EXISTS "allow_auth_update_client_orders" ON storage.objects;
CREATE POLICY "allow_auth_update_client_orders" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'client-orders');
DROP POLICY IF EXISTS "allow_auth_delete_client_orders" ON storage.objects;
CREATE POLICY "allow_auth_delete_client_orders" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'client-orders');
DROP POLICY IF EXISTS "allow_public_read_client_orders" ON storage.objects;
CREATE POLICY "allow_public_read_client_orders" ON storage.objects FOR SELECT TO public USING (bucket_id = 'client-orders');
