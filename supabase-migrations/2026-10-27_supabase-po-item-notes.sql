-- A free-text note per purchase-order item, alongside the ready_at/
-- expected_ready_date added earlier — staff-only (never exposed through
-- client_portal_get_orders, unlike ready_at/expected_ready_date), since a
-- production remark isn't necessarily something to show the client.
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS notes text;
