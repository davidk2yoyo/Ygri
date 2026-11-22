import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import CaseThread, { AttachPicker } from "../../components/cases/CaseThread";
import CaseLinkFields from "../../components/cases/CaseLinkFields";
import { CASE_KIND, CASE_STATUS, APPROVAL, fmtDateTime } from "../../lib/cases";

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400";
const labelCls = "block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide";
const blankForm = { kind: "technical", subject: "", body: "", track_id: "", product_name: "", product_ref: "", attachments: [] };

export default function ConsultasPage() {
  const { session } = useClientPortal();
  const sid = session.session_id;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const [edit, setEdit] = useState(null); // { id, subject, track_id, product_name, product_ref }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc("client_portal_get_cases", { p_session_id: sid });
    if (e) { setError(e.message?.includes("does not exist") ? "Este módulo aún no está activo." : e.message); setData({ cases: [], orders: [], products: [] }); return; }
    setData(d || { cases: [], orders: [], products: [] });
  }, [sid]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (c) => {
    const next = open === c.id ? null : c.id;
    setOpen(next); setEdit(null);
    if (next && c.unread) { await supabase.rpc("client_portal_mark_case_seen", { p_session_id: sid, p_case_id: c.id }); load(); }
  };

  async function create() {
    setError("");
    if (!form.subject.trim() || !form.body.trim()) { setError("Escribe un asunto y tu mensaje."); return; }
    setBusy(true);
    const { data: id, error: e } = await supabase.rpc("client_portal_create_case", {
      p_session_id: sid, p_kind: form.kind, p_subject: form.subject, p_body: form.body, p_track_id: form.track_id || null,
      p_attachments: form.attachments, p_product_name: form.product_name || null, p_product_ref: form.product_ref || null,
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setForm(null); await load(); setOpen(id);
  }

  async function saveEdit() {
    setError("");
    if (!edit.subject.trim()) { setError("El asunto no puede estar vacío."); return; }
    setBusy(true);
    const { error: e } = await supabase.rpc("client_portal_update_case", {
      p_session_id: sid, p_case_id: edit.id, p_subject: edit.subject, p_track_id: edit.track_id || null,
      p_product_name: edit.product_name || null, p_product_ref: edit.product_ref || null,
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setEdit(null); load();
  }

  if (!data) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  const orders = data.orders || [], products = data.products || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Consultas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Preguntas técnicas, fichas técnicas, aprobación de diseños y comentarios. Todo queda registrado con fecha y autor.</p>
        </div>
        {!form && <button onClick={() => setForm({ ...blankForm })} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Nueva consulta</button>}
      </div>

      {error && <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{error}</div>}

      {form && (
        <div className="mb-6 border border-gray-200 rounded-2xl p-4 bg-gray-50 space-y-3">
          <p className="text-sm font-bold text-gray-900">Nueva consulta</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CASE_KIND).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.kind === k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{v.icon} {v.label}</button>
            ))}
          </div>
          <div><label className={labelCls}>Asunto *</label><input className={inputCls} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Ej. Voltaje del modelo GCJ4204" /></div>
          <CaseLinkFields value={form} onChange={v => setForm({ ...form, ...v })} orders={orders} products={products} />
          <div><label className={labelCls}>Mensaje *</label><textarea rows={4} className={inputCls} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
          <AttachPicker value={form.attachments} onChange={a => setForm({ ...form, attachments: a })} disabled={busy} />
          <div className="flex gap-2">
            <button onClick={create} disabled={busy} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">{busy ? "Enviando…" : "Enviar"}</button>
            <button onClick={() => setForm(null)} disabled={busy} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-white">Cancelar</button>
          </div>
        </div>
      )}

      {data.cases.length === 0 && !form ? (
        <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-300 rounded-2xl">Aún no tienes consultas.</div>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Registro de consultas ({data.cases.length})</p>
          <div className="space-y-3">
            {data.cases.map(c => {
              const k = CASE_KIND[c.kind] || CASE_KIND.question;
              const st = c.status === "closed" ? CASE_STATUS.closed : c.status === "answered" ? { short: "Respondido", cls: "bg-green-100 text-green-700" } : { short: "Enviado", cls: "bg-blue-100 text-blue-700" };
              const about = [c.track_name && `Orden: ${c.track_name}`, c.product_name && `Producto: ${c.product_name}${c.product_ref ? ` (${c.product_ref})` : ""}`].filter(Boolean).join(" · ");
              return (
                <div key={c.id} className={`border rounded-2xl bg-white overflow-hidden ${c.unread ? "border-blue-300" : "border-gray-200"}`}>
                  <button onClick={() => toggle(c)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${k.cls}`}>{k.icon} {k.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{c.subject}{c.unread && <span className="ml-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full">Nueva respuesta</span>}</p>
                      <p className="text-xs text-gray-500 truncate">{c.case_number} · {fmtDateTime(c.created_at)} · por {c.created_by_type === "staff" ? "Ygri" : (c.created_by_name || "—")}</p>
                      {about && <p className="text-xs text-gray-500 truncate">{about}</p>}
                    </div>
                    {c.approval === "pending" && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${APPROVAL.pending.cls}`}>Aprobación pendiente</span>}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.short}</span>
                  </button>
                  {open === c.id && (
                    <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                      {edit?.id === c.id ? (
                        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
                          <div><label className={labelCls}>Asunto</label><input className={inputCls} value={edit.subject} onChange={e => setEdit({ ...edit, subject: e.target.value })} /></div>
                          <CaseLinkFields value={edit} onChange={v => setEdit({ ...edit, ...v })} orders={orders} products={products} />
                          <div className="flex gap-2">
                            <button onClick={saveEdit} disabled={busy} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">Guardar</button>
                            <button onClick={() => setEdit(null)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setEdit({ id: c.id, subject: c.subject, track_id: c.track_id || "", product_name: c.product_name || "", product_ref: c.product_ref || "" })}
                          className="text-xs font-medium text-blue-700 hover:underline">✏️ Editar asunto, orden o producto</button>
                      )}
                      <CaseThread messages={c.messages} approval={c.approval} closed={c.status === "closed"}
                        onSend={async ({ body, attachments }) => {
                          const { error: e } = await supabase.rpc("client_portal_reply_case", { p_session_id: sid, p_case_id: c.id, p_body: body, p_attachments: attachments });
                          if (e) throw e; await load();
                        }}
                        onDecide={async (decision, note) => {
                          const { error: e } = await supabase.rpc("client_portal_decide_case", { p_session_id: sid, p_case_id: c.id, p_decision: decision, p_note: note });
                          if (e) throw e; await load();
                        }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
