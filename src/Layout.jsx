import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "./supabaseClient";
import { useDarkMode } from "./hooks/useDarkMode";
import logoShort from "./assets/images/logo/logo-short.png";
import YgriAiChat from "./pages/AiAssistantPage";
import { Toaster, sileo } from "sileo";
import "sileo/styles.css";

const MILESTONE_LABELS = {
  production_ready:   { emoji: "🏭", label: "Production Ready" },
  inspection:         { emoji: "🔍", label: "Inspection" },
  shipping_departure: { emoji: "🚢", label: "Departure" },
  estimated_arrival:  { emoji: "📦", label: "ETA / Arrival" },
  payment_balance:    { emoji: "💰", label: "Balance Payment" },
  client_delivery:    { emoji: "✅", label: "Client Delivery" },
  custom:             { emoji: "📌", label: "Custom" },
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, toggleDarkMode] = useDarkMode();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
        checkNotifications();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const today = new Date().toISOString().slice(0, 10);
      const key = `dismissed_notifs_${today}`;
      const dismissed = new Set(JSON.parse(localStorage.getItem(key) || "[]"));

      // Overdue tasks (due today or earlier)
      const { data: todos, error: todosErr } = await supabase
        .from("stage_todos")
        .select("id, title")
        .eq("is_done", false)
        .lte("due_date", today)
        .not("due_date", "is", null);

      if (todosErr) console.warn("Notification todos error:", todosErr.message);

      (todos || [])
        .filter(t => !dismissed.has(`todo_${t.id}`))
        .slice(0, 5)
        .forEach(todo => {
          const dismissTodo = (tid) => {
            const list = JSON.parse(localStorage.getItem(key) || "[]");
            list.push(`todo_${todo.id}`);
            localStorage.setItem(key, JSON.stringify(list));
            sileo.dismiss(tid);
          };

          let tid;
          tid = sileo.warning({
            title: "Overdue Task",
            description: (
              <div>
                <div className="text-sm font-medium mb-2">{todo.title}</div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await supabase.rpc("update_stage_todo", { p_todo_id: todo.id, p_done: true });
                      sileo.dismiss(tid);
                      sileo.success({ title: "Task done!", description: todo.title });
                    }}
                    className="flex-1 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition"
                  >
                    Mark Done
                  </button>
                  <button
                    onClick={() => dismissTodo(tid)}
                    className="flex-1 py-1 text-xs border border-amber-400 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ),
            duration: null,
          });
        });

      // Milestone reminders (only if reminder_days column exists)
      const { data: milestones, error: msErr } = await supabase
        .from("project_milestones")
        .select("id, type, label, date, reminder_days, track:tracks(name)")
        .not("reminder_days", "is", null)
        .gte("date", today);

      if (msErr) {
        console.warn("Milestone reminder query failed (reminder_days column may not exist yet):", msErr.message);
      } else {
        (milestones || [])
          .filter(m => {
            const daysUntil = Math.round(
              (new Date(m.date + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000
            );
            return daysUntil <= m.reminder_days && !dismissed.has(`milestone_${m.id}`);
          })
          .forEach(m => {
            const daysUntil = Math.round(
              (new Date(m.date + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000
            );
            const cfg = MILESTONE_LABELS[m.type] || MILESTONE_LABELS.custom;
            let mid;
            mid = sileo.info({
              title: `${cfg.emoji} ${m.label || cfg.label}`,
              description: `${m.track?.name || "Project"} · ${daysUntil === 0 ? "Today" : `in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`}`,
              duration: null,
              button: {
                title: "Dismiss",
                onClick: () => {
                  const list = JSON.parse(localStorage.getItem(key) || "[]");
                  list.push(`milestone_${m.id}`);
                  localStorage.setItem(key, JSON.stringify(list));
                  sileo.dismiss(mid);
                },
              },
            });
          });
      }
    } catch (e) {
      console.error("checkNotifications error:", e);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navItems = [
    { 
      path: "/dashboard", 
      label: t("dashboard"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2h-4a2 2 0 01-2-2v0zM8 11h8M8 15h5" />
        </svg>
      )
    },
    { 
      path: "/map", 
      label: t("map"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    { 
      path: "/projects", 
      label: t("projects"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      path: "/clients", 
      label: t("clients"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    { 
      path: "/files", 
      label: t("files"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      path: "/invoices",
      label: "Invoices",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      )
    },
    {
      path: "/items",
      label: "Items",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      path: "/reports",
      label: "Reports",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      path: "/shipments",
      label: "Shipments",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    },
    {
      path: "/suppliers",
      label: "Suppliers",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      path: "/tasks",
      label: "Tasks",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      path: "/calendar",
      label: "Calendar",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      path: "/emails",
      label: "Emails",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      path: "/settings",
      label: t("settings"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  return (
    <div className="flex min-h-screen bg-[#f8f9fb] dark:bg-gray-950 font-urbanist">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-white dark:bg-gray-900 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-gray-100 dark:border-white/5 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)]`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <img
              src={logoShort}
              alt="Ygri CRM"
              className="h-7 w-auto"
            />
            <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{t("appName")}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-gray-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="mb-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-4 mb-2">
              {t("menu")}
            </p>
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={isActive ? 'nav-item-active' : 'nav-item'}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* User Section */}
        <div className="flex-shrink-0 p-3 border-t border-gray-100 dark:border-white/5">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all duration-200 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{t("signOut")}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'} flex flex-col min-h-screen`}>
        {/* Top Bar */}
        <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 lg:hidden transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden lg:block">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>

          {/* Right side - Language toggle, Dark mode toggle and user */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors text-xs font-semibold tracking-wide"
              title={`${i18n.language === 'en' ? 'Español' : 'English'}`}
            >
              {i18n.language === 'en' ? 'ES' : 'EN'}
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors"
              title={t("switchToMode", { mode: t(darkMode ? "lightMode" : "darkMode") })}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center ring-2 ring-green-200 dark:ring-green-500/30 shadow-sm">
              <span className="text-white text-xs font-bold">U</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      <YgriAiChat />
      <Toaster position="bottom-right" />
    </div>
  );
}