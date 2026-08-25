import React, { useState, useRef, useEffect } from "react";
import { useCopilotPageContext } from "../../contexts/CopilotPageContext";
import { sendCopilotMessage } from "../../lib/ai/copilotClient";
import ActionPlanPanel from "./ActionPlanPanel";

const SUGGESTIONS = ["How are we doing?", "What needs attention?", "What did the client originally request?", "Are there overdue tasks?"];

function CopilotIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function CopilotMessage({ message }) {
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
        {message.content && (
          <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-bgray-100 dark:bg-darkblack-500 text-darkblack-700 dark:text-white text-sm whitespace-pre-wrap">
            {message.content}
          </div>
        )}
        {message.plan && <ActionPlanPanel plan={message.plan} onDone={message.onPlanDone} />}
      </div>
    </div>
  );
}

export default function YgriCopilot() {
  const { pageContext } = useCopilotPageContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isOpen]);

  const send = async (text) => {
    const trimmed = (text ?? draft).trim();
    if (!trimmed || sending) return;
    setError("");
    setDraft("");
    const history = messages.map((m) => ({ role: m.role, content: m.content || "" }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setSending(true);
    try {
      const result = await sendCopilotMessage({ message: trimmed, pageContext, history });
      setMessages((prev) => [...prev, { role: "assistant", content: result.message, plan: result.plan }]);
    } catch (e) {
      setError(e.message);
      setMessages((prev) => [...prev, { role: "assistant", content: "Ygri Copilot is temporarily unavailable. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  const contextLabel = pageContext?.page === "project" ? pageContext.projectName || "this project" : null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl bg-primary text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ bottom: 96, right: 24 }}
        >
          <CopilotIcon className="w-5 h-5" />
          <span>Ygri Copilot</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl shadow-2xl border border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 overflow-hidden"
          style={{ bottom: 96, right: 24, width: 400, height: 560, maxWidth: "90vw", maxHeight: "80vh" }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white shrink-0">
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
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 transition shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
            {messages.length === 0 && (
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
            {messages.map((m, i) => <CopilotMessage key={i} message={m} />)}
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
        </div>
      )}
    </>
  );
}
