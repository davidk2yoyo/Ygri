import React, { useRef, useState } from "react";
import { uploadPortalMedia } from "../../portal/lib/uploadPortalMedia";
import { evaluateItem, STATE_STYLE, fmtDay } from "../../lib/warranty";

export const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400";
export const labelCls = "block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide";

// Photos / videos attached to a claim line (click to open full size)
export function MediaThumbs({ media = [], onRemove, size = "w-16 h-16" }) {
  if (!media.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {media.map((m, i) => (
        <div key={m.url + i} className={`relative ${size} rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0`}>
          <a href={m.url} target="_blank" rel="noreferrer" className="block w-full h-full">
            {m.kind === "video"
              ? <span className="w-full h-full flex items-center justify-center text-2xl text-gray-500">▶</span>
              : <img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" />}
          </a>
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} title="Quitar"
              className="absolute top-0 right-0 w-5 h-5 bg-black/60 text-white text-xs leading-5 text-center rounded-bl-lg">×</button>
          )}
        </div>
      ))}
    </div>
  );
}

// "+ Foto o video" button; uploads each file and hands the new {url, kind}s to onAdd
export function MediaPicker({ onAdd, disabled, label = "+ Foto o video" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (files) => {
    if (!files.length) return;
    setBusy(true); setErr("");
    const done = [];
    for (const f of files) {
      try { done.push(await uploadPortalMedia(f)); } catch (e) { setErr(e.message || "No se pudo subir un archivo."); }
    }
    if (done.length) onAdd(done);
    setBusy(false);
  };
  return (
    <span className="inline-flex flex-col">
      <input ref={ref} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { pick([...e.target.files]); e.target.value = ""; }} />
      <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
        {busy ? "Subiendo…" : label}
      </button>
      {err && <span className="text-[11px] text-red-600 mt-1">{err}</span>}
    </span>
  );
}

// Is this line still under warranty? (rule + reception date + claim date)
export function VerdictBadge({ item, rules, withNote = false }) {
  const ev = evaluateItem(item, rules);
  const st = STATE_STYLE[ev.state];
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text} · {ev.label}</span>
      {ev.until && <span className="text-[11px] text-gray-500">Vence {fmtDay(ev.until)}</span>}
      {withNote && ev.note && <span className="text-[11px] text-gray-500">{ev.note}</span>}
    </span>
  );
}
