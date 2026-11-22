import React, { useRef, useState } from "react";
import { uploadPortalAttachment } from "../../portal/lib/uploadPortalAttachment";
import { fmtDateTime, APPROVAL } from "../../lib/cases";

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400";

export function Attachments({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((a, i) => a.kind === "image" ? (
        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
          <img src={a.url} alt={a.name || ""} className="w-full h-full object-cover" loading="lazy" />
        </a>
      ) : (
        <a key={i} href={a.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-blue-700 hover:bg-blue-50 max-w-[16rem]">
          <span>{a.kind === "video" ? "🎬" : "📎"}</span><span className="truncate">{a.name || "archivo"}</span>
        </a>
      ))}
    </div>
  );
}

// Attach button + pending list; hands the uploaded {url,name,kind} list up through `value/onChange`
export function AttachPicker({ value, onChange, disabled }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (files) => {
    if (!files.length) return;
    setBusy(true); setErr("");
    const done = [];
    for (const f of files) { try { done.push(await uploadPortalAttachment(f)); } catch (e) { setErr(e.message || "No se pudo subir un archivo."); } }
    onChange([...value, ...done].slice(0, 10));
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" multiple className="hidden" onChange={e => { pick([...e.target.files]); e.target.value = ""; }} />
      <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">{busy ? "Subiendo…" : "📎 Adjuntar"}</button>
      {value.map((a, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs text-gray-700 max-w-[14rem]">
          <span className="truncate">{a.name}</span>
          <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="text-gray-400 hover:text-red-600">×</button>
        </span>
      ))}
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}

const KIND_NOTE = { approval_request: "Solicitó tu aprobación", approved: "Aprobó el diseño", changes_requested: "Pidió cambios al diseño" };

// The conversation. `staff` shows internal notes and the approval request option; otherwise the client's
// approve / ask-for-changes buttons appear while an approval is pending.
export default function CaseThread({ messages, approval, closed, staff = false, onSend, onDecide }) {
  const [body, setBody] = useState("");
  const [att, setAtt] = useState([]);
  const [internal, setInternal] = useState(false);
  const [askApproval, setAskApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [changing, setChanging] = useState(false);

  async function send() {
    if (!body.trim() && !att.length) return;
    setBusy(true); setErr("");
    try {
      await onSend({ body: body.trim(), attachments: att, internal, askApproval });
      setBody(""); setAtt([]); setInternal(false); setAskApproval(false);
    } catch (e) { setErr(e.message || "No se pudo enviar."); }
    setBusy(false);
  }
  async function decide(decision, note) {
    setBusy(true); setErr("");
    try { await onDecide(decision, note); setChanging(false); setChangeNote(""); } catch (e) { setErr(e.message || "No se pudo enviar."); }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {messages.map(m => {
          const mine = staff ? m.author_type === "staff" : m.author_type === "client";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.is_internal ? "bg-yellow-50 border border-yellow-200 text-yellow-900"
                : mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                <p className={`text-[11px] mb-0.5 ${m.is_internal ? "text-yellow-700" : mine ? "text-blue-100" : "text-gray-500"}`}>
                  {m.is_internal ? "🔒 Nota interna · " : ""}{m.author_name || (m.author_type === "staff" ? "Ygri" : "Cliente")} · {fmtDateTime(m.created_at)}
                </p>
                {KIND_NOTE[m.kind] && <p className="font-semibold mb-0.5">{m.kind === "approved" ? "✅ " : m.kind === "changes_requested" ? "✏️ " : "🎨 "}{KIND_NOTE[m.kind]}</p>}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <Attachments items={m.attachments} />
              </div>
            </div>
          );
        })}
      </div>

      {!staff && approval === "pending" && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Ygri espera tu aprobación de este diseño</p>
          {changing ? (
            <>
              <textarea rows={3} className={inputCls} value={changeNote} onChange={e => setChangeNote(e.target.value)} placeholder="¿Qué hay que cambiar?" />
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => decide("changes", changeNote)} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-amber-600 text-white disabled:opacity-50">Enviar cambios</button>
                <button onClick={() => setChanging(false)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300">Cancelar</button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => decide("approved", "")} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-green-600 text-white disabled:opacity-50">✅ Aprobar</button>
              <button disabled={busy} onClick={() => setChanging(true)} className="px-4 py-1.5 text-sm font-semibold rounded-lg border border-amber-300 text-amber-800 bg-white">✏️ Pedir cambios</button>
            </div>
          )}
        </div>
      )}
      {approval && approval !== "pending" && <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${APPROVAL[approval].cls}`}>{APPROVAL[approval].label}</span>}

      {err && <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">{err}</div>}
      <div className="space-y-2 pt-1">
        <textarea rows={3} className={inputCls} value={body} onChange={e => setBody(e.target.value)}
          placeholder={staff ? (internal ? "Nota interna (el cliente no la ve)…" : "Responder al cliente…") : closed ? "Escribe para reabrir esta consulta…" : "Escribe tu respuesta…"} />
        <AttachPicker value={att} onChange={setAtt} disabled={busy} />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={send} disabled={busy || (!body.trim() && !att.length)} className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{busy ? "Enviando…" : internal ? "Guardar nota" : "Enviar"}</button>
          {staff && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={internal} onChange={e => { setInternal(e.target.checked); if (e.target.checked) setAskApproval(false); }} />Nota interna</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={askApproval} disabled={internal} onChange={e => setAskApproval(e.target.checked)} />Pedir aprobación del cliente</label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
