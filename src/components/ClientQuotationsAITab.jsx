import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function EnablePanel({ clientId, settings, onSaved }) {
  const [enabled, setEnabled] = useState(settings?.enabled || false);
  const [datasetId, setDatasetId] = useState(settings?.dify_dataset_id || "");
  const [datasetName, setDatasetName] = useState(settings?.dify_dataset_name || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    if (enabled && !datasetId.trim()) {
      setMsg({ type: "error", text: "Pega el Dataset ID de Dify para habilitar el módulo." });
      return;
    }
    setBusy(true); setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_quotations_ai").upsert({
      client_id: clientId,
      enabled,
      dify_dataset_id: datasetId.trim() || null,
      dify_dataset_name: datasetName.trim() || null,
      enabled_by: user?.id || null,
      enabled_at: enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "success", text: "Guardado." });
    onSaved({ enabled, dify_dataset_id: datasetId.trim() || null, dify_dataset_name: datasetName.trim() || null });
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  return (
    <div className="p-6 max-w-lg space-y-4 border-b border-bgray-200 dark:border-darkblack-400">
      <div>
        <h3 className="text-base font-bold text-darkblack-700 dark:text-white">Cotizaciones IA</h3>
        <p className="text-sm text-bgray-500 mt-0.5">Conecta este cliente a un Knowledge Base de Dify — los documentos y la indexación se manejan directamente en Dify, no aquí.</p>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-bgray-300 text-primary focus:ring-primary" />
        <span className="text-sm font-medium text-darkblack-700 dark:text-white">Habilitar módulo para este cliente</span>
      </label>

      <div>
        <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Dify Dataset ID</label>
        <input value={datasetId} onChange={e => setDatasetId(e.target.value)} placeholder="ej. 8f2a1c3e-..." className={`${inputCls} font-mono`} />
        <p className="text-xs text-bgray-400 mt-1">Lo encuentras en Dify → Knowledge → el dataset de este cliente → Settings.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide">Nombre del dataset (opcional, solo referencia)</label>
        <input value={datasetName} onChange={e => setDatasetName(e.target.value)} placeholder="ej. Guía Cereza — Cotizaciones" className={inputCls} />
      </div>

      {msg && (
        <div className={`px-3 py-2 rounded-lg text-sm ${msg.type === "error" ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>{msg.text}</div>
      )}

      <button onClick={save} disabled={busy} className="px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
        {busy ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

// The chat itself lives in the client portal (ConsultarCotizacionesPage) —
// this tab is staff-only: it's the admin control for which Dify dataset a
// client is mapped to and whether the module is switched on for them.
export default function ClientQuotationsAITab({ clientId }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.from("client_quotations_ai").select("*").eq("client_id", clientId).maybeSingle()
      .then(({ data }) => { if (active) { setSettings(data || {}); setLoading(false); } });
    return () => { active = false; };
  }, [clientId]);

  if (loading) return <div className="p-6 text-sm text-bgray-500">Cargando…</div>;

  return (
    <div>
      <EnablePanel clientId={clientId} settings={settings} onSaved={setSettings} />
      <p className="p-6 text-sm text-bgray-400">
        {settings?.enabled && settings?.dify_dataset_id
          ? "El cliente ya puede consultarlo desde su portal, en \"Consultar Cotizaciones\"."
          : "Habilita el módulo y pega el Dataset ID de Dify arriba — el chat aparece en el portal del cliente, no aquí."}
      </p>
    </div>
  );
}
