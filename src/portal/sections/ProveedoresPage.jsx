import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import { Attachments } from "../../components/cases/CaseThread";
import SupplierProfileView from "../../components/SupplierProfileView";
import { PROFILE_SECTIONS, SECTION_BY_KEY, overallRating, stars } from "../../lib/supplierProfile";

function Section({ def, row }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <h3 className="text-sm font-bold text-gray-900 mb-3">{def.icon} {def.label}</h3>
      <SupplierProfileView sectionKey={def.key} data={row.data} />
      {row.body && <div className="mt-4"><p className="text-xs text-gray-500">Notas</p><p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{row.body}</p></div>}
      <Attachments items={row.files || []} />
    </div>
  );
}

export default function ProveedoresPage() {
  const { session } = useClientPortal();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState(null);

  useEffect(() => {
    supabase.rpc("client_portal_get_suppliers", { p_session_id: session.session_id }).then(({ data, error: e }) => {
      if (e) { setError(e.message?.includes("does not exist") ? "Este módulo aún no está activo." : e.message); setList([]); return; }
      setList(data || []);
    });
  }, [session.session_id]);

  if (!list) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  const supplier = list.find(s => s.id === sel);

  if (supplier) {
    const keys = PROFILE_SECTIONS.filter(d => supplier.sections[d.key]);
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <button onClick={() => setSel(null)} className="text-sm text-blue-700 hover:underline">← Proveedores</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{supplier.name}</h1>
          <p className="text-sm text-gray-500">{[supplier.city, supplier.country].filter(Boolean).join(", ")}</p>
        </div>
        {keys.length === 0 ? <p className="text-sm text-gray-500">Aún no hay información publicada de este proveedor.</p>
          : keys.map(d => <Section key={d.key} def={d} row={supplier.sections[d.key]} />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Proveedores</h1>
        <p className="text-sm text-gray-500 mt-0.5">La hoja de vida de los proveedores con los que trabajamos para ti.</p>
      </div>
      {error && <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}
      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-300 rounded-2xl">Aún no hay proveedores publicados para ti.</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {list.map(s => {
            const overall = overallRating(s.sections.calificacion?.data);
            return (
              <button key={s.id} onClick={() => setSel(s.id)} className="text-left border border-gray-200 rounded-2xl p-4 bg-white hover:shadow-md hover:border-blue-300 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{[s.city, s.country].filter(Boolean).join(", ")}</p>
                  </div>
                  {overall != null && <span className="text-sm text-amber-500 whitespace-nowrap">{stars(overall)}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {PROFILE_SECTIONS.filter(d => s.sections[d.key]).map(d => (
                    <span key={d.key} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{SECTION_BY_KEY[d.key].icon} {SECTION_BY_KEY[d.key].label}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
