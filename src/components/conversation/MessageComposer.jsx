import React, { useState, useRef } from "react";

const wrapSelection = (el, before, after = before) => {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;
  const selected = value.slice(start, end);
  const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
  return { newValue, selStart: start + before.length, selEnd: start + before.length + selected.length };
};

export default function MessageComposer({ onSend, disabled, profiles = [] }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const autoResize = (el) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const applyFormat = (before, after) => {
    const el = textareaRef.current;
    if (!el) return;
    const { newValue, selStart, selEnd } = wrapSelection(el, before, after);
    setText(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
      autoResize(el);
    });
  };

  const handleTextChange = (e) => {
    const el = e.target;
    const value = el.value;
    setText(value);
    autoResize(el);

    const cursor = el.selectionStart;
    const beforeCursor = value.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf("@");
    if (atIndex !== -1) {
      const afterAt = beforeCursor.slice(atIndex + 1);
      if (!/\s/.test(afterAt)) {
        setShowMentions(true);
        setMentionQuery(afterAt);
        setMentionStart(atIndex);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (profile) => {
    const el = textareaRef.current;
    if (!el || mentionStart === null) return;
    const cursor = el.selectionStart;
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursor);
    const mentionText = `[@${profile.full_name}](mention:${profile.id}) `;
    const newValue = before + mentionText + after;
    setText(newValue);
    setShowMentions(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + mentionText.length;
      el.setSelectionRange(pos, pos);
      autoResize(el);
    });
  };

  const filteredProfiles = profiles.filter(p => p.full_name?.toLowerCase().includes(mentionQuery.toLowerCase()));

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && showMentions) { setShowMentions(false); return; }
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
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
      if (textareaRef.current) textareaRef.current.style.height = "auto";
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

      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 mb-1.5">
        <button type="button" onClick={() => applyFormat("**")} disabled={disabled} title="Bold" className="w-6 h-6 flex items-center justify-center rounded text-bgray-500 hover:bg-bgray-100 dark:hover:bg-darkblack-500 hover:text-darkblack-700 dark:hover:text-white text-sm font-bold transition disabled:opacity-40">
          B
        </button>
        <button type="button" onClick={() => applyFormat("_")} disabled={disabled} title="Italic" className="w-6 h-6 flex items-center justify-center rounded text-bgray-500 hover:bg-bgray-100 dark:hover:bg-darkblack-500 hover:text-darkblack-700 dark:hover:text-white text-sm italic transition disabled:opacity-40">
          i
        </button>
        <button type="button" onClick={() => applyFormat("\n- ", "")} disabled={disabled} title="Bullet list" className="w-6 h-6 flex items-center justify-center rounded text-bgray-500 hover:bg-bgray-100 dark:hover:bg-darkblack-500 hover:text-darkblack-700 dark:hover:text-white transition disabled:opacity-40">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </button>
      </div>

      <div className="relative flex items-end gap-2 border border-bgray-200 dark:border-darkblack-400 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
        {showMentions && filteredProfiles.length > 0 && (
          <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
            {filteredProfiles.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
                className="w-full text-left px-3 py-2 hover:bg-bgray-50 dark:hover:bg-darkblack-400 text-sm text-darkblack-700 dark:text-white transition"
              >
                {p.full_name}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Message this project... (@ to mention someone)"
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
