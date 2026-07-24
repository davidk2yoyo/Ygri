import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email: user_id")
      .eq("role", "inspector")
      .order("full_name");

    if (error) throw error;

    // Get auth users to fetch emails
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const userMap = Object.fromEntries(users.users.map(u => [u.id, u.email]));
    const inspectors = data.map(p => ({
      ...p,
      email: userMap[p.id] || "—",
    }));

    res.status(200).json({ inspectors });
  } catch (error) {
    console.error("Error fetching inspectors:", error);
    res.status(500).json({ error: error.message });
  }
}
