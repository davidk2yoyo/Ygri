import { createProjectActivity } from "./projectActivity";

// Split a proforma/invoice in two: some lines (or part of a line's quantity) move to a NEW document
// in the same project. The new one starts hidden from the client (show_to_client = false) and is
// linked back through quotations.split_from_id. Purchase orders, payments and packing lists are not
// touched. Pure planning functions are exported separately so they can be unit-tested.

const num = (v) => parseFloat(v) || 0;

// Same formula QuotationForm uses for total_amount: (price + chosen-option extras) × qty, + commission.
export function lineValue(item, options = []) {
  const extra = item.all_inclusive ? 0 : options.reduce((s, o) => s + num(o.extra_price), 0);
  return (num(item.price) + extra) * (parseInt(item.quantity) || 1);
}

export function documentTotal(items, optionsByItem, commissionPct) {
  const sub = items.reduce((s, it) => s + lineValue(it, optionsByItem[it.id] || []), 0);
  return Math.round(sub * (1 + num(commissionPct) / 100) * 100) / 100;
}

// picks: { [itemId]: qty to move }. Returns what to move and what remains, or an error message.
export function planSplit({ items, optionsByItem = {}, picks, commissionPct = 0 }) {
  const moved = [];
  const keep = [];
  for (const it of items) {
    const qty = Math.floor(num(picks[it.id]));
    const have = parseInt(it.quantity) || 1;
    if (!(qty > 0)) { keep.push({ item: it, remaining: have }); continue; }
    if (qty > have) return { error: `“${it.description || it.item_number}”: no puedes mover ${qty}, solo hay ${have}.` };
    moved.push({ item: it, qty });
    if (qty < have) keep.push({ item: it, remaining: have - qty, reduce: true });
  }
  if (!moved.length) return { error: "Elige al menos un ítem para mover." };
  if (!keep.length) return { error: "Eso movería todo y dejaría la factura original vacía. Deja al menos una línea en ella." };

  const movedItems = moved.map(m => ({ ...m.item, quantity: m.qty }));
  const keptItems = keep.map(k => ({ ...k.item, quantity: k.remaining }));
  return {
    moved, keep,
    movedTotal: documentTotal(movedItems, optionsByItem, commissionPct),
    keptTotal: documentTotal(keptItems, optionsByItem, commissionPct),
  };
}

const HEADER_FIELDS = ["track_id", "purpose", "type", "currency", "incoterm", "incoterm_location", "delivery_time",
  "negotiation_term", "deposit_pct", "notes", "commission_pct", "show_commission", "document_type", "client_name",
  "project_name", "valid_until", "supplier_exchange_rate"];

const stripRow = (row, extra = []) => {
  const out = { ...row };
  ["id", "created_at", "updated_at", ...extra].forEach(k => delete out[k]);
  return out;
};

