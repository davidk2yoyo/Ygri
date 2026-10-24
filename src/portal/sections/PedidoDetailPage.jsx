import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import OrderLinesTable from "../../components/OrderLinesTable";
import { OrderHistoryButton } from "../../components/OrderEventLog";
import { diffLines, hasChanges, lineFromDb, lineProblems, lineToRpc, describeChanges, lineLabel } from "../../lib/orderDiff";
import { uploadPortalPhoto } from "../lib/uploadPortalPhoto";

const STATUS_LABEL = {
  submitted: ["Recibido", "bg-blue-100 text-blue-700"],
  in_review: ["En revisión", "bg-amber-100 text-amber-700"],
  draft: ["En revisión", "bg-amber-100 text-amber-700"],
  quoted: ["Cotización lista", "bg-green-100 text-green-700"],
  changes_requested: ["Cambios solicitados", "bg-amber-100 text-amber-700"],
  confirmed: ["Confirmado", "bg-green-100 text-green-700"],
  ordered: ["En compra", "bg-green-100 text-green-700"],
  closed: ["Cerrado", "bg-gray-100 text-gray-600"],
};
const CLIENT_EDITABLE = ["submitted", "in_review", "draft", "quoted", "changes_requested"];

const money = (n, cur = "USD") => `${cur} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// RPC line (portal shape) -> editable line
const toEditable = (l) => lineFromDb({
  id: l.id, sheet_name: l.sheet_name, supplier_name_raw: l.supplier, supplier_ref: l.supplier_ref, name: l.name,
  color: l.color, qty: l.qty, client_price: l.price, client_ref: l.client_ref, brand: l.brand, marking: l.marking,
  packaging: l.packaging, notes: l.notes, photo_url: l.photo_url,
});

export default function PedidoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useClientPortal();
  const [data, setData] = useState(null);
  const [lines, setLines] = useState([]);
  const [original, setOriginal] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc("client_portal_get_order", { p_session_id: session.session_id, p_order_id: id });
    if (e || !d) { setError(e?.message || "No encontramos este pedido."); setLoading(false); return; }
    setData(d);
    const ed = (d.lines || []).map(toEditable);
    setLines(ed); setOriginal(ed); setLoading(false);
  }, [id, session.session_id]);
  useEffect(() => { load(); }, [load]);

  // fetched once, independent of order reloads — this client's past items don't change mid-edit
  useEffect(() => {
    supabase.rpc("client_portal_get_my_items", { p_session_id: session.session_id })
      .then(({ data }) => setSuggestions(data || []));
  }, [session.session_id]);

  const order = data?.order;
  const editable = order && CLIENT_EDITABLE.includes(order.status);
  const diff = useMemo(() => diffLines(original, lines), [original, lines]);
  const dirty = hasChanges(diff);
  const problems = lines.filter(l => { const p = lineProblems(l); return p.id || p.qty; }).length;

  // last thing our team did that the client has not answered yet
  const staffNote = useMemo(() => {
    const ev = data?.events || [];
    const lastClient = ev.findIndex(e => e.actor_type === "client");
    const fresh = lastClient === -1 ? ev : ev.slice(0, lastClient);
    return fresh.find(e => e.actor_type === "staff");
  }, [data]);

  const run = async (fn, doneMsg) => {
    setBusy(true); setError(""); setOk("");
    try { await fn(); setNote(""); setOk(doneMsg); await load(); }
    catch (e) {
      const m = e.message || "No pudimos completar la acción.";
      setError(m.startsWith("conflict") ? "Nuestro equipo modificó este pedido mientras lo editabas. Recarga para ver los cambios y vuelve a aplicar los tuyos." : m);
    } finally { setBusy(false); }
  };

  // only while nobody on our side has picked it up (no quotation yet, early status)
  const deletable = order && !order.quotation_id && ["submitted", "in_review", "draft"].includes(order.status);
  const deleteOrder = async () => {
    if (!window.confirm("¿Borrar este pedido? Se eliminan sus productos y su historial. No se puede deshacer.")) return;
    setBusy(true); setError("");
    const { error: e } = await supabase.rpc("client_portal_delete_order", { p_session_id: session.session_id, p_order_id: id });
    setBusy(false);
    if (e) { setError(e.message); return; }
    navigate("/clientes/pedidos", { replace: true });
  };

  const startRenaming = () => {
    setTitleValue(order.reference || order.source_file_name || "");
    setRenamingTitle(true);
  };

  const commitRename = async () => {
    const trimmed = titleValue.trim();
    setRenamingTitle(false);
    const current = order.reference || order.source_file_name || "";
    if (trimmed === current) return;
    setError("");
    const { error: e } = await supabase.rpc("client_portal_rename_order", {
      p_session_id: session.session_id, p_order_id: id, p_reference: trimmed,
    });
    if (e) { setError(e.message); return; }
    await load();
  };

  const save = () => run(async () => {
    const { error: e } = await supabase.rpc("client_portal_update_order", {
      p_session_id: session.session_id, p_order_id: id, p_base_revision: order.revision,
      p_lines: lines.map(lineToRpc), p_changes: diff, p_note: note,
    });
    if (e) throw e;
  }, "Cambios guardados. Avisamos a nuestro equipo.");

  const comment = () => run(async () => {
    const { error: e } = await supabase.rpc("client_portal_add_comment", { p_session_id: session.session_id, p_order_id: id, p_note: note });
    if (e) throw e;
  }, "Comentario enviado.");

  const respond = (action) => run(async () => {
    const { error: e } = await supabase.rpc("client_portal_respond_order", { p_session_id: session.session_id, p_order_id: id, p_action: action, p_note: note });
    if (e) throw e;
  }, action === "accept" ? "Cotización aceptada. ¡Gracias!" : "Enviamos tus cambios a nuestro equipo.");

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  if (!order) return <div className="p-6"><p className="text-sm text-red-600">{error}</p><Link to="/clientes/pedidos" className="text-sm text-blue-600">← Mis pedidos</Link></div>;

  const [label, color] = STATUS_LABEL[order.status] || [order.status, "bg-gray-100 text-gray-600"];
  const offered = (data.lines || []).filter(l => l.offer);
  const quotation = data.quotation;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to="/clientes/pedidos" className="text-sm text-gray-500 hover:text-blue-600">← Mis pedidos</Link>
      <div className="flex items-start justify-between flex-wrap gap-3 mt-2 mb-5">
        <div>
          {renamingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenamingTitle(false);
              }}
              onBlur={commitRename}
              maxLength={200}
              placeholder="Nombre del pedido"
              className="text-xl font-bold text-gray-900 border-b-2 border-blue-600 bg-transparent focus:outline-none w-full max-w-sm"
            />
          ) : (
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              {order.reference || order.source_file_name || "Pedido"}
              <button onClick={startRenaming} title="Cambiar nombre del pedido" className="text-gray-300 hover:text-blue-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
                </svg>
              </button>
            </h1>
          )}
          <p className="text-sm text-gray-500 mt-0.5">{lines.length} productos · enviado el {new Date(order.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderHistoryButton events={data.events} viewer="client" highlight={!!staffNote} />
          {deletable && <button onClick={deleteOrder} disabled={busy} className="px-3 py-1.5 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Borrar pedido</button>}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
        </div>
      </div>

      {staffNote && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-900">
          <p className="font-semibold">Interasia {staffNote.kind === "lines_edited" ? "modificó tu pedido" : staffNote.kind === "quotation_sent" ? "te envió la cotización" : "te escribió"}</p>
          {staffNote.note && <p className="mt-0.5 whitespace-pre-wrap">{staffNote.note}</p>}
        </div>
      )}
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 flex items-center justify-between gap-3">
        <span>{error}</span><button onClick={() => { setError(""); load(); }} className="underline text-xs">Recargar</button></div>}
      {ok && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{ok}</div>}

      {order.status === "quoted" && (
        <div className="mb-6 bg-white border border-green-200 rounded-xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Cotización lista para tu revisión</p>
              {quotation && <p className="text-xs text-gray-500">{quotation.quote_number} · total {money(quotation.total_amount, quotation.currency)}</p>}
            </div>
            {quotation && <a href={`/q/${quotation.quote_number}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Ver cotización completa →</a>}
          </div>
          {offered.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-3">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500"><tr>
                  {["Producto", "Pediste", "Te ofrecemos", "Precio unit.", "Total"].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {offered.map(l => {
                    const o = l.offer;
                    const extras = (o.options || []).reduce((n, x) => n + Number(x.extra_price || 0), 0);
                    const unit = Number(o.price || 0) + extras;
                    return (
                      <tr key={l.id} className="border-t border-gray-100 align-top">
                        <td className="px-2 py-1.5">{lineLabel(l)}{l.color ? ` · ${l.color}` : ""}</td>
                        <td className="px-2 py-1.5 text-gray-500">{Number(l.qty || 0).toLocaleString()} u.{l.price ? ` · obj. ${l.price}` : ""}</td>
                        <td className="px-2 py-1.5">{Number(o.quantity || 0).toLocaleString()} u.
                          {o.all_inclusive && <span className="ml-1 text-green-700">todo incluido</span>}
                          {(o.options || []).map((x, i) => <div key={i} className="text-gray-500">{x.label}{x.extra_price ? ` (+${x.extra_price})` : ""}</div>)}
                        </td>
                        <td className="px-2 py-1.5">{unit.toFixed(2)}</td>
                        <td className="px-2 py-1.5 font-semibold">{(unit * Number(o.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Comentario (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3" />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => respond("accept")} disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">Aceptar cotización</button>
            <button onClick={() => respond("request_changes")} disabled={busy} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Pedir cambios</button>
          </div>
        </div>
      )}

      <div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Tu pedido</p>
            {!editable && <span className="text-xs text-gray-400">Pedido confirmado: ya no se puede editar</span>}
          </div>
          <OrderLinesTable lines={lines} onChange={setLines} readOnly={!editable} uploadPhoto={uploadPortalPhoto}
            suggestions={suggestions} exportMeta={{ title: order.reference || "Pedido", client: session.client_name }} />

          {editable && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              {dirty && (
                <div className="mb-3 text-xs text-gray-600">
                  <p className="font-semibold mb-1">Cambios sin guardar ({describeChanges(diff).length})</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-gray-500">
                    {describeChanges(diff).slice(0, 6).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder={dirty ? "Comentario para nuestro equipo (opcional): ¿por qué cambiaste esto?" : "Escribe un comentario para nuestro equipo"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3" />
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={save} disabled={busy || !dirty || problems > 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {busy ? "Guardando…" : "Guardar y avisar"}
                </button>
                <button onClick={comment} disabled={busy || !note.trim() || dirty}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Solo comentar</button>
                {dirty && <button onClick={() => setLines(original)} className="text-xs text-gray-500 hover:text-gray-700">Descartar cambios</button>}
                {problems > 0 && <span className="text-xs text-red-600">{problems} fila(s) sin identificar o sin cantidad</span>}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
