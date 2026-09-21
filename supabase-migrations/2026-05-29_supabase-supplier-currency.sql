-- ============================================================
-- SUPPLIER CURRENCY + EXCHANGE RATE PER ITEM
-- Run this in Supabase SQL Editor
-- ============================================================

-- Currency in which the supplier quoted their price (null = same as document currency)
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS supplier_currency text;

-- How many supplier-currency units equal 1 document-currency unit
-- e.g. doc=USD, supplier=CNY → rate=7.25 means 1 USD = 7.25 CNY
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS supplier_exchange_rate numeric(12, 6);
