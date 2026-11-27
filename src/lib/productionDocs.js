// Which proforma/invoice each production item belongs to (staff side). Returns null when the project has
// fewer than two such documents, or when the 2026-11-30 migration isn't applied yet — callers then show
// production exactly as before.
export async function loadProductionDocs(supabase, trackId) {
  const [{ data: docs, error: dErr }, { data: rows, error: rErr }] = await Promise.all([
    supabase.from("quotations").select("id, quote_number, document_type, purpose, show_to_client, created_at")
      .eq("track_id", trackId).in("document_type", ["proforma", "invoice"]).order("created_at"),
    supabase.rpc("production_item_documents", { p_track_id: trackId, p_only_visible: false }),
  ]);
  if (dErr || rErr || !docs || docs.length < 2) return null;
  const byItem = {};
  (rows || []).forEach(r => { (byItem[r.po_item_id] ||= []).push({ id: r.quotation_id, quote_number: r.quote_number, qty: Number(r.qty) }); });
  Object.values(byItem).forEach(list => list.sort((a, b) => a.quote_number.localeCompare(b.quote_number)));
  return { docs, byItem };
}

// Pure: filter + decorate purchase orders for one document ("all" | quotation id | "none").
export function filterProduction(purchaseOrders, byItem, filter) {
  return purchaseOrders.map(po => ({
    ...po,
    items: po.items
      .map(it => ({ ...it, docs: byItem[it.id] || [] }))
      .filter(it => filter === "all" || (filter === "none" ? it.docs.length === 0 : it.docs.some(d => d.id === filter))),
  })).filter(po => filter === "all" || po.items.length > 0);
}

// Pure: ready / total per document, plus how many items match no document.
export function documentCounts(purchaseOrders, byItem, docs) {
  const counts = Object.fromEntries(docs.map(d => [d.id, { ready: 0, total: 0 }]));
  let none = 0;
  purchaseOrders.forEach(po => po.items.forEach(it => {
    const list = byItem[it.id] || [];
    if (!list.length) none++;
    list.forEach(d => { if (counts[d.id]) { counts[d.id].total++; if (it.ready_at) counts[d.id].ready++; } });
  }));
  return { counts, none };
}
