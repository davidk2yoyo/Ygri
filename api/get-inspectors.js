import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Missing Supabase environment variables" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "inspector")
      .order("full_name");

    if (error) throw new Error(error.message);

    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw new Error(usersError.message);

    const userMap = new Map(users.users.map(u => [u.id, u.email]));
    const inspectors = data.map(p => ({
      id: p.id,
      full_name: p.full_name,
      email: userMap.get(p.id) || "—",
    }));

    return res.status(200).json({ inspectors });
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
