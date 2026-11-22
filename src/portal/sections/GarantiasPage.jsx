import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import ClaimItemsEditor, { emptyItem } from "../../components/warranty/ClaimItemsEditor";
import { MediaThumbs, VerdictBadge, inputCls, labelCls } from "../../components/warranty/WarrantyBits";
import { CLAIM_STATUS, RESOLUTION_LABEL, fmtDay } from "../../lib/warranty";

export default function GarantiasPage() {
  const { session } = useClientPortal();
  const sid = session.session_id;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null); // { id|null, track_id, notes, received, items }
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc("client_portal_get_warranties", { p_session_id: sid });
    if (e) { setError(e.message?.includes("does not exist") ? "El módulo de garantías aún no está activo." : e.message); setData({ claims: [], rules: [], orders: [] }); return; }
    setData(d || { claims: [], rules: [], orders: [] });
  }, [sid]);
  useEffect(() => { load(); }, [load]);

  const startNew = () => setEditor({ id: null, track_id: "", notes: "", received: "", items: [] });
  const startEdit = (c) => setEditor({
    id: c.id, track_id: c.track_id || "", notes: c.client_notes || "", received: "",
    items: c.items.map(i => emptyItem({ ...i, received_at: i.received_at || "", complaint_date: "" })),
  });

  async function save() {
    setError("");
    const items = editor.items.filter(i => (i.product_name || "").trim() || (i.problem || "").trim());
    if (!items.length) { setError("Agrega al menos un producto."); return; }
    if (items.some(i => !(i.product_name || "").trim() || !(i.problem || "").trim())) { setError("Cada producto necesita nombre y problema."); return; }
    setBusy(true);
    const { error: e } = await supabase.rpc("client_portal_save_warranty_claim", {
      p_session_id: sid, p_claim_id: editor.id, p_track_id: editor.track_id || null, p_notes: editor.notes || null,
      p_items: items.map(i => ({ ...i, received_at: i.received_at || null, complaint_date: null })),
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setEditor(null); load();
  }

  async function del(c) {
    if (!window.confirm(`¿Borrar el reclamo ${c.claim_number}?`)) return;
    const { error: e } = await supabase.rpc("client_portal_delete_warranty_claim", { p_session_id: sid, p_claim_id: c.id });
    if (e) setError(e.message); else load();
  }

  if (!data) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  const rules = data.rules || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Garantías</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reporta productos con problemas y sigue el estado de cada reclamo.</p>
        </div>
        {!editor && <button onClick={startNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Nuevo reclamo</button>}
      </div>

      {error && <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}

      {editor && (
        <div className="mb-6 border border-gray-200 rounded-2xl p-4 bg-gray-50 space-y-4">
          <p className="text-sm font-bold text-gray-900">{editor.id ? "Editar reclamo" : "Nuevo reclamo"}</p>
          <div className="grid md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Orden</label>
              <select className={inputCls} value={editor.track_id} onChange={e => setEditor({ ...editor, track_id: e.target.value })}>
                <option value="">Sin orden específica</option>
                {(data.orders || []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Pedido recibido el</label>
              <input type="date" className={inputCls} value={editor.received}
                onChange={e => setEditor({ ...editor, received: e.target.value, items: editor.items.map(i => ({ ...i, received_at: e.target.value })) })} />
              <p className="text-[11px] text-gray-500 mt-1">Desde esta fecha corre la garantía. Se aplica a todos los productos.</p>
            </div>
            <div><label className={labelCls}>Notas</label><input className={inputCls} value={editor.notes} onChange={e => setEditor({ ...editor, notes: e.target.value })} placeholder="Opcional" /></div>
          </div>
          <ClaimItemsEditor items={editor.items} setItems={items => setEditor({ ...editor, items })} rules={rules} defaultReceived={editor.received} />
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">{busy ? "Enviando…" : editor.id ? "Guardar cambios" : "Enviar reclamo"}</button>
            <button onClick={() => setEditor(null)} disabled={busy} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-white">Cancelar</button>
          </div>
        </div>
      )}

      {data.claims.length === 0 && !editor ? (
        <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-300 rounded-2xl">Aún no has enviado reclamos de garantía.</div>
      ) : (
        <div className="space-y-3">
          {data.claims.map(c => {
            const st = CLAIM_STATUS[c.status] || CLAIM_STATUS.open;
            const isOpen = open === c.id;
            return (
              <div key={c.id} className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : c.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">{c.claim_number} <span className="font-normal text-gray-500">· {c.track_name || "Sin orden"}</span></p>
                    <p className="text-xs text-gray-500">{fmtDay(c.created_at)} · {c.items.length} producto(s){c.created_by_type === "staff" ? " · creado por Ygri" : ""}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  <span className="text-gray-400">{isOpen ? "▾" : "▸"}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    {c.client_notes && <p className="text-sm text-gray-600">{c.client_notes}</p>}
                    {c.items.map(i => (
                      <div key={i.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{i.product_name} <span className="text-gray-500 font-normal">× {i.qty}</span></p>
                            <p className="text-xs text-gray-500">{[i.brand, i.client_model, i.supplier_model && `Prov: ${i.supplier_model}`].filter(Boolean).join(" · ")}</p>
                            <p className="text-sm text-gray-700 mt-1">{i.problem}</p>
                          </div>
                          <VerdictBadge item={i} rules={rules} withNote />
                        </div>
                        <MediaThumbs media={i.media || []} />
                        {(i.supplier_answer || i.resolution) && (
                          <div className="text-sm bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                            {i.resolution && <p className="font-semibold text-green-800">{RESOLUTION_LABEL[i.resolution]}</p>}
                            {i.supplier_answer && <p className="text-green-900">{i.supplier_answer}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                    {c.status === "open" && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => startEdit(c)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">Editar</button>
                        <button onClick={() => del(c)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Borrar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
