// Looks up an existing catalog_items row before creating a new one, so the
// same product (matched by item_number, or by description when there's no
// item_number) never accumulates duplicate rows/IDs across quotations.
export async function resolveOrCreateCatalogItem(supabase, { item_number, description, picture_url, default_price }, cache = []) {
  const normNumber = (item_number || "").trim().toLowerCase();
  const normDesc = (description || "").trim().toLowerCase();

  if (normNumber) {
    const cached = cache.find(c => (c.item_number || "").trim().toLowerCase() === normNumber);
    if (cached) return cached;

    const { data: found } = await supabase
      .from("catalog_items")
      .select("*")
      .ilike("item_number", item_number.trim())
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (found) return found;
  } else if (normDesc) {
    const cached = cache.find(c => !c.item_number && (c.description || "").trim().toLowerCase() === normDesc);
    if (cached) return cached;
  }

  const { data: created, error } = await supabase
    .from("catalog_items")
    .insert({ item_number: item_number || null, description, picture_url, default_price })
    .select()
    .single();

  if (error) {
    // Unique violation: another save won the race for this item_number —
    // reuse its row instead of failing the whole save.
    if (error.code === "23505" && normNumber) {
      const { data: winner } = await supabase
        .from("catalog_items")
        .select("*")
        .ilike("item_number", item_number.trim())
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (winner) return winner;
    }
    throw error;
  }
  return created;
}
