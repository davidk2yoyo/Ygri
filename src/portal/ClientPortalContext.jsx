import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

const SESSION_KEY = "client_portal_session";

const ClientPortalContext = createContext(null);

export function ClientPortalProvider({ children }) {
  const [session, setSession] = useState(null); // { session_id, client_id, client_name }
  const [loading, setLoading] = useState(true);

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
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
    setSession(s);
    return s;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <ClientPortalContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal() {
  return useContext(ClientPortalContext);
}
