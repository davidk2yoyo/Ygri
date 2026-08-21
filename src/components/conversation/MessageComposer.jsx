import React, { useState, useRef } from "react";

export default function MessageComposer({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (sending || disabled) return;
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      await onSend({ body: text.trim(), file });
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-bgray-100 dark:border-darkblack-400 p-3 bg-white dark:bg-darkblack-600">
      {file && (
        <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-bgray-50 dark:bg-darkblack-500 rounded-lg text-xs">
          <svg className="w-3.5 h-3.5 text-bgray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="truncate flex-1 text-bgray-600 dark:text-bgray-300">{file.name}</span>
          <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-bgray-400 hover:text-red-500 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 border border-bgray-200 dark:border-darkblack-400 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
          onKeyDown={handleKeyDown}
          placeholder="Message this project..."
          disabled={disabled}
          className="flex-1 resize-none border-0 outline-none bg-transparent text-sm text-darkblack-700 dark:text-white placeholder-bgray-400 py-1 max-h-40"
        />
        <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="shrink-0 p-1.5 text-bgray-400 hover:text-primary transition disabled:opacity-40"
          title="Attach file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || sending || (!text.trim() && !file)}
          className="shrink-0 flex items-center justify-center w-8 h-8 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition"
          title="Send"
        >
          {sending ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
