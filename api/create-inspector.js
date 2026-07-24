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

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Missing email, password, or fullName" });
    }

    const { data, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw new Error(createError.message || JSON.stringify(createError));

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, role: "inspector" })
      .eq("id", data.user.id);

    if (updateError) throw new Error(updateError.message || JSON.stringify(updateError));

    return res.status(200).json({
      success: true,
      message: "Inspector created successfully",
      user: { id: data.user.id, email },
    });
  } catch (error) {
    console.error("Error:", error.message, error.stack);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
