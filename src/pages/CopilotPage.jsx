import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { sileo } from "sileo";
import CopilotMessage from "../components/ai/CopilotMessage";
import VoiceInputButton from "../components/ai/VoiceInputButton";
import { sendCopilotMessage } from "../lib/ai/copilotClient";
import { listConversations, loadConversationMessages, deleteConversation } from "../lib/ai/conversationsClient";

const SUGGESTIONS = ["How are we doing across all projects?", "What needs attention this week?", "Are there overdue tasks?", "Which clients haven't we heard from recently?"];

function relativeTime(iso) {
  const seconds = Math.floor((new Date() - new Date(iso)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CopilotPage() {
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(location.state?.conversationId || null);
  const [pageContext, setPageContext] = useState(location.state?.pageContext || {});
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      // Sidebar is a nice-to-have — a failed refresh shouldn't block chatting
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshConversations();
      if (conversationId) {
        try {
          setMessages(await loadConversationMessages(conversationId));
        } catch (e) {
          sileo.error({ title: "Could not load conversation", description: e.message });
        }
      }
      setLoadingHistory(false);
      if (!conversationId && location.state?.initialMessage) {
        send(location.state.initialMessage);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const openConversation = async (id) => {
    setConversationId(id);
    setPageContext({});
    setLoadingHistory(true);
    try {
      setMessages(await loadConversationMessages(id));
    } catch (e) {
      sileo.error({ title: "Could not load conversation", description: e.message });
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setPageContext({});
    setMessages([]);
    setError("");
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await deleteConversation(id);
      if (id === conversationId) startNewChat();
      await refreshConversations();
    } catch (e2) {
      sileo.error({ title: "Could not delete conversation", description: e2.message });
    }
  };

  const send = async (text) => {
    const trimmed = (text ?? draft).trim();
    if (!trimmed || sending) return;
    setError("");
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setSending(true);
    try {
      const result = await sendCopilotMessage({ message: trimmed, pageContext, conversationId });
      setConversationId(result.conversation_id);
      setMessages((prev) => [...prev, { role: "assistant", content: result.message, plan: result.plan }]);
      refreshConversations();
    } catch (e) {
      setError(e.message);
      setMessages((prev) => [...prev, { role: "assistant", content: "Ygri Copilot is temporarily unavailable. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-bgray-100 dark:border-darkblack-400 flex flex-col">
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm group flex items-center justify-between gap-2 transition ${
                c.id === conversationId ? "bg-primary/10 text-primary" : "text-bgray-600 dark:text-bgray-300 hover:bg-bgray-100 dark:hover:bg-darkblack-500"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{c.title || "New conversation"}</span>
                <span className="block text-[11px] text-bgray-400">{relativeTime(c.updated_at)}</span>
              </span>
              <span
                onClick={(e) => handleDelete(c.id, e)}
                role="button"
                className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-bgray-400 hover:text-red-500 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </span>
            </button>
          ))}
          {!conversations.length && <p className="text-xs text-bgray-400 px-3 py-2">No conversations yet.</p>}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
          <div className="max-w-3xl mx-auto">
            {loadingHistory ? (
              <div className="flex justify-center py-16">
                <span className="w-5 h-5 border-2 border-bgray-300 border-t-primary rounded-full animate-spin inline-block" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16">
                <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white mb-1">Ygri Copilot</h2>
                <p className="text-sm text-bgray-400 mb-6">Ask about any project, client, or supplier across the whole CRM.</p>
                <div className="flex flex-col gap-1.5 max-w-md mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-sm text-left px-4 py-2.5 rounded-xl border border-bgray-200 dark:border-darkblack-400 text-bgray-600 dark:text-bgray-300 hover:border-primary hover:text-primary transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <CopilotMessage key={i} message={m} />)
            )}
            {sending && (
              <div className="flex justify-start mb-3">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-bgray-100 dark:bg-darkblack-500">
                  <span className="w-3.5 h-3.5 border-2 border-bgray-400 border-t-transparent rounded-full animate-spin inline-block" />
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="max-w-3xl mx-auto w-full px-4 text-xs text-red-500">{error}</p>}

        <div className="border-t border-bgray-100 dark:border-darkblack-400 p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <VoiceInputButton onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))} size="w-11 h-11" />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Ygri Copilot..."
              rows={1}
              disabled={sending}
              className="flex-1 resize-none px-4 py-3 text-sm border border-bgray-200 dark:border-darkblack-400 rounded-2xl bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary outline-none max-h-40"
            />
            <button
              onClick={() => send()}
              disabled={sending || !draft.trim()}
              className="shrink-0 flex items-center justify-center w-11 h-11 bg-primary text-white rounded-2xl hover:bg-primary/90 disabled:opacity-40 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
