const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "inspector")
      .order("full_name");

    if (error) throw new Error(error.message);

    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw new Error(usersError.message);

    const userMap = Object.fromEntries(users.users.map(u => [u.id, u.email]));
    const inspectors = data.map(p => ({
      ...p,
      email: userMap[p.id] || "—",
    }));

    return res.status(200).json({ inspectors });
  } catch (error) {
    console.error("Error fetching inspectors:", error);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
