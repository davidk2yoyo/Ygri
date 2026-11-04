// Shared helpers for client-order editing (portal + staff): line shape conversion,
// a diff that feeds the change log, and a human-readable summary of it.

export const ORDER_FIELDS = [
  ["supplier", "Proveedor"],
  ["supplier_ref", "Ref. proveedor"],
  ["name", "Nombre"],
  ["color", "Color"],
  ["qty", "Cantidad"],
  ["price", "Precio objetivo"],
  ["client_ref", "Ref. cliente"],
  ["brand", "Marca"],
  ["marking", "Marcación"],
  ["packaging", "Empaque"],
  ["notes", "Notas"],
  ["photo_url", "Foto"],
];

let keySeq = 0;
export const newLineKey = () => `new-${Date.now()}-${keySeq++}`;

export const emptyLine = (sheet_name = "") => ({
  _key: newLineKey(), id: null, sheet_name, supplier: "", supplier_ref: "", name: "", color: "",
  qty: "", price: "", client_ref: "", brand: "", marking: null, packaging: "", notes: "", photo_url: null,
});

// DB row (client_order_lines, optionally joined with suppliers(name)) -> editable line
export const lineFromDb = (r) => ({
  _key: r.id, id: r.id, sheet_name: r.sheet_name || "", supplier: r.suppliers?.name || r.supplier_name_raw || "",
  supplier_id: r.supplier_id || null, supplier_ref: r.supplier_ref || "", name: r.name || "", color: r.color || "",
  qty: r.qty ?? "", price: r.client_price ?? "", client_ref: r.client_ref || "", brand: r.brand || "",
  marking: r.marking ?? null, packaging: r.packaging || "", notes: r.notes || "", photo_url: r.photo_url || null,
  catalog_item_id: r.catalog_item_id || null, quotation_item_id: r.quotation_item_id || null,
});

// RPC payload (portal) – same shape the server function reads
export const lineToRpc = (l) => ({
  id: l.id || null, sheet_name: l.sheet_name, supplier: l.supplier, supplier_ref: l.supplier_ref, name: l.name,
  color: l.color, qty: l.qty === "" ? null : l.qty, price: l.price === "" ? null : l.price, client_ref: l.client_ref,
  brand: l.brand, marking: l.marking, packaging: l.packaging, notes: l.notes, photo_url: l.photo_url || null,
});

// editable line -> client_order_lines columns (staff direct writes)
export const lineToDb = (l, order_id, sort_order) => ({
  order_id, sheet_name: l.sheet_name || null, supplier_id: l.supplier_id || null, supplier_name_raw: l.supplier || null,
  supplier_ref: l.supplier_ref || null, name: l.name || null, color: l.color || null,
  qty: l.qty === "" || l.qty == null ? null : Number(l.qty), client_price: l.price === "" || l.price == null ? null : Number(l.price),
  client_ref: l.client_ref || null, brand: l.brand || null, marking: l.marking ?? null, packaging: l.packaging || null,
  notes: l.notes || null, photo_url: l.photo_url || null, sort_order,
});

export const norm = (field, v) => {
  if (v === "" || v == null) return null;
  if (field === "qty" || field === "price") return Number(v);
  if (field === "marking") return v === true || v === "true";
  return String(v).trim();
};

export const lineLabel = (l) => l.name || l.supplier_ref || l.client_ref || "(sin nombre)";

// Lines are matched by id. before/after are arrays of editable lines.
export function diffLines(before, after) {
  const prev = new Map(before.filter(l => l.id).map(l => [l.id, l]));
  const seen = new Set();
  const added = [], changed = [];
  for (const l of after) {
    const old = l.id ? prev.get(l.id) : null;
    if (!old) { added.push({ line: lineLabel(l), qty: norm("qty", l.qty) }); continue; }
    seen.add(l.id);
    for (const [f] of ORDER_FIELDS) {
      const a = norm(f, old[f]), b = norm(f, l[f]);
      if (a !== b) changed.push({ line: lineLabel(old), field: f, from: a, to: b });
    }
  }
  const removed = before.filter(l => l.id && !seen.has(l.id)).map(l => ({ line: lineLabel(l), qty: norm("qty", l.qty) }));
  return { added, removed, changed };
}

export const hasChanges = (d) => d.added.length + d.removed.length + d.changed.length > 0;

const fieldName = Object.fromEntries(ORDER_FIELDS);
const show = (f, v) => (f === "photo_url" ? (v ? "con foto" : "sin foto") : v == null ? "—" : f === "marking" ? (v ? "SI" : "NO") : String(v));

// -> array of short human strings for the log
export function describeChanges(c) {
  if (!c) return [];
  const out = [];
  (c.added || []).forEach(a => out.push(`Agregó «${a.line}»${a.qty ? ` (${a.qty})` : ""}`));
  (c.removed || []).forEach(a => out.push(`Quitó «${a.line}»`));
  (c.changed || []).forEach(x => out.push(`«${x.line}» · ${fieldName[x.field] || x.field}: ${show(x.field, x.from)} → ${show(x.field, x.to)}`));
  return out;
}

// a line is valid when it can be identified and has a quantity
export const lineProblems = (l) => ({
  id: !(l.name?.trim() || l.supplier_ref?.trim() || l.client_ref?.trim()),
  qty: !(Number(l.qty) > 0),
});

const sameLine = (a, b) => ORDER_FIELDS.every(([f]) => norm(f, a?.[f]) === norm(f, b?.[f]));

// Staff saves fail outright (nothing written) when the client saved the same order
// first — the revision lock exists to stop a silent overwrite, but the failed save
// used to just discard whatever staff had drafted. This rebuilds a safe retry: new
// lines staff added are never a conflict (they don't exist in the DB yet), and an
// edit/delete to an existing line is only reapplied automatically when nobody else
// touched that exact line since staff started editing — otherwise it's left as the
// client's version and surfaced in `needsReview` instead of guessed at.
// staffLines/baseline/freshLines are all arrays of editable lines (orderDiff shape).
export function mergeAfterConflict(staffLines, baseline, freshLines) {
  const baselineById = new Map(baseline.filter(l => l.id).map(l => [l.id, l]));
  const staffById = new Map(staffLines.filter(l => l.id).map(l => [l.id, l]));
  const staffNew = staffLines.filter(l => !l.id);

  const merged = [];
  const needsReview = [];

  freshLines.forEach(freshLine => {
    const staffEdit = staffById.get(freshLine.id);
    const base = baselineById.get(freshLine.id);

    if (!staffEdit) {
      // staff removed this line in their draft
      if (base && sameLine(freshLine, base)) return; // nobody else touched it — safe to drop
      needsReview.push({ type: "delete_conflict", line: freshLine });
      merged.push(freshLine);
      return;
    }
    if (sameLine(staffEdit, base)) { merged.push(freshLine); return; } // staff didn't actually change this one
    if (sameLine(freshLine, base)) { merged.push(staffEdit); return; } // only staff changed it — safe to reapply

    // both sides changed the same line — keep the client's version, staff must redo manually
    needsReview.push({ type: "edit_conflict", staffEdit, freshLine });
    merged.push(freshLine);
  });

  merged.push(...staffNew);
  return { merged, needsReview };
}
