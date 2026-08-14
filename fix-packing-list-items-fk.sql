-- Fix: quotation_items rows get fully replaced (deleted + recreated) on every
-- quotation save by design in this app. packing_list_items.quotation_item_id
-- was missing ON DELETE SET NULL, so any packing list item ever linked via
-- "Import items from quote" permanently blocked future saves of that quotation.
-- The packing list item keeps its own copy of item_number/description, so
-- clearing the back-reference is safe — nothing is lost.

ALTER TABLE packing_list_items DROP CONSTRAINT packing_list_items_quotation_item_id_fkey;

ALTER TABLE packing_list_items
  ADD CONSTRAINT packing_list_items_quotation_item_id_fkey
  FOREIGN KEY (quotation_item_id) REFERENCES quotation_items(id) ON DELETE SET NULL;
