import React, { useState, useRef, useEffect } from "react";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "🔥", "😮", "😢", "👏", "🚀"];

function ToolBtn({ onClick, active, title, disabled, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium transition select-none disabled:opacity-40 ${
        active ? "bg-primary/10 text-primary" : "text-bgray-500 hover:bg-bgray-100 dark:hover:bg-darkblack-500 hover:text-darkblack-700 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function MessageEditorToolbar({ editor, disabled, showEmoji: allowEmoji = true }) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const emojiRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!editor) return null;

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const href = url.startsWith("http") ? url : `https://${url}`;
    editor.chain().focus().setLink({ href, target: "_blank" }).run();
    setShowLinkInput(false);
    setLinkUrl("");
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" disabled={disabled}>
        <strong>B</strong>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" disabled={disabled}>
        <em>I</em>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" disabled={disabled}>
        <span className="underline">U</span>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" disabled={disabled}>
        <span className="line-through">S</span>
      </ToolBtn>
      <span className="w-px h-4 bg-bgray-200 dark:bg-darkblack-400 mx-0.5" />
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list" disabled={disabled}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list" disabled={disabled}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
      </ToolBtn>
      <span className="w-px h-4 bg-bgray-200 dark:bg-darkblack-400 mx-0.5" />
      <div className="relative">
        <ToolBtn onClick={() => setShowLinkInput(v => !v)} active={showLinkInput || editor.isActive("link")} title="Link" disabled={disabled}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </ToolBtn>
        {showLinkInput && (
          <div className="absolute bottom-full mb-2 left-0 flex items-center gap-1 p-1.5 bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-lg shadow-lg z-20">
            <input
              type="text"
              autoFocus
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setShowLinkInput(false); }}
              placeholder="https://..."
              className="text-xs border border-bgray-300 dark:border-darkblack-400 rounded px-2 py-1 w-40 outline-none bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white"
            />
            <button type="button" onMouseDown={e => { e.preventDefault(); applyLink(); }} className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90 transition">OK</button>
          </div>
        )}
      </div>
      {allowEmoji && (
        <div className="relative" ref={emojiRef}>
          <ToolBtn onClick={() => setShowEmoji(v => !v)} title="Emoji" disabled={disabled}>🙂</ToolBtn>
          {showEmoji && (
            <div className="absolute bottom-full mb-2 left-0 grid grid-cols-6 gap-1 p-2 bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-lg z-20">
              {EMOJIS.map(e => (
                <button key={e} type="button" onMouseDown={ev => { ev.preventDefault(); editor.chain().focus().insertContent(e).run(); setShowEmoji(false); }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-bgray-100 dark:hover:bg-darkblack-400 text-lg">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
