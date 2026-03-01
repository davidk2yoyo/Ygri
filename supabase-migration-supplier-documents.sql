-- Create supplier_documents table
CREATE TABLE IF NOT EXISTS supplier_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Optional: Link to quotation for better tracking
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,

  -- Document info
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('catalog', 'quotation', 'contract', 'certificate', 'product_sheet', 'other')),

  -- File info
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,

  -- Metadata
  notes TEXT,

  -- Quotation-specific fields
  validity_date DATE,
  amount DECIMAL(15, 2),
  reference_number TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_quotation_id ON supplier_documents(quotation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_document_type ON supplier_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_created_at ON supplier_documents(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_supplier_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_documents_updated_at
  BEFORE UPDATE ON supplier_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_documents_updated_at();

-- Enable RLS
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON supplier_documents;
DROP POLICY IF EXISTS "supplier_documents_select" ON supplier_documents;
DROP POLICY IF EXISTS "supplier_documents_insert" ON supplier_documents;
DROP POLICY IF EXISTS "supplier_documents_update" ON supplier_documents;
DROP POLICY IF EXISTS "supplier_documents_delete" ON supplier_documents;

-- Create RLS policies for authenticated users
CREATE POLICY "supplier_documents_select"
  ON supplier_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "supplier_documents_insert"
  ON supplier_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "supplier_documents_update"
  ON supplier_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "supplier_documents_delete"
  ON supplier_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- Storage bucket setup instructions:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named 'supplier-documents'
-- 3. Set bucket to public or configure policies as needed
-- 4. File size limit: recommended 50MB per file

COMMENT ON TABLE supplier_documents IS 'Stores supplier documents including catalogs, quotations, contracts, etc.';
COMMENT ON COLUMN supplier_documents.document_type IS 'Type of document: catalog, quotation, contract, certificate, product_sheet, other';
COMMENT ON COLUMN supplier_documents.status IS 'Status for quotations: pending, approved, rejected, expired';
