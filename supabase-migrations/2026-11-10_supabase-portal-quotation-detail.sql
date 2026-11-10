-- Full detail of ONE quotation/proforma/invoice for the client portal (used by the Excel export):
-- items with chosen options and quantity price tiers, plus the payments. Only the client's own
-- documents that are shown to them (track + document both visible). Supplier names, costs and
-- margins are never returned. Uses to_jsonb(...)->'col' so a missing optional column is just null.
CREATE OR REPLACE FUNCTION public.client_portal_get_quotation_detail(p_session_id uuid, p_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_client_id UUID; v_name TEXT; v_q quotations%ROWTYPE; v_qj jsonb; v_items jsonb; v_pay jsonb;
BEGIN
  SELECT c.client_id, c.client_name INTO v_client_id, v_name FROM client_portal_verify_session(p_session_id) c;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT q.* INTO v_q FROM quotations q JOIN tracks t ON t.id = q.track_id
   WHERE q.id = p_quotation_id AND q.show_to_client = true AND t.show_to_client = true AND t.client_id = v_client_id;
  IF v_q.id IS NULL THEN RETURN NULL; END IF;
  v_qj := to_jsonb(v_q);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', qi.id, 'item_number', qi.item_number, 'client_ref', to_jsonb(qi)->'client_ref',
      'description', qi.description, 'picture_url', qi.picture_url, 'quantity', qi.quantity, 'price', qi.price,
      'moq', to_jsonb(qi)->'moq', 'all_inclusive', to_jsonb(qi)->'all_inclusive',
      'selectedOptions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('option_type', o.option_type, 'label', o.label, 'extra_price', o.extra_price)
                            ORDER BY o.sort_order), '[]'::jsonb) FROM quotation_item_options o WHERE o.quotation_item_id = qi.id),
      'priceTiers', (SELECT COALESCE(jsonb_agg(jsonb_build_object('min_qty', t.min_qty, 'max_qty', t.max_qty, 'price', t.price, 'notes', t.notes)
                            ORDER BY t.min_qty), '[]'::jsonb) FROM quotation_item_price_tiers t WHERE t.quotation_item_id = qi.id)
    ) ORDER BY qi.sort_order, qi.created_at), '[]'::jsonb)
    INTO v_items FROM quotation_items qi WHERE qi.quotation_id = v_q.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'payment_date', p.payment_date, 'amount', p.amount,
           'currency', p.currency, 'method', to_jsonb(p)->'method') ORDER BY p.payment_date), '[]'::jsonb)
    INTO v_pay FROM quotation_payments p WHERE p.quotation_id = v_q.id;

  RETURN jsonb_build_object(
    'quotation', jsonb_build_object(
      'id', v_q.id, 'quote_number', v_qj->'quote_number', 'document_type', v_qj->'document_type', 'type', v_qj->'type',
      'currency', v_qj->'currency', 'incoterm', v_qj->'incoterm', 'incoterm_location', v_qj->'incoterm_location',
      'delivery_time', v_qj->'delivery_time', 'valid_until', v_qj->'valid_until', 'notes', v_qj->'notes',
      'negotiation_term', v_qj->'negotiation_term', 'commission_pct', v_qj->'commission_pct',
      'show_commission', v_qj->'show_commission', 'deposit_pct', v_qj->'deposit_pct',
      'project_name', v_qj->'project_name', 'created_at', v_qj->'created_at', 'track_id', v_qj->'track_id'),
    'items', v_items,
    'payments', v_pay);
END; $$;

REVOKE ALL ON FUNCTION public.client_portal_get_quotation_detail(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_get_quotation_detail(uuid, uuid) TO anon, authenticated;
