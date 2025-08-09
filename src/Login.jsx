// src/Login.jsx
import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup' | 'magic'
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        setMsg("Magic link sent! Check your email.");
        return;
      }
      if (!email || !pw) {
        setMsg("Email and password are required.");
        return;
      }
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg("Signup success. Check your email to confirm, then sign in.");
      }
    } catch (err) {
      setMsg(err.message || "Auth error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-4 text-center">Sign in to Ygri</h1>

        <div className="flex gap-2 text-sm mb-4">
          <button
            className={`flex-1 py-2 rounded-lg border ${mode === "signin" ? "bg-blue-50 border-blue-300" : "bg-white"}`}
            onClick={() => setMode("signin")}
          >
            Email & Password
          </button>
          <button
            className={`flex-1 py-2 rounded-lg border ${mode === "magic" ? "bg-blue-50 border-blue-300" : "bg-white"}`}
            onClick={() => setMode("magic")}
          >
            Magic Link
          </button>
          <button
            className={`flex-1 py-2 rounded-lg border ${mode === "signup" ? "bg-blue-50 border-blue-300" : "bg-white"}`}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border"
            required
          />
          {mode !== "magic" && (
            <input
              type="password"
              placeholder="••••••••"
              value={pw}
              onChange={e => setPw(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border"
              required
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Magic Link"}
          </button>
        </form>

        {msg && (
          <div className={`mt-3 text-sm text-center ${
            msg.includes("success") || msg.includes("sent") ? "text-green-600" : 
            msg.includes("error") || msg.includes("Error") ? "text-red-600" : "text-slate-700"
          }`}>
            {msg}
          </div>
        )}
        <p className="text-xs text-center mt-4 text-slate-500">By continuing you agree to our terms.</p>
      </div>
    </div>
  );
}
