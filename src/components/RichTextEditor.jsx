import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";

const COLORS = [
  { label: "Default",  value: "" },
  { label: "Gray",     value: "#6b7280" },
  { label: "Red",      value: "#dc2626" },
  { label: "Orange",   value: "#ea580c" },
  { label: "Blue",     value: "#2563eb" },
  { label: "Green",    value: "#16a34a" },
];

function ToolBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`px-2 py-1 rounded text-xs font-medium transition select-none ${
        active ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-gray-200 mx-0.5 shrink-0" />;
}

// Convert simple markdown to HTML for backward compat with existing content
function mdToHtml(text) {
  if (!text || text.startsWith("<")) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\\n/g, "\n")
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function RichTextEditor({ content, onChange, placeholder }) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
    ],
    content: mdToHtml(content) || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[160px] p-3 text-sm text-gray-700 leading-relaxed outline-none",
      },
    },
  });

  // Sync external content changes (e.g. from AI scan)
  React.useEffect(() => {
    if (!editor) return;
    const incoming = mdToHtml(content) || "";
    if (editor.getHTML() !== incoming) {
      editor.commands.setContent(incoming, false);
    }
  }, [content]); // eslint-disable-line

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <em>I</em>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <span className="underline">U</span>
        </ToolBtn>

        <Divider />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /><circle cx="2" cy="6" r="1" fill="currentColor" /><circle cx="2" cy="10" r="1" fill="currentColor" /><circle cx="2" cy="14" r="1" fill="currentColor" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </ToolBtn>

        <Divider />

        <ToolBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Normal text">
          ¶
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading">
          H
        </ToolBtn>

        <Divider />

        {/* Link */}
        {editor.isActive("link") ? (
          <ToolBtn
            onClick={() => editor.chain().focus().unsetLink().run()}
            active={false}
            title="Unlink"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              <line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </ToolBtn>
        ) : (
          <ToolBtn
            onClick={() => { setShowLinkInput(v => !v); setLinkUrl(""); }}
            active={showLinkInput}
            title="Add link"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </ToolBtn>
        )}
        {showLinkInput && (
          <div className="flex items-center gap-1 ml-1">
            <input
              type="text"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const url = linkUrl.trim();
                  if (!url) return;
                  const href = url.startsWith("http") ? url : `https://${url}`;
                  editor.chain().focus().setLink({ href, target: "_blank" }).run();
                  setShowLinkInput(false);
                  setLinkUrl("");
                }
                if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); }
              }}
              placeholder="https://..."
              className="text-xs border border-gray-300 rounded px-2 py-0.5 w-36 outline-none focus:border-blue-400"
              autoFocus
            />
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                const url = linkUrl.trim();
                if (!url) return;
                const href = url.startsWith("http") ? url : `https://${url}`;
                editor.chain().focus().setLink({ href, target: "_blank" }).run();
                setShowLinkInput(false);
                setLinkUrl("");
              }}
              className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              OK
            </button>
          </div>
        )}

        <Divider />

        {/* Color picker */}
        <div className="flex items-center gap-0.5">
          {COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                if (c.value) editor.chain().focus().setColor(c.value).run();
                else editor.chain().focus().unsetColor().run();
              }}
              title={c.label}
              className={`w-4 h-4 rounded-full border-2 transition ${
                editor.isActive("textStyle", { color: c.value || undefined })
                  ? "border-gray-600 scale-110"
                  : "border-transparent hover:border-gray-300"
              }`}
              style={{ backgroundColor: c.value || "#374151" }}
            />
          ))}
        </div>

        <Divider />

        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
        </ToolBtn>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_p]:my-1 [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror]:focus:outline-none"
      />
      {!editor.getText() && placeholder && (
        <p className="px-3 pb-3 text-sm text-gray-400 pointer-events-none -mt-8">{placeholder}</p>
      )}
    </div>
  );
}
