// Lightweight — needed the moment a question isn't project-scoped
// ("what's happening with GTA Chile"). Copilot Blueprint §D.
export async function buildClientContext(supabase, clientId) {
  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name, contact_person, email, phone, country, city, last_email_at, email_thread_count")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;

  const [{ data: tracks }, { data: emailThreads }] = await Promise.all([
    supabase.from("tracks").select("id, name, status, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("email_threads").select("subject, needs_response, priority, last_received_at").eq("client_id", clientId).order("last_received_at", { ascending: false }).limit(5),
  ]);

  const trackIds = (tracks || []).map((t) => t.id);
  const { data: quotations } = trackIds.length
    ? await supabase.from("quotations").select("id, quote_number, document_type, total_amount, currency, created_at, track_id").in("track_id", trackIds).order("created_at", { ascending: false })
    : { data: [] };

  return {
    client: {
      id: client.id,
      name: client.company_name,
      contact_person: client.contact_person,
      email: client.email,
      phone: client.phone,
      location: [client.city, client.country].filter(Boolean).join(", ") || null,
      last_email_at: client.last_email_at,
    },
    projects: (tracks || []).map((t) => ({ id: t.id, name: t.name, status: t.status })),
    active_project_count: (tracks || []).filter((t) => t.status === "active").length,
    recent_quotations: (quotations || []).slice(0, 5),
    recent_email_threads: emailThreads || [],
  };
}
