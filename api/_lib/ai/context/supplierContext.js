// Read-only. No embeddings — "which suppliers have we used for safety
// glasses" is a text match against description/name, not a semantic search
// problem yet (Copilot Blueprint §D/§18).
export async function buildSupplierContext(supabase, supplierId) {
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, email, sales_person, wechat_or_whatsapp, website, country, city, last_email_at")
    .eq("id", supplierId)
    .maybeSingle();
  if (!supplier) return null;

  const [{ data: products }, { data: priceTiers }, { data: quotationItems }, { data: purchaseOrders }, { data: emailThreads }] = await Promise.all([
    supabase.from("supplier_products").select("name, description, price, currency, unit, min_order_qty").eq("supplier_id", supplierId).limit(20),
    supabase.from("supplier_price_tiers").select("description, min_qty, max_qty, price, currency").eq("supplier_id", supplierId).limit(20),
    supabase.from("quotation_items").select("description, price, quantity, supplier_currency").eq("supplier_id", supplierId).order("created_at", { ascending: false }).limit(10),
    supabase.from("purchase_orders").select("po_number, status, currency, created_at").eq("supplier_id", supplierId).order("created_at", { ascending: false }).limit(10),
    supabase.from("email_threads").select("subject, needs_response, priority, last_received_at").eq("supplier_id", supplierId).order("last_received_at", { ascending: false }).limit(5),
  ]);

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      contact: supplier.sales_person,
      email: supplier.email,
      location: [supplier.city, supplier.country].filter(Boolean).join(", ") || null,
      last_email_at: supplier.last_email_at,
    },
    products: products || [],
    price_tiers: priceTiers || [],
    recent_quotation_items: quotationItems || [],
    purchase_orders: purchaseOrders || [],
    recent_email_threads: emailThreads || [],
  };
}

// Text-only search across supplier name/product description — used by the
// search_suppliers tool and by "which suppliers have we used for X" style
// questions. Plain ILIKE, not semantic.
export async function searchSuppliersByText(supabase, query) {
  const like = `%${query}%`;
  const [{ data: byName }, { data: byProduct }] = await Promise.all([
    supabase.from("suppliers").select("id, name, country, city").ilike("name", like).limit(10),
    supabase.from("quotation_items").select("supplier_id, description, suppliers(id, name, country, city)").ilike("description", like).limit(20),
  ]);
  const fromProducts = (byProduct || [])
    .filter((r) => r.suppliers)
    .map((r) => ({ id: r.suppliers.id, name: r.suppliers.name, country: r.suppliers.country, city: r.suppliers.city, matched_via: r.description }));
  const seen = new Set();
  return [...(byName || []), ...fromProducts].filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}
