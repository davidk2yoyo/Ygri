import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "Missing email, password, or fullName" });
  }

  try {
    // Create user with admin API
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw createError;

    // Update profile with full_name and role
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, role: "inspector" })
      .eq("id", data.user.id);

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: "Inspector created successfully",
      user: { id: data.user.id, email },
    });
  } catch (error) {
    console.error("Error creating inspector:", error);
    res.status(500).json({ error: error.message });
  }
}