export async function splitInvoice(supabase, { sourceId, picks }) {
  const { data: src, error: sErr } = await supabase.from("quotations").select("*").eq("id", sourceId).single();
  if (sErr || !src) throw new Error(sErr?.message || "No se encontró el documento.");
  if (src.document_type !== "invoice" && src.document_type !== "proforma") throw new Error("Solo se pueden dividir proformas y facturas.");

  const { data: items, error: iErr } = await supabase.from("quotation_items").select("*").eq("quotation_id", sourceId).order("sort_order");
  if (iErr) throw iErr;
  const ids = (items || []).map(i => i.id);
  const [{ data: opts }, { data: tiers }] = ids.length ? await Promise.all([
    supabase.from("quotation_item_options").select("*").in("quotation_item_id", ids),
    supabase.from("quotation_item_price_tiers").select("*").in("quotation_item_id", ids),
  ]) : [{ data: [] }, { data: [] }];
  const optionsByItem = {}, tiersByItem = {};
  (opts || []).forEach(o => { (optionsByItem[o.quotation_item_id] ||= []).push(o); });
  (tiers || []).forEach(t => { (tiersByItem[t.quotation_item_id] ||= []).push(t); });

  const plan = planSplit({ items: items || [], optionsByItem, picks, commissionPct: src.commission_pct });
  if (plan.error) throw new Error(plan.error);

  // 1. new document (hidden from the client until staff publishes it)
  const header = {};
  HEADER_FIELDS.forEach(k => { header[k] = src[k] ?? null; });
  header.show_commission = !!src.show_commission;
  header.internal_notes = [`Dividida de ${src.quote_number}`, src.internal_notes].filter(Boolean).join("\n");
  header.total_amount = plan.movedTotal;
  header.show_to_client = false;
  let ins = await supabase.from("quotations").insert({ ...header, split_from_id: src.id }).select().single();
  if (ins.error && /split_from_id/.test(ins.error.message || "")) {
    // migration 2026-11-28 not applied yet: still works, just without the back-link
    ins = await supabase.from("quotations").insert(header).select().single();
  }
  if (ins.error) throw ins.error;
  const created = ins.data;
  const rollbackNew = () => supabase.from("quotations").delete().eq("id", created.id);

  try {
    // 2. copy the moved lines (with options and price tiers) under the new document
    const rows = plan.moved.map((m, idx) => ({ ...stripRow(m.item, ["quotation_id"]), quotation_id: created.id, quantity: m.qty, sort_order: idx }));
    const { data: newItems, error: nErr } = await supabase.from("quotation_items").insert(rows).select("id, sort_order");
    if (nErr) throw nErr;
    const oRows = [], tRows = [];
    (newItems || []).forEach(n => {
      const srcId = plan.moved[n.sort_order].item.id;
      (optionsByItem[srcId] || []).forEach(o => oRows.push({ ...stripRow(o, ["quotation_item_id"]), quotation_item_id: n.id }));
      (tiersByItem[srcId] || []).forEach(t => tRows.push({ ...stripRow(t, ["quotation_item_id"]), quotation_item_id: n.id }));
    });
    if (oRows.length) { const { error } = await supabase.from("quotation_item_options").insert(oRows); if (error) throw error; }
    if (tRows.length) { const { error } = await supabase.from("quotation_item_price_tiers").insert(tRows); if (error) throw error; }
  } catch (e) {
    await rollbackNew();
    throw e;
  }

  // 3. take them out of the original: lower quantities first, then remove fully moved lines in one statement
  const reduced = [];
  const removeIds = plan.moved.filter(m => m.qty >= (parseInt(m.item.quantity) || 1)).map(m => m.item.id);
  const originalQty = Object.fromEntries(plan.moved.map(m => [m.item.id, parseInt(m.item.quantity) || 1]));
  try {
    for (const k of plan.keep.filter(k => k.reduce)) {
      const { error } = await supabase.from("quotation_items").update({ quantity: k.remaining }).eq("id", k.item.id);
      if (error) throw error;
      reduced.push(k);
    }
    if (removeIds.length) {
      const { error } = await supabase.from("quotation_items").delete().in("id", removeIds);
      if (error) throw error;
    }
    const { error: tErr } = await supabase.from("quotations").update({ total_amount: plan.keptTotal, updated_at: new Date().toISOString() }).eq("id", sourceId);
    if (tErr) throw tErr;
  } catch (e) {
    // best effort: put quantities back and drop the new document so nothing ends up duplicated
    for (const k of reduced) await supabase.from("quotation_items").update({ quantity: originalQty[k.item.id] }).eq("id", k.item.id);
    await rollbackNew();
    throw e;
  }

  createProjectActivity(src.track_id, "quotation_split", {
    from: src.quote_number, quote_number: created.quote_number, items: plan.moved.length, currency: src.currency, total: plan.movedTotal,
  }, { quotationId: created.id });

  return { created, source: { ...src, total_amount: plan.keptTotal }, movedCount: plan.moved.length, movedTotal: plan.movedTotal, keptTotal: plan.keptTotal };
}
