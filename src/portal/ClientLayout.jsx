import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Outlet, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useClientPortal } from "./ClientPortalContext";
import interasiaLogo from "../assets/images/logo/interasialogo.png";
import { ROLE_LABEL } from "./permissions";

const NAV = [
  {
    to: "/clientes",
    end: true,
    label: "Inicio",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: "/clientes/envios",
    perm: "envios",
    label: "Mis Envíos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    to: "/clientes/ordenes",
    perm: "ordenes",
    label: "Mis Órdenes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: "/clientes/pedidos",
    perm: "pedidos",
    label: "Subir pedido",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    to: "/clientes/consultas",
    perm: "consultas",
    label: "Consultas",
    badge: "cases",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    to: "/clientes/proveedores",
    perm: "proveedores",
    label: "Proveedores",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    to: "/clientes/garantias",
    perm: "garantias",
    label: "Garantías",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    to: "/clientes/documentos",
    perm: "documentos",
    label: "Documentos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/clientes/reportes",
    perm: "reportes",
    label: "Reportes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: "/clientes/asistente",
    perm: "asistente",
    label: "Asistente de Importación",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/clientes/cotizaciones-ia",
    perm: "cotizaciones_ia",
    label: "Consultar Cotizaciones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

// Sidebar sections (order is fixed; items inside keep the NAV order above).
const GROUPS = [
  { label: "Principal", to: ["/clientes", "/clientes/ordenes", "/clientes/envios", "/clientes/pedidos"] },
  { label: "Atención", to: ["/clientes/consultas", "/clientes/garantias", "/clientes/proveedores"] },
  { label: "Archivo", to: ["/clientes/documentos", "/clientes/reportes"] },
  { label: "Herramientas", to: ["/clientes/asistente", "/clientes/cotizaciones-ia"] },
];

function NavItem({ item, onClick, badge }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all ${
          isActive
            ? "bg-white/10 text-white shadow-inner shadow-white/5"
            : "text-blue-100/70 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-blue-400 transition-all ${isActive ? "h-6 opacity-100" : "h-0 opacity-0"}`} />
          <span className={`flex-shrink-0 transition-colors ${isActive ? "text-blue-300" : "text-blue-200/50 group-hover:text-blue-200"}`}>{item.icon}</span>
          <span className="flex-1 truncate">{item.label}</span>
          {badge > 0 && <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm shadow-rose-900/40">{badge}</span>}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ nav, badges, onNavigate, userLabel, initials, subtitle, onLogout, clientName }) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-950 via-[#0f1b45] to-slate-950 text-white">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <img src={interasiaLogo} alt="Interasia" className="h-10 object-contain" />
        <p className="text-[10px] text-blue-300/80 mt-2.5 leading-tight font-semibold tracking-[0.18em] uppercase">Portal de Clientes</p>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {GROUPS.map(g => {
          const items = nav.filter(n => g.to.includes(n.to));
          if (!items.length) return null;
          return (
            <div key={g.label}>
              <p className="px-4 mb-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-blue-300/40">{g.label}</p>
              <div className="space-y-0.5">
                {items.map(item => <NavItem key={item.to} item={item} badge={badges[item.to] || 0} onClick={onNavigate} />)}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-md shadow-indigo-950/50">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userLabel}</p>
            <p className="text-[11px] text-blue-200/60 truncate">{subtitle}</p>
          </div>
          <button onClick={onLogout} title="Cerrar sesión"
            className="p-2 rounded-lg text-blue-200/60 hover:bg-rose-500/20 hover:text-rose-300 transition flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientLayout() {
  const { session, logout, me, can } = useClientPortal();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadDocs, setUnreadDocs] = useState(0);
  const [unreadCases, setUnreadCases] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!session?.session_id) return;
    supabase.rpc("client_portal_get_client_orders", { p_session_id: session.session_id })
      .then(({ data }) => setUnread((data || []).filter(o => o.unread).length));
    // the Documentos page marks them seen when it loads, so this is read before that on navigation
    supabase.rpc("client_portal_documents_unread", { p_session_id: session.session_id })
      .then(({ data }) => setUnreadDocs(location.pathname.endsWith("/documentos") ? 0 : (data || 0)));
    supabase.rpc("client_portal_cases_unread", { p_session_id: session.session_id })
      .then(({ data, error }) => setUnreadCases(error ? 0 : (data || 0)));
  }, [session?.session_id, location.pathname]);

  // close the mobile drawer when the page changes
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Only the modules this user may use; the page behind a hidden entry redirects home.
  const nav = NAV.filter(n => !n.perm || can(n.perm));
  const blocked = NAV.find(n => n.perm && !can(n.perm) && location.pathname.startsWith(n.to));
  const badges = { "/clientes/pedidos": unread, "/clientes/documentos": unreadDocs, "/clientes/consultas": unreadCases };

  function handleLogout() {
    logout();
    navigate("/clientes/login", { replace: true });
  }

  const userLabel = me?.name || session?.client_name;
  const initials = userLabel
    ? userLabel.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "?";
  const subtitle = `${me?.name ? `${session?.client_name} · ` : ""}${ROLE_LABEL[me?.role] || "Cliente"}`;
  const sidebarProps = { nav, badges, userLabel, initials, subtitle, onLogout: handleLogout, clientName: session?.client_name };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:block w-64 fixed left-0 top-0 bottom-0 z-10 shadow-xl shadow-slate-900/10">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Mobile header ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-blue-950 flex items-center justify-between px-4 py-3 shadow-md">
        <img src={interasiaLogo} alt="Interasia" className="h-8 object-contain" />
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl text-blue-100 hover:bg-white/10" aria-label="Abrir menú">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 h-full shadow-2xl">
            <SidebarContent {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 p-1.5 rounded-lg text-blue-200/70 hover:bg-white/10 hover:text-white" aria-label="Cerrar menú">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="portal-main flex-1 md:ml-64 pt-14 md:pt-0 min-h-screen min-w-0 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-900">
        {blocked ? <Navigate to="/clientes" replace /> : <Outlet />}
      </main>
    </div>
  );
}
