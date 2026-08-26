import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCopilotPageContext } from "../../contexts/CopilotPageContext";
import { sendCopilotMessage } from "../../lib/ai/copilotClient";
import { listConversations, loadConversationMessages } from "../../lib/ai/conversationsClient";
import CopilotMessage from "./CopilotMessage";
import VoiceInputButton from "./VoiceInputButton";

const SUGGESTIONS = ["How are we doing?", "What needs attention?", "What did the client originally request?", "Are there overdue tasks?"];

const MIN_WIDTH = 340;
const MIN_HEIGHT = 420;
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 560;

function CopilotIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

export default function YgriCopilot() {
  const navigate = useNavigate();
  const { pageContext } = useCopilotPageContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const startPos = useRef(null);
  const startSize = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isOpen]);

  // Continue the most recent conversation automatically the first time the
  // widget is opened, so context survives closing it / reloading the page —
  // "always have context," per how this was asked for.
  useEffect(() => {
    if (!isOpen || hasLoadedInitial) return;
    setHasLoadedInitial(true);
    (async () => {
      setLoadingHistory(true);
      try {
        const recent = await listConversations(1);
        if (recent[0]) {
          const msgs = await loadConversationMessages(recent[0].id);
          if (msgs.length) {
            setConversationId(recent[0].id);
            setMessages(msgs);
          }
        }
      } catch {
        // Silent — worst case they start a fresh conversation, nothing lost.
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [isOpen, hasLoadedInitial]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
  }, [size]);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || isExpanded) return;
    const dx = startPos.current.x - e.clientX;
    const dy = startPos.current.y - e.clientY;
    setSize({
      width: Math.max(MIN_WIDTH, startSize.current.width + dx),
      height: Math.max(MIN_HEIGHT, startSize.current.height + dy),
    });
  }, [isResizing, isExpanded]);

  const handleResizeEnd = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

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
    } catch (e) {
      setError(e.message);
      setMessages((prev) => [...prev, { role: "assistant", content: "Ygri Copilot is temporarily unavailable. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setError("");
  };

  const contextLabel = pageContext?.page === "project" ? pageContext.projectName || "this project" : null;
  const panelWidth = isExpanded ? "90vw" : size.width;
  const panelHeight = isExpanded ? "88vh" : size.height;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl bg-primary text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ bottom: 24, right: 24 }}
        >
          <CopilotIcon className="w-5 h-5" />
          <span>Ygri Copilot</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl shadow-2xl border border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 overflow-hidden min-h-0"
          style={{
            bottom: isExpanded ? "6vh" : 24,
            right: isExpanded ? "5vw" : 24,
            width: panelWidth,
            height: panelHeight,
            maxWidth: "95vw",
            maxHeight: "90vh",
            transition: isResizing ? "none" : "width 0.2s, height 0.2s",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white shrink-0 select-none">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                <CopilotIcon className="w-4 h-4" /> Ygri Copilot
              </p>
              {contextLabel ? (
                <p className="text-xs text-white/75 leading-tight truncate mt-0.5">{contextLabel}</p>
              ) : (
                <p className="text-xs text-white/75 leading-tight mt-0.5">No project open</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={startNewChat} className="p-1.5 rounded-lg hover:bg-white/15 transition" title="New chat">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
              <button onClick={() => navigate("/copilot", { state: { conversationId, pageContext } })} className="p-1.5 rounded-lg hover:bg-white/15 transition" title="Open full page">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              </button>
              <button
                onClick={() => setIsExpanded((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition"
                title={isExpanded ? "Shrink" : "Expand"}
              >
                {isExpanded ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                )}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
            {loadingHistory && (
              <div className="h-full flex items-center justify-center">
                <span className="w-4 h-4 border-2 border-bgray-300 border-t-primary rounded-full animate-spin inline-block" />
              </div>
            )}
            {!loadingHistory && messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <CopilotIcon className="w-8 h-8 text-bgray-300 dark:text-bgray-600 mb-2" />
                <p className="text-sm text-bgray-400 dark:text-bgray-500 mb-4">
                  {contextLabel ? `Ask me anything about ${contextLabel}.` : "Open a project to give me context, or ask a general question."}
                </p>
                {contextLabel && (
                  <div className="flex flex-col gap-1.5 w-full">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-xs text-left px-3 py-2 rounded-lg border border-bgray-200 dark:border-darkblack-400 text-bgray-600 dark:text-bgray-300 hover:border-primary hover:text-primary transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!loadingHistory && messages.map((m, i) => <CopilotMessage key={i} message={m} />)}
            {sending && (
              <div className="flex justify-start mb-3">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-bgray-100 dark:bg-darkblack-500">
                  <span className="w-3.5 h-3.5 border-2 border-bgray-400 border-t-transparent rounded-full animate-spin inline-block" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="px-3 pb-1 text-xs text-red-500">{error}</p>}

          <div className="border-t border-bgray-100 dark:border-darkblack-400 p-2.5 flex items-end gap-2 shrink-0">
            <VoiceInputButton onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))} size="w-9 h-9" />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Ygri Copilot..."
              rows={1}
              disabled={sending}
              className="flex-1 resize-none px-3 py-2 text-sm border border-bgray-200 dark:border-darkblack-400 rounded-xl bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary outline-none max-h-24"
            />
            <button
              onClick={() => send()}
              disabled={sending || !draft.trim()}
              className="shrink-0 flex items-center justify-center w-9 h-9 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>

          {!isExpanded && (
            <div
              onMouseDown={handleResizeStart}
              className="absolute top-0 left-0 w-5 h-5 z-10 cursor-nw-resize flex items-center justify-center"
              style={{ touchAction: "none" }}
              title="Drag to resize"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 9L9 1M1 5L5 1M5 9L9 5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>
      )}
    </>
  );
}
