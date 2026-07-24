import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { inspectorId } = req.body;

  if (!inspectorId) {
    return res.status(400).json({ error: "Missing inspectorId" });
  }

  try {
    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(inspectorId);
    if (authError) throw authError;

    // Profile will be cascade-deleted if properly configured
    res.status(200).json({ success: true, message: "Inspector deleted successfully" });
  } catch (error) {
    console.error("Error deleting inspector:", error);
    res.status(500).json({ error: error.message });
  }
}
