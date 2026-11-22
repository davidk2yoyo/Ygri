import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { ALL_KEYS, normalizePerms } from "./permissions";

const SESSION_KEY = "client_portal_session";

const ClientPortalContext = createContext(null);

export function ClientPortalProvider({ children }) {
  const [session, setSession] = useState(null); // { session_id, client_id, client_name }
  const [loading, setLoading] = useState(true);
  // who is signed in + what they may see: { user_id, name, email, role, permissions }
  const [me, setMe] = useState(null);

  // If the roles migration isn't applied yet the RPC doesn't exist: behave as before (everything allowed).
  const loadMe = useCallback(async (session_id) => {
    const { data, error } = await supabase.rpc("client_portal_get_me", { p_session_id: session_id });
    if (error || !data) {
      setMe({ role: "admin", name: null, permissions: normalizePerms(Object.fromEntries(ALL_KEYS.map(k => [k, true]))) });
    } else {
      setMe({ ...data, permissions: normalizePerms(data.permissions) });
    }
  }, []);

  const restore = useCallback(async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) { setLoading(false); return; }
    try {
      const { session_id } = JSON.parse(stored);
      const { data, error } = await supabase.rpc("client_portal_verify_session", { p_session_id: session_id });
      if (error || !data?.length) {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
      } else {
        setSession({ session_id, client_id: data[0].client_id, client_name: data[0].client_name });
        await loadMe(session_id);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [loadMe]);

  useEffect(() => { restore(); }, [restore]);

  const login = async (email, password) => {
    const { data, error } = await supabase.rpc("client_portal_login", {
      p_email: email,
      p_password: password,
    });
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Correo o contraseña incorrectos.");
    const row = data[0];
    const s = { session_id: row.session_id, client_id: row.client_id, client_name: row.client_name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    await loadMe(s.session_id);
    setSession(s);
    return s;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setMe(null);
  };

  const can = useCallback((key) => !!me?.permissions?.[key], [me]);

  return (
    <ClientPortalContext.Provider value={{ session, loading, login, logout, me, can }}>
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal() {
  return useContext(ClientPortalContext);
}
