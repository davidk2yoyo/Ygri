import { resolveOrCreateCatalogItem } from "./catalogItems";

// What the client asked for (packaging, colour, marking, brand) becomes the item's
// chosen options on the quotation, so staff only has to price them.
function optionsFor(l) {
  const out = [];
  if (l.packaging) out.push({ option_type: "packaging", label: l.packaging });
  if (l.color) out.push({ option_type: "color", label: l.color });
  if (l.marking === true) out.push({ option_type: "logo", label: l.brand ? `Marcación ${l.brand}` : "Marcación" });
  else if (l.brand) out.push({ option_type: "other", label: `Marca: ${l.brand}` });
  return out;
}

// order: client_orders row (with clients(company_name)); lines: editable lines (orderDiff shape).
// Creates the project, a draft quotation with one item per order line, and links everything back.
// Insert-first: the quotation is complete in the DB before staff opens it in the normal form.
export async function createProjectAndQuotation(supabase, { order, lines, projectName, workflow, showToClient, actorName, supplierMap }) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("User not authenticated");
  if (order.track_id) throw new Error("This order already has a project.");

  // 1. project
  const { data: trackId, error: tErr } = await supabase.rpc("create_track_rpc", {
    p_client_id: order.client_id, p_name: projectName.trim(), p_remarks: `From client order ${order.reference || ""}`.trim(),
    p_workflow: workflow, p_owner_id: user.id,
  });
  if (tErr) throw tErr;
  if (showToClient) await supabase.rpc("admin_toggle_track_client_visibility", { p_track_id: trackId, p_visible: true });
  await supabase.from("client_orders").update({ track_id: trackId, updated_at: new Date().toISOString() }).eq("id", order.id);
  await supabase.from("client_order_events").insert({ order_id: order.id, actor_type: "staff", actor_name: actorName, kind: "project_created", note: projectName.trim() });

  // 2. quotation header (numbering comes from the set_quote_number trigger)
  const { data: quote, error: qErr } = await supabase.from("quotations").insert({
    track_id: trackId, type: String(workflow).toLowerCase() === "service" ? "service" : "product", currency: "USD", document_type: "quotation",
    client_name: order.clients?.company_name || null, project_name: projectName.trim(), total_amount: 0,
    purpose: order.reference ? `Client order ${order.reference}` : null,
  }).select().single();
  if (qErr) throw qErr;

  // 3. items (catalog resolved like the form does, so products never duplicate; supplier comes from
  // supplierMap — staff already confirmed/created each one in a review step before calling this,
  // since clients type a supplier name as free text and auto-resolving it silently isn't safe).
  const catalogCache = [];
  const needsSupplier = String(workflow).toLowerCase() !== "service";
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const description = l.name || l.supplier_ref || l.client_ref || "";
    let catalogId = l.catalog_item_id || null;
    if (!catalogId && description.trim()) {
      const cat = await resolveOrCreateCatalogItem(supabase, {
        item_number: l.supplier_ref || null, description, picture_url: l.photo_url || null, default_price: null,
      }, catalogCache);
      if (cat) { catalogId = cat.id; catalogCache.push(cat); }
    }
    let supplierId = l.supplier_id || null;
    if (needsSupplier && !supplierId && l.supplier?.trim()) {
      supplierId = supplierMap?.[l.supplier.trim()] || null;
    }
    rows.push({
      quotation_id: quote.id, catalog_item_id: catalogId, item_number: l.supplier_ref || null, description,
      picture_url: l.photo_url || null, price: Number(l.price) || 0, quantity: Math.max(1, Math.round(Number(l.qty) || 1)),
      supplier_id: needsSupplier ? supplierId : null, client_ref: l.client_ref || null,
      client_order_line_id: l.id, sort_order: i,
    });
  }
  const { data: inserted, error: iErr } = await supabase.from("quotation_items").insert(rows).select("id, sort_order");
  if (iErr) throw iErr;

  const optionRows = [];
  (inserted || []).forEach(row => {
    optionsFor(lines[row.sort_order]).forEach((o, oi) => optionRows.push({ quotation_item_id: row.id, ...o, extra_price: 0, sort_order: oi }));
  });
  if (optionRows.length) {
    const { error: oErr } = await supabase.from("quotation_item_options").insert(optionRows);
    if (oErr) throw oErr;
  }

  // 4. link back + status
  await supabase.from("client_order_lines").update({ match_status: "matched" }).in("id", lines.map(l => l.id).filter(Boolean));
  await supabase.from("client_orders").update({ quotation_id: quote.id, status: "in_review", updated_at: new Date().toISOString() }).eq("id", order.id);
  await supabase.from("client_order_events").insert({
    order_id: order.id, actor_type: "staff", actor_name: actorName, kind: "quotation_created", note: quote.quote_number,
  });
  return { trackId, quotation: quote };
}

// Staff sends the priced quotation back: the quotation + project must be visible to the client.
export async function sendQuotationToClient(supabase, { order, note, actorName }) {
  if (!order.quotation_id || !order.track_id) throw new Error("Create the project and quotation first.");
  const { error: qErr } = await supabase.from("quotations").update({ show_to_client: true }).eq("id", order.quotation_id);
  if (qErr) throw qErr;
  const { error: tErr } = await supabase.rpc("admin_toggle_track_client_visibility", { p_track_id: order.track_id, p_visible: true });
  if (tErr) throw tErr;
  const { error: oErr } = await supabase.from("client_orders")
    .update({ status: "quoted", updated_at: new Date().toISOString() }).eq("id", order.id);
  if (oErr) throw oErr;
  await supabase.from("client_order_events").insert({
    order_id: order.id, actor_type: "staff", actor_name: actorName, kind: "quotation_sent", note: note?.trim() || null,
  });
}
