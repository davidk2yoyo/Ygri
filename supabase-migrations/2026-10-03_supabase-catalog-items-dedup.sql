-- ============================================================
-- CATALOG ITEMS DEDUP — canonical product per item_number
-- Run this in Supabase SQL Editor
--
-- Before running against real data, run the SELECT in STEP 0 alone
-- first and eyeball the groups — don't blind-merge. Nothing is ever
-- deleted: duplicates are marked is_active = false and pointed at
-- their canonical row via merged_into_id, and every quotation_items
-- row that referenced a duplicate is repointed to the canonical id.
-- ============================================================

-- STEP 0 (read-only, run first): preview what would be merged
-- SELECT lower(trim(item_number)) AS key, array_agg(id ORDER BY created_at) AS ids, count(*)
-- FROM catalog_items
-- WHERE item_number IS NOT NULL AND trim(item_number) <> ''
-- GROUP BY lower(trim(item_number))
-- HAVING count(*) > 1;

ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES catalog_items(id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_merged_into_id ON catalog_items(merged_into_id);

-- STEP 1: repoint quotation_items off duplicate catalog rows onto the
-- oldest (canonical) row for the same item_number
WITH dupes AS (
  SELECT id,
         row_number() OVER (PARTITION BY lower(trim(item_number)) ORDER BY created_at ASC) AS rn,
         first_value(id) OVER (PARTITION BY lower(trim(item_number)) ORDER BY created_at ASC) AS canonical_id
  FROM catalog_items
  WHERE item_number IS NOT NULL AND trim(item_number) <> ''
)
UPDATE quotation_items qi
SET catalog_item_id = d.canonical_id
FROM dupes d
WHERE qi.catalog_item_id = d.id AND d.rn > 1;

-- STEP 2: soft-merge the now-orphaned duplicates (no deletes)
WITH dupes AS (
  SELECT id,
         row_number() OVER (PARTITION BY lower(trim(item_number)) ORDER BY created_at ASC) AS rn,
         first_value(id) OVER (PARTITION BY lower(trim(item_number)) ORDER BY created_at ASC) AS canonical_id
  FROM catalog_items
  WHERE item_number IS NOT NULL AND trim(item_number) <> ''
)
UPDATE catalog_items c
SET is_active = false, merged_into_id = d.canonical_id
FROM dupes d
WHERE c.id = d.id AND d.rn > 1;

-- STEP 3: enforce it going forward (active rows only — merged rows keep
-- their now-inactive item_number without blocking the canonical one)
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_item_number_unique_idx
  ON catalog_items (lower(trim(item_number)))
  WHERE item_number IS NOT NULL AND trim(item_number) <> '' AND is_active = true;

-- STEP 4: price history — a view, not a new table. quotation_items
-- already has every historical (catalog_item_id, price, quantity, date)
-- point; no second write-path to keep in sync.
CREATE OR REPLACE VIEW v_catalog_item_price_history AS
SELECT
  qi.catalog_item_id,
  qi.id AS quotation_item_id,
  qi.price,
  qi.quantity,
  qi.supplier_price,
  q.currency,
  q.quote_number,
  q.document_type,
  q.created_at AS quoted_at
FROM quotation_items qi
JOIN quotations q ON q.id = qi.quotation_id
WHERE qi.catalog_item_id IS NOT NULL
ORDER BY q.created_at DESC;

-- Without this, the view runs with the CREATOR's permissions (bypassing
-- RLS on quotation_items/quotations) instead of the querying user's —
-- caught by Supabase's security advisor after first applying this.
ALTER VIEW v_catalog_item_price_history SET (security_invoker = true);

GRANT SELECT ON v_catalog_item_price_history TO authenticated;
