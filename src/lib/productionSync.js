// A purchase order is built ONCE from the quotation (per supplier). Products added to the quotation
// afterwards, or a supplier added later, never reach production — so they can't be ticked "ready"
// and never show up in the client's "ready items" statement. These helpers find that gap and close it.

const keyOf = (it) => String(it.item_number || it.description || "").trim().toLowerCase();

// Returns { quotation, groups: [{ supplier_id, supplier_name, po, items: [missing quotation items] }] }
export async function findProductionGaps(supabase, trackId) {
  const { data: quotes } = await supabase.from("quotations")
    .select("id, currency").eq("track_id", trackId).order("created_at", { ascending: false }).limit(1);
  const quotation = quotes?.[0];
  if (!quotation) return { quotation: null, groups: [] };

  const [{ data: qItems }, { data: pos }] = await Promise.all([
    supabase.from("quotation_items").select("*").eq("quotation_id", quotation.id).not("supplier_id", "is", null).order("sort_order"),
    supabase.from("purchase_orders").select("id, supplier_id, purchase_order_items(id, item_number, description, sort_order)").eq("track_id", trackId),
  ]);
  const supIds = [...new Set((qItems || []).map(i => i.supplier_id))];
  const { data: sups } = supIds.length ? await supabase.from("suppliers").select("id, name").in("id", supIds) : { data: [] };
  const nameOf = Object.fromEntries((sups || []).map(s => [s.id, s.name]));

  const groups = [];
  supIds.forEach(sid => {
    const po = (pos || []).find(p => p.supplier_id === sid) || null;
    const have = new Set((po?.purchase_order_items || []).map(keyOf));
    const missing = (qItems || []).filter(i => i.supplier_id === sid && keyOf(i) && !have.has(keyOf(i)));
    if (missing.length) groups.push({ supplier_id: sid, supplier_name: nameOf[sid] || "Proveedor", po, items: missing });
  });
  return { quotation, groups };
}

export async function applyProductionSync(supabase, trackId, { quotation, groups }) {
  for (const g of groups) {
    let po = g.po;
    if (!po) {
      const { data, error } = await supabase.from("purchase_orders").insert({
        track_id: trackId, quotation_id: quotation.id, supplier_id: g.supplier_id,
        currency: g.items[0]?.supplier_currency || quotation.currency,
      }).select("id").single();
      if (error) throw error;
      po = { id: data.id, purchase_order_items: [] };
    }
    const base = (po.purchase_order_items || []).reduce((m, i) => Math.max(m, i.sort_order ?? -1), -1) + 1;
    const rows = g.items.map((it, idx) => ({
      purchase_order_id: po.id, quotation_item_id: it.id, item_number: it.item_number, description: it.description,
      picture_url: it.picture_url, quantity: it.quantity, price: parseFloat(it.supplier_price) || 0, sort_order: base + idx,
    }));
    const { error } = await supabase.from("purchase_order_items").insert(rows);
    if (error) throw error;
  }
}
