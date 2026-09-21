-- Supplier products / catalog table
CREATE TABLE IF NOT EXISTS supplier_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  specifications text,
  tags          text[] DEFAULT '{}',
  price         numeric(12,2),
  currency      text DEFAULT 'USD',
  unit          text,
  min_order_qty numeric(10,2),
  image_url     text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_products_supplier_id_idx ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS supplier_products_tags_idx ON supplier_products USING GIN(tags);

-- Enable RLS (adjust policies to match your project's auth setup)
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access" ON supplier_products
  FOR ALL USING (auth.role() = 'authenticated');
