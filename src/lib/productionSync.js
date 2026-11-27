// A purchase order is built ONCE from the quotation (per supplier). Products added to the quotation
// afterwards, or a supplier added later, never reach production — so they can't be ticked "ready"
// and never show up in the client's "ready items" statement. These helpers find that gap and close it.
// A project can hold several proformas/invoices after a split: every one of them is checked, and a
// product is matched to production by the client's order line when both carry it, else by item number.

const keyOf = (it) => String(it.item_number || it.description || "").trim().toLowerCase();

// Pure: which of the project's document items are missing from production.
// docItems: quotation items (with quotation_id, supplier_id, client_order_line_id, quantity); pos: purchase orders with items.
export function computeGaps(docItems, pos) {
  const poItems = (pos || []).flatMap(po => (po.purchase_order_items || []).map(i => ({ ...i, supplier_id: po.supplier_id })));
  const haveLines = new Set(poItems.map(i => i.client_order_line_id).filter(Boolean));
  const keysNoLine = new Set(poItems.filter(i => !i.client_order_line_id).map(keyOf));
  const allKeys = new Set(poItems.map(keyOf));

  // the same order line can sit in two documents after a split: one production item, total quantity
  const merged = new Map();
  (docItems || []).forEach(it => {
    if (!it.supplier_id || !keyOf(it)) return;
    const id = it.client_order_line_id ? `L:${it.client_order_line_id}` : `I:${it.id}`;
    const prev = merged.get(id);
    if (prev) prev.quantity = (parseInt(prev.quantity) || 0) + (parseInt(it.quantity) || 0);
    else merged.set(id, { ...it, quantity: parseInt(it.quantity) || 0 });
  });

  const missing = [...merged.values()].filter(it => it.client_order_line_id
    ? !haveLines.has(it.client_order_line_id) && !keysNoLine.has(keyOf(it))
    : !allKeys.has(keyOf(it)));

  const groups = [];
  [...new Set(missing.map(i => i.supplier_id))].forEach(sid => {
    const po = (pos || []).find(p => p.supplier_id === sid) || null;
    groups.push({ supplier_id: sid, po, items: missing.filter(i => i.supplier_id === sid) });
  });
  return groups;
}

// Returns { quotation, groups: [{ supplier_id, supplier_name, po, items: [missing quotation items] }] }
export async function findProductionGaps(supabase, trackId) {
  const { data: docs } = await supabase.from("quotations")
    .select("id, currency, document_type, created_at").eq("track_id", trackId).order("created_at", { ascending: false });
  const list = docs || [];
  if (!list.length) return { quotation: null, groups: [] };
  // proformas/invoices are what gets produced; a project that only has a quotation falls back to the latest one
  const real = list.filter(d => d.document_type === "proforma" || d.document_type === "invoice");
  const used = real.length ? real : [list[0]];
  const quotation = used[0];

  const poQuery = (cols) => supabase.from("purchase_orders").select(`id, supplier_id, purchase_order_items(${cols})`).eq("track_id", trackId);
  let [{ data: qItems }, { data: pos, error: poErr }] = await Promise.all([
    supabase.from("quotation_items").select("*").in("quotation_id", used.map(d => d.id)).not("supplier_id", "is", null).order("sort_order"),
    poQuery("id, item_number, description, sort_order, client_order_line_id"),
  ]);
  // before the 2026-11-30 migration the column doesn't exist: ask again without it rather than treating everything as missing
  if (poErr) ({ data: pos, error: poErr } = await poQuery("id, item_number, description, sort_order"));
  if (poErr) throw poErr;
  const groupsRaw = computeGaps(qItems || [], pos || []);
  const supIds = groupsRaw.map(g => g.supplier_id);
  const { data: sups } = supIds.length ? await supabase.from("suppliers").select("id, name").in("id", supIds) : { data: [] };
  const nameOf = Object.fromEntries((sups || []).map(s => [s.id, s.name]));
  return { quotation, groups: groupsRaw.map(g => ({ ...g, supplier_name: nameOf[g.supplier_id] || "Proveedor" })) };
}

// Insert production items; if the 2026-11-30 migration (client_order_line_id column) isn't applied yet, retry without it.
export async function insertPurchaseOrderItems(supabase, rows) {
  let { error } = await supabase.from("purchase_order_items").insert(rows);
  if (error && /client_order_line_id/.test(error.message || "")) {
    ({ error } = await supabase.from("purchase_order_items").insert(rows.map(({ client_order_line_id, ...r }) => r)));
  }
  if (error) throw error;
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
      client_order_line_id: it.client_order_line_id || null,
    }));
    await insertPurchaseOrderItems(supabase, rows);
  }
}
