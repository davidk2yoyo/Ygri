import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "../supabaseClient";
import { sendQuotationsAiMessage } from "../lib/ai/quotationsAiClient";

const markdownComponents = {
  p: (props) => <p className="mb-1.5 last:mb-0" {...props} />,
  strong: (props) => <strong className="font-semibold text-darkblack-700 dark:text-white" {...props} />,
  ul: (props) => <ul className="list-disc list-outside pl-4 space-y-0.5 mb-1.5 marker:text-bgray-400" {...props} />,
  ol: (props) => <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-1.5" {...props} />,
  li: (props) => <li {...props} />,
  table: (props) => <table className="w-full text-xs my-1.5 border border-bgray-200 dark:border-darkblack-400" {...props} />,
  th: (props) => <th className="px-2 py-1 bg-bgray-50 dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 text-left" {...props} />,
  td: (props) => <td className="px-2 py-1 border border-bgray-200 dark:border-darkblack-400" {...props} />,
  code: (props) => <code className="px-1 py-0.5 bg-black/5 dark:bg-white/10 rounded text-xs font-mono" {...props} />,
};

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

function ChatBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-primary text-white text-sm">{message.content}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] w-full">
        <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-bgray-100 dark:bg-darkblack-500 text-darkblack-700 dark:text-white text-sm">
          {message.error ? (
            <span className="text-red-600">{message.content}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</ReactMarkdown>
          )}
        </div>
        {message.citations?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 px-1">
            {message.citations.map((c, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-bgray-50 dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-full text-bgray-500 dark:text-bgray-400">
                📄 {c.document}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ clientId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const { answer, conversationId: nextId, citations } = await sendQuotationsAiMessage({ clientId, message: text, conversationId });
      setConversationId(nextId);
      setMessages(prev => [...prev, { role: "assistant", content: answer, citations }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: e.message || "Error al consultar.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px]">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && (
          <p className="text-sm text-bgray-400">Pregunta por una referencia, un proveedor, o pide comparar precios entre cotizaciones. Ej: "¿Cuánto cuesta la referencia XM156?"</p>
        )}
        {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
        {busy && <div className="text-xs text-bgray-400 px-1">Buscando en las cotizaciones…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-4 border-t border-bgray-200 dark:border-darkblack-400">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Busca una referencia, precio o proveedor…"
          className="flex-1 px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
        />
        <button onClick={send} disabled={busy || !input.trim()} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
          Enviar
        </button>
      </div>
    </div>
  );
}

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
      {settings?.enabled && settings?.dify_dataset_id ? (
        <ChatPanel clientId={clientId} />
      ) : (
        <p className="p-6 text-sm text-bgray-400">Habilita el módulo y pega el Dataset ID de Dify arriba para empezar a consultar.</p>
      )}
    </div>
  );
}
