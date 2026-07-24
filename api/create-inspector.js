const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("URL:", !!supabaseUrl, "Key:", !!supabaseServiceKey);

    if (!supabaseUrl) return res.status(500).json({ error: "Missing VITE_SUPABASE_URL" });
    if (!supabaseServiceKey) return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" });

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

    if (createError) {
      console.error("Create error:", createError);
      throw new Error(createError.message || JSON.stringify(createError));
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, role: "inspector" })
      .eq("id", data.user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(updateError.message || JSON.stringify(updateError));
    }

    return res.status(200).json({
      success: true,
      message: "Inspector created successfully",
      user: { id: data.user.id, email },
    });
  } catch (error) {
    console.error("Handler error:", error.message, error.stack);
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
};
