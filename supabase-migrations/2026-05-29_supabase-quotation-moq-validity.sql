-- ============================================================
-- MOQ + OFFER VALIDITY
-- Run this in Supabase SQL Editor
-- ============================================================

-- Offer validity date on the quotation header (quotation type only)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_until date;

-- Minimum Order Quantity per item (quotation type only, optional)
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS moq integer;
