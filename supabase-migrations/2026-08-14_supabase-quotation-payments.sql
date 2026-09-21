-- ============================================================
-- CLIENT PAYMENTS — register payments against a Proforma/Invoice,
-- with optional proof-of-payment file attached
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS quotation_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
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

ALTER TABLE quotation_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_quotation_payments" ON quotation_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_quotation_payments" ON quotation_payments FOR SELECT TO anon USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON quotation_payments TO authenticated;
GRANT SELECT ON quotation_payments TO anon;

CREATE INDEX IF NOT EXISTS idx_quotation_payments_quotation_id ON quotation_payments(quotation_id);

-- Storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', true) ON CONFLICT DO NOTHING;

CREATE POLICY "anon_read_payment_receipts" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'payment-receipts');
CREATE POLICY "auth_upload_payment_receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-receipts');
CREATE POLICY "auth_delete_payment_receipts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-receipts');
