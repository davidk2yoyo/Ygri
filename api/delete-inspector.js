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

    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { inspectorId } = req.body;

    if (!inspectorId) {
      return res.status(400).json({ error: "Missing inspectorId" });
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(inspectorId);
    if (authError) throw new Error(authError.message);

    return res.status(200).json({ success: true, message: "Inspector deleted successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
