module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error("Missing VITE_SUPABASE_URL");
      return res.status(500).json({ error: "Missing VITE_SUPABASE_URL" });
    }
    if (!supabaseServiceKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "inspector")
      .order("full_name");

    if (error) throw new Error(error.message || JSON.stringify(error));

    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw new Error(usersError.message || JSON.stringify(usersError));

    const userMap = new Map(users.users.map(u => [u.id, u.email]));
    const inspectors = data.map(p => ({
      id: p.id,
      full_name: p.full_name,
      email: userMap.get(p.id) || "—",
    }));

    return res.status(200).json({ inspectors });
  } catch (error) {
    console.error("Error:", error.message, error.stack);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
