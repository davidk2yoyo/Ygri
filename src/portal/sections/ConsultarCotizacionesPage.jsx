import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "../../supabaseClient";
import { useClientPortal } from "../ClientPortalContext";
import { sendPortalQuotationsAiMessage } from "../lib/quotationsAiPortalClient";

const markdownComponents = {
  p: (props) => <p className="mb-1.5 last:mb-0" {...props} />,
  strong: (props) => <strong className="font-semibold text-gray-900" {...props} />,
  ul: (props) => <ul className="list-disc list-outside pl-4 space-y-0.5 mb-1.5 marker:text-gray-400" {...props} />,
  ol: (props) => <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-1.5" {...props} />,
  li: (props) => <li {...props} />,
  table: (props) => <table className="w-full text-xs my-1.5 border border-gray-200" {...props} />,
  th: (props) => <th className="px-2 py-1 bg-gray-50 border border-gray-200 text-left" {...props} />,
  td: (props) => <td className="px-2 py-1 border border-gray-200" {...props} />,
  code: (props) => <code className="px-1 py-0.5 bg-black/5 rounded text-xs font-mono" {...props} />,
};

function ChatBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-blue-600 text-white text-sm">{message.content}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] w-full">
        <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-gray-100 text-gray-800 text-sm">
          {message.error ? (
            <span className="text-red-600">{message.content}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</ReactMarkdown>
          )}
        </div>
        {message.citations?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 px-1">
            {message.citations.map((c, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full text-gray-500">
                📄 {c.document}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConsultarCotizacionesPage() {
  const { session } = useClientPortal();
  const [status, setStatus] = useState(null); // { enabled }
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    supabase.rpc("client_portal_get_quotations_ai_status", { p_session_id: session.session_id })
      .then(({ data }) => { setStatus(data?.[0] || { enabled: false }); setLoadingStatus(false); });
  }, [session.session_id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const { answer, conversationId: nextId, citations } = await sendPortalQuotationsAiMessage({
        sessionId: session.session_id, message: text, conversationId,
      });
      setConversationId(nextId);
      setMessages(prev => [...prev, { role: "assistant", content: answer, citations }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: e.message || "Error al consultar.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Consultar Cotizaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pregunta por una referencia, un precio o un proveedor en tus cotizaciones.</p>
      </div>

      {loadingStatus ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !status?.enabled ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-gray-500">Este módulo aún no está disponible para tu cuenta. Contacta a tu asesor para habilitarlo.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col h-[560px]">
          <div className="flex-1 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400">Ej: "¿Cuánto cuesta la referencia XM156?" o "¿Qué productos recargables tienes?"</p>
            )}
            {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
            {busy && <div className="text-xs text-gray-400 px-1">Buscando en tus cotizaciones…</div>}
            <div ref={bottomRef} />
          </div>
          <div className="flex items-center gap-2 p-4 border-t border-gray-200">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="Busca una referencia, precio o proveedor…"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button onClick={send} disabled={busy || !input.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
