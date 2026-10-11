import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import { parseClientOrderWorkbook } from "../../lib/clientOrderParser";

const STATUS_LABEL = {
  submitted: ["Recibido", "bg-blue-100 text-blue-700"],
  draft: ["En revisión", "bg-amber-100 text-amber-700"],
  confirmed: ["Confirmado", "bg-green-100 text-green-700"],
  quoted: ["Cotizado", "bg-green-100 text-green-700"],
  ordered: ["En compra", "bg-green-100 text-green-700"],
  closed: ["Cerrado", "bg-gray-100 text-gray-600"],
};

export default function SubirPedidoPage() {
  const { session } = useClientPortal();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState([]);

  const loadMine = async () => {
    const { data } = await supabase.rpc("client_portal_get_client_orders", { p_session_id: session.session_id });
    setMine(data || []);
  };
  useEffect(() => { loadMine(); }, [session.session_id]);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f); setParsing(true); setError(""); setDone(false); setLines([]);
    try {
      const { sheets } = await parseClientOrderWorkbook(await f.arrayBuffer());
      const all = sheets.filter(s => s.kind === "supplier").flatMap(s => s.lines.map(l => ({ ...l, sheet: s.name })));
      if (!all.length) throw new Error("No encontramos productos. Usa la plantilla y llena la hoja «Pedido».");
      setLines(all);
      if (!reference) setReference(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e.message || "No pudimos leer el archivo.");
    } finally {
      setParsing(false);
    }
  };

  // a product must be identifiable (name, supplier ref or client ref) and have a quantity
  const problems = lines.map((l, i) => ({
    i,
    id: !(l.name?.trim() || l.supplier_ref?.trim() || l.client_ref?.trim()),
    qty: !(Number(l.qty) > 0),
  })).filter(p => p.id || p.qty);
  const sheetsCount = new Set(lines.map(l => l.sheet)).size;

  const submit = async () => {
    setSending(true); setError("");
    try {
      // original file goes to an insert-only drop box (path is unguessable)
      let fileUrl = "";
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}/pedido.${ext}`;
      const up = await supabase.storage.from("client-portal-uploads").upload(path, file);
      if (!up.error) fileUrl = supabase.storage.from("client-portal-uploads").getPublicUrl(path).data.publicUrl;

      const payload = lines.map(l => ({
        sheet_name: l.sheet, sheet_row: l.row, supplier: l.supplier, supplier_ref: l.supplier_ref, name: l.name,
        color: l.color, qty: l.qty, price: l.price, client_ref: l.client_ref, brand: l.brand,
        marking: l.marking, packaging: l.packaging, notes: l.notes,
      }));
      const { error: rpcErr } = await supabase.rpc("client_portal_submit_order", {
        p_session_id: session.session_id, p_reference: reference, p_file_name: file.name, p_file_url: fileUrl, p_lines: payload,
      });
      if (rpcErr) throw rpcErr;
      setDone(true); setFile(null); setLines([]); setReference("");
      if (fileRef.current) fileRef.current.value = "";
      loadMine();
    } catch (e) {
      setError(e.message || "No pudimos enviar el pedido.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Subir pedido</h1>
        <p className="text-sm text-gray-500 mt-0.5">Envíanos tu orden de compra en Excel. Nuestro equipo la revisa y te confirma.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">1. Descarga la plantilla</p>
            <p className="text-xs text-gray-500">Llena una fila por producto. Los campos con * son obligatorios.</p>
          </div>
          <a href="/templates/plantilla-pedido.xlsx" download className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Descargar plantilla
          </a>
        </div>

        <p className="text-sm font-semibold text-gray-900 mb-2">2. Sube tu archivo</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className="w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">
          {file ? file.name : "Haz clic para elegir tu archivo .xlsx"}
        </button>

        {parsing && <p className="text-sm text-gray-500 mt-3">Leyendo el archivo…</p>}
        {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
        {done && <div className="mt-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">Pedido enviado. Nuestro equipo lo revisará y te avisará.</div>}

        {lines.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-gray-900 mb-2">3. Revisa y envía</p>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Referencia de tu pedido</label>
              <input value={reference} onChange={e => setReference(e.target.value)} className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <p className="text-xs text-gray-500 mb-2">{lines.length} productos{sheetsCount > 1 ? ` de ${sheetsCount} proveedores/hojas` : ""}.</p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>{["Proveedor", "Ref. prov.", "Nombre", "Color", "Cant.", "Ref. cliente", "Marca", "Marc.", "Empaque"].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const bad = problems.find(p => p.i === i);
                    return (
                      <tr key={i} className={`border-t border-gray-100 ${bad ? "bg-red-50" : ""}`}>
                        <td className="px-2 py-1">{l.supplier || l.sheet}</td>
                        <td className="px-2 py-1 font-mono">{l.supplier_ref}</td>
                        <td className="px-2 py-1">{l.name || (l.supplier_ref || l.client_ref ? <span className="text-gray-400">—</span> : <span className="text-red-500">falta nombre o referencia</span>)}</td>
                        <td className="px-2 py-1">{l.color}</td>
                        <td className="px-2 py-1">{Number(l.qty) > 0 ? l.qty : <span className="text-red-500">falta</span>}</td>
                        <td className="px-2 py-1 font-mono">{l.client_ref}</td>
                        <td className="px-2 py-1">{l.brand}</td>
                        <td className="px-2 py-1">{l.marking === true ? "SI" : l.marking === false ? "NO" : ""}</td>
                        <td className="px-2 py-1">{l.packaging}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {problems.length > 0 && <p className="text-xs text-red-600 mt-2">Corrige {problems.length} fila(s) marcadas en rojo en tu Excel y vuelve a subirlo.</p>}
            <button onClick={submit} disabled={sending || problems.length > 0}
              className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {sending ? "Enviando…" : `Enviar pedido (${lines.length} productos)`}
            </button>
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mb-2">Mis pedidos enviados</h2>
      {mine.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no has enviado pedidos.</p>
      ) : (
        <div className="space-y-2">
          {mine.map(o => {
            const [label, color] = STATUS_LABEL[o.status] || [o.status, "bg-gray-100 text-gray-600"];
            return (
              <div key={o.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{o.reference || "Pedido"}</p>
                  <p className="text-xs text-gray-500">{o.line_count} productos · {new Date(o.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
