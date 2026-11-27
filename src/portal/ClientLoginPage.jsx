import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClientPortal } from "./ClientPortalContext";
import interasiaLogo from "../assets/images/logo/interasialogo.png";

export default function ClientLoginPage() {
  const { login, session } = useClientPortal();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already logged in
  if (session) {
    navigate("/clientes", { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/clientes", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const features = [
    "Seguimiento de tus órdenes y envíos en tiempo real",
    "Cotizaciones, facturas y packing lists en un solo lugar",
    "Consultas y garantías con respuesta de tu asesor",
  ];
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 text-white bg-gradient-to-br from-blue-950 via-[#0f1b45] to-slate-950">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute -left-20 bottom-0 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl" />
        <img src={interasiaLogo} alt="Interasia" className="relative h-12 object-contain object-left" />
        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-blue-300/80">Portal de Clientes</p>
          <h2 className="text-4xl font-bold tracking-tight leading-tight mt-3 max-w-md">Todo tu comercio con China, en un solo lugar.</h2>
          <ul className="mt-8 space-y-3.5 max-w-md">
            {features.map(f => (
              <li key={f} className="flex items-start gap-3 text-sm text-blue-100/85">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-400/20 text-blue-300 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-blue-200/50">© Interasia SAS (Hong Kong) Trade Company</p>
      </div>

      {/* Form */}
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8 -mx-6 -mt-6 px-6 py-6 bg-blue-950 rounded-b-3xl">
            <img src={interasiaLogo} alt="Interasia" className="h-11 mx-auto object-contain" />
          </div>
          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido de nuevo</h1>
            <p className="text-sm text-slate-500 mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            ¿Problemas para acceder? Contacta a tu asesor.
          </p>
        </div>
      </div>
    </div>
  );
}
