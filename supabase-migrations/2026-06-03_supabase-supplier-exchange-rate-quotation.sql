-- ============================================================
-- GLOBAL SUPPLIER EXCHANGE RATE ON QUOTATIONS TABLE
-- Run this in Supabase SQL Editor
-- ============================================================

-- Document-level exchange rate: how many supplier-currency units equal 1 document-currency unit
-- e.g. doc=USD, supplier quotes in CNY → rate=7.25 means 1 USD = 7.25 CNY
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS supplier_exchange_rate numeric(12, 6);
