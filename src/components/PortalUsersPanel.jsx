import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { PERMISSIONS, ROLES, ROLE_LABEL, normalizePerms } from "../portal/permissions";

// Staff-side management of a client company's portal logins: one login per person, each with a role
// (a preset) and individual permissions. "Ver precios" is enforced by the database.

const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";
const labelCls = "block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide";

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "never";

function UserForm({ clientId, user, onDone, onCancel }) {
  const editing = !!user;
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "bodega");
  const [perms, setPerms] = useState(() => normalizePerms(user ? (user.role === "admin" ? ROLES.admin.perms : user.permissions) : ROLES.bodega.perms));
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickRole = (r) => { setRole(r); if (r !== "custom") setPerms(normalizePerms(ROLES[r].perms)); };
  const toggle = (key) => {
    const next = normalizePerms({ ...perms, [key]: !perms[key] });
    setPerms(next);
    // changing a single switch means it no longer matches the preset
    if (role !== "custom") setRole("custom");
  };

  async function save() {
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!editing && password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (editing && password && password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    const { error: err } = await supabase.rpc("admin_save_client_portal_user", {
      p_client_id: clientId, p_user_id: user?.id || null, p_email: email.trim(), p_password: password || null,
      p_name: name.trim() || null, p_role: role, p_permissions: normalizePerms(perms), p_active: active,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  const isAdmin = role === "admin";
  return (
    <div className="border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4 space-y-4 bg-bgray-50/60 dark:bg-darkblack-500">
      <p className="text-sm font-bold text-darkblack-700 dark:text-white">{editing ? "Edit user" : "New user"}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={labelCls}>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Juan Pérez (bodega)" className={inputCls} /></div>
        <div><label className={labelCls}>Login email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{editing ? "New password (leave empty to keep the current one)" : "Password"}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Role</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(ROLES).map(([k, r]) => (
            <button key={k} type="button" onClick={() => pickRole(k)}
              className={`text-left px-3 py-2 rounded-lg border text-xs transition ${role === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-bgray-200 dark:border-darkblack-400 hover:border-bgray-400"}`}>
              <span className="block font-semibold text-darkblack-700 dark:text-white">{r.label}</span>
              <span className="block text-bgray-500 mt-0.5">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>What this user sees</label>
        <div className="space-y-1.5">
          {PERMISSIONS.map(p => {
            const locked = p.key === "cotizaciones_ia" && !perms.prices;
            return (
              <label key={p.key} className={`flex items-start gap-2.5 text-sm ${isAdmin || locked ? "opacity-60" : "cursor-pointer"}`}>
                <input type="checkbox" className="mt-0.5" checked={isAdmin ? true : !!perms[p.key]} disabled={isAdmin || locked} onChange={() => toggle(p.key)} />
                <span>
                  <span className={`font-medium ${p.key === "prices" ? "text-violet-700 dark:text-violet-300" : "text-darkblack-700 dark:text-white"}`}>{p.label}</span>
                  <span className="block text-xs text-bgray-500">{p.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {!perms.prices && !isAdmin && (
          <p className="mt-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
            Without “Ver precios” this user never receives amounts: the quotations tab, payments, the quotation Excel and documents marked “Commercial only” are all withheld by the server.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
        <span className="text-darkblack-700 dark:text-white">Active</span>
        <span className="text-xs text-bgray-500">— uncheck to block this login without deleting it</span>
      </label>

      {error && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">{busy ? "Saving..." : editing ? "Save changes" : "Create user"}</button>
        <button onClick={onCancel} disabled={busy} className="px-4 py-2.5 text-sm text-bgray-600 rounded-lg border border-bgray-200 dark:border-darkblack-400 hover:bg-bgray-100">Cancel</button>
      </div>
    </div>
  );
}

export default function PortalUsersPanel({ client }) {
  const [users, setUsers] = useState(null);
  const [editing, setEditing] = useState(null); // user object, "new", or null
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("admin_list_client_portal_users", { p_client_id: client.id });
    if (err) { setError(err.message.includes("does not exist") ? "Apply the migration 2026-11-21_supabase-portal-roles.sql in Supabase first." : err.message); setUsers([]); return; }
    setError(""); setUsers(data || []);
  }, [client.id]);
  useEffect(() => { load(); }, [load]);

  async function remove(u) {
    if (!window.confirm(`Delete the portal login ${u.email}?`)) return;
    const { error: err } = await supabase.rpc("admin_delete_client_portal_user", { p_user_id: u.id });
    if (err) { setError(err.message); return; }
    load();
  }

  const summary = (u) => {
    if (u.role === "admin") return "Everything, including prices";
    const p = normalizePerms(u.permissions);
    const on = PERMISSIONS.filter(x => p[x.key] && x.key !== "prices" && x.key !== "cotizaciones_ia").map(x => x.label);
    return [p.prices ? "Prices" : "No prices", ...on, p.cotizaciones_ia ? "Quotations AI" : null].filter(Boolean).join(" · ");
  };

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-darkblack-700 dark:text-white">Client portal users</h3>
          <p className="text-sm text-bgray-500 mt-0.5">One login per person at {client.company_name}. They sign in at <span className="font-mono">/clientes/login</span>; the role decides what each one sees — for example warehouse staff without prices.</p>
        </div>
        {editing === null && (
          <button onClick={() => setEditing("new")} className="flex-shrink-0 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition">+ Add user</button>
        )}
      </div>

      {error && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}

      {editing && <UserForm clientId={client.id} user={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}

      {users === null ? <p className="text-sm text-bgray-400">Loading…</p>
        : users.length === 0 && !error ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-bgray-50 dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-bgray-400" />
            <span className="text-sm text-bgray-600 dark:text-bgray-300">No portal access yet</span>
          </div>
        ) : (
          <div className="divide-y divide-bgray-100 dark:divide-darkblack-400 border border-bgray-200 dark:border-darkblack-400 rounded-xl">
            {users.map(u => (
              <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${u.active ? "" : "opacity-60"}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.active ? "bg-green-500" : "bg-bgray-300"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-darkblack-700 dark:text-white truncate">
                    {u.name || u.email}
                    <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${u.role === "bodega" || u.role === "disenos" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>{ROLE_LABEL[u.role] || u.role}</span>
                    {!u.active && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-bgray-200 text-bgray-600">BLOCKED</span>}
                  </p>
                  <p className="text-xs text-bgray-500 truncate">{u.name ? `${u.email} · ` : ""}{summary(u)} · last login {fmtDate(u.last_login)}</p>
                </div>
                <button onClick={() => setEditing(u)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-bgray-200 dark:border-darkblack-400 hover:bg-bgray-100">Edit</button>
                <button onClick={() => remove(u)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" title="Delete">🗑</button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
