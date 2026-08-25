import { createClient } from "@supabase/supabase-js";

// Server-side Supabase access for the Copilot. Deliberately separate from
// src/supabaseClient.js, which reads import.meta.env — that only exists
// inside Vite's browser bundle, not in a Vercel serverless function.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Authenticates the caller from the Authorization header and returns a
// Supabase client scoped to THAT user's own JWT — never service_role.
// Every Copilot read and write executes through this client, so it is
// bound by whatever RLS already applies to that user, exactly as if they
// had clicked the equivalent button in the UI themselves.
export async function authenticateRequest(req) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new HttpError(500, "Supabase environment variables are not configured on the server");
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw new HttpError(401, "Missing Authorization header");
  }

  // A plain client, used only to resolve which user this token belongs to.
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    throw new HttpError(401, "Invalid or expired session");
  }

  // The client every tool/context provider actually queries through —
  // anon key + the caller's own access token forwarded as the request's
  // Authorization header, so PostgREST/RLS resolves auth.uid() as this user.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await userClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    userId: data.user.id,
    email: data.user.email,
    role: profile?.role || "staff",
    fullName: profile?.full_name || null,
    supabase: userClient,
  };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (!(err instanceof HttpError)) console.error("[ai-copilot]", err);
  res.status(status).json({ error: err.message || "Internal error" });
}
