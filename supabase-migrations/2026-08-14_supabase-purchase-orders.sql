-- ============================================================
-- PURCHASE ORDERS — created from a specific client quotation/proforma/
-- invoice, split by supplier, with only the items actually ordered.
-- Items are snapshotted (not a live reference) so a later edit of the
-- source quotation never breaks an already-placed order.
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  track_id uuid NOT NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  quotation_item_id uuid REFERENCES quotation_items(id) ON DELETE SET NULL,
  item_number text,
  description text,
  picture_url text,
  quantity integer DEFAULT 1,
  price numeric(12,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  notes text,
  receipt_url text,
  receipt_file_name text,
  created_at timestamptz DEFAULT now()
);

-- Auto-generate po_number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM purchase_orders;
  NEW.po_number := 'PO-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION generate_po_number();

CREATE OR REPLACE FUNCTION touch_purchase_order_updated()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER purchase_order_updated
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION touch_purchase_order_updated();

-- RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_purchase_orders" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_purchase_order_items" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_purchase_order_payments" ON purchase_order_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table-level GRANTs (required on this project — RLS alone is not enough)
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_payments TO authenticated;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_track_id ON purchase_orders(track_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_quotation_id ON purchase_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_payments_po_id ON purchase_order_payments(purchase_order_id);
