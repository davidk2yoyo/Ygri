import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";

// Home-page box: write a comment or a question in one step. It becomes a conversation under "Consultas".
export default function QuickComment() {
  const { session } = useClientPortal();
  const [kind, setKind] = useState("comment");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true); setErr("");
    const subject = body.replace(/\s+/g, " ").slice(0, 60) + (body.length > 60 ? "…" : "");
    const { error } = await supabase.rpc("client_portal_create_case", {
      p_session_id: session.session_id, p_kind: kind, p_subject: subject, p_body: body, p_track_id: null, p_attachments: [],
    });
    setBusy(false);
    if (error) { setErr(error.message?.includes("does not exist") ? "Este módulo aún no está activo." : error.message); return; }
    setText(""); setSent(true);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="text-base font-bold text-gray-900">¿Tienes una pregunta o un comentario?</h2>
        <div className="flex gap-1.5">
          {[["comment", "💬 Comentario"], ["question", "❓ Pregunta"]].map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={`px-3 py-1 rounded-full text-xs font-medium border ${kind === k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
      </div>
      <textarea rows={3} value={text} onChange={e => { setText(e.target.value); setSent(false); }} placeholder="Escríbenos aquí. Te respondemos desde Consultas."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400" />
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button onClick={send} disabled={busy || !text.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">{busy ? "Enviando…" : "Enviar"}</button>
        {sent && <span className="text-sm text-green-700">✅ Enviado. <Link to="/clientes/consultas" className="underline">Ver mis consultas</Link></span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
        {!sent && <Link to="/clientes/consultas" className="text-xs text-gray-500 hover:underline ml-auto">Ver mis consultas →</Link>}
      </div>
    </div>
  );
}
