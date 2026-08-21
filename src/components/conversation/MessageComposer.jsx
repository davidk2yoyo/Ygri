import React, { useState, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { buildMessageExtensions } from "./messageEditorExtensions";
import MessageEditorToolbar from "./MessageEditorToolbar";

export default function MessageComposer({ onSend, disabled, profiles = [] }) {
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const composerRef = useRef(null);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const handleSendRef = useRef(() => {});

  const editor = useEditor({
    extensions: buildMessageExtensions(profilesRef, "Write a message..."),
    content: "",
    editorProps: {
      attributes: { class: "text-sm text-darkblack-700 dark:text-white outline-none min-h-[24px] [&_.ProseMirror-selectednode]:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_span[data-type=mention]]:bg-primary/10 [&_span[data-type=mention]]:text-primary [&_span[data-type=mention]]:font-medium [&_span[data-type=mention]]:px-1 [&_span[data-type=mention]]:rounded [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child]:before:text-bgray-400 [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:h-0" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSendRef.current();
          return true;
        }
        return false;
      },
    },
  });

  // Ctrl+V to paste an image straight into the message
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageFiles = items.filter(it => it.type.startsWith("image/")).map(it => it.getAsFile()).filter(Boolean);
      if (imageFiles.length === 0) return;
      e.preventDefault();
      setFiles(prev => [...prev, ...imageFiles]);
    };
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, []);

  const addFiles = (fileList) => {
    const arr = Array.from(fileList || []);
    if (arr.length > 0) setFiles(prev => [...prev, ...arr]);
  };

  const handleSend = async () => {
    if (sending || disabled || !editor) return;
    const isEmpty = editor.isEmpty;
    if (isEmpty && files.length === 0) return;
    setSending(true);
    try {
      const body = isEmpty ? "" : editor.getHTML();
      await onSend({ body, files });
      editor.commands.clearContent();
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      editor.commands.focus();
    } finally {
      setSending(false);
    }
  };
  handleSendRef.current = handleSend;

  if (!editor) return null;

  const canSend = !sending && !disabled && (!editor.isEmpty || files.length > 0);

  return (
    <div ref={composerRef} className="border-t border-bgray-100 dark:border-darkblack-400 p-3 bg-white dark:bg-darkblack-600">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => {
            const isImage = f.type.startsWith("image/");
            return (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-bgray-50 dark:bg-darkblack-500 rounded-lg text-xs max-w-[200px]">
                {isImage ? (
                  <img src={URL.createObjectURL(f)} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                ) : (
                  <svg className="w-3.5 h-3.5 text-bgray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
                <span className="truncate flex-1 text-bgray-600 dark:text-bgray-300">{f.name}</span>
                <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-bgray-400 hover:text-red-500 shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-1.5">
        <MessageEditorToolbar editor={editor} disabled={disabled} />
      </div>

      <div className="flex items-end gap-2 border border-bgray-200 dark:border-darkblack-400 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
        <div className="flex-1 min-w-0 max-h-40 overflow-y-auto message-composer-editor">
          <EditorContent editor={editor} />
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="shrink-0 p-1.5 text-bgray-400 hover:text-primary transition disabled:opacity-40"
          title="Attach photo or file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
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
