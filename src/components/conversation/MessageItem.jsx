import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "../../supabaseClient";

const AVATAR_COLORS = ["from-purple-400 to-pink-400", "from-blue-400 to-cyan-400", "from-emerald-400 to-teal-400", "from-orange-400 to-rose-400", "from-indigo-400 to-violet-400"];

const messageMarkdownComponents = {
  p: (props) => <p className="text-sm text-bgray-700 dark:text-bgray-200 leading-relaxed mb-1.5 last:mb-0" {...props} />,
  strong: (props) => <strong className="font-semibold text-darkblack-700 dark:text-white" {...props} />,
  em: (props) => <em {...props} />,
  ul: (props) => <ul className="list-disc list-outside pl-5 space-y-0.5 mb-1.5 marker:text-bgray-400" {...props} />,
  ol: (props) => <ol className="list-decimal list-outside pl-5 space-y-0.5 mb-1.5" {...props} />,
  li: (props) => <li className="text-sm text-bgray-700 dark:text-bgray-200" {...props} />,
  code: (props) => <code className="px-1 py-0.5 bg-bgray-100 dark:bg-darkblack-500 rounded text-xs font-mono" {...props} />,
  a: ({ href, children, ...props }) => {
    if (href?.startsWith("mention:")) {
      return <span className="bg-primary/10 text-primary font-medium px-1 rounded">{children}</span>;
    }
    return <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline" {...props}>{children}</a>;
  },
};

const getRelativeTime = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1m" : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1h" : `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1d" : `${days}d`;
  return new Date(date).toLocaleDateString();
};

function systemEventText(metadata = {}) {
  switch (metadata.event) {
    case "stage_changed":
      return `Stage changed: ${metadata.from || "—"} → ${metadata.to || "—"}`;
    case "stage_completed":
      return `✅ Stage completed: ${metadata.stage || "—"}`;
    case "quotation_updated":
      return `${metadata.quote_number || "Quotation"} updated${metadata.from_total != null && metadata.to_total != null ? `: ${metadata.currency || ""} ${Number(metadata.from_total).toLocaleString("en-US", { minimumFractionDigits: 2 })} → ${metadata.currency || ""} ${Number(metadata.to_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}`;
    default:
      return metadata.label || "Activity update";
  }
}

function fileUrl(filePath) {
  const { data } = supabase.storage.from("crm-files").getPublicUrl(filePath);
  return data.publicUrl;
}

export default function MessageItem({ message, currentUserId, onSaveEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.body || "");
  const [saving, setSaving] = useState(false);

  if (message.message_type === "system_event") {
    return (
      <div className="flex items-center gap-2 py-1.5 px-1">
        <span className="text-xs shrink-0">⚙️</span>
        <span className="text-xs text-bgray-500 dark:text-bgray-400">{systemEventText(message.metadata)}</span>
        <span className="text-[10px] text-bgray-300 dark:text-bgray-600 ml-auto shrink-0">{getRelativeTime(message.created_at)}</span>
      </div>
    );
  }

  const userName = message.user_name || "Unknown";
  const initials = userName.slice(0, 2).toUpperCase();
  const colorClass = AVATAR_COLORS[userName.charCodeAt(0) % AVATAR_COLORS.length];
  const isOwn = message.user_id === currentUserId;
  const isAI = message.message_type === "ai_message";

  const handleSave = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      await onSaveEdit(message, draft.trim());
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2.5 px-1 group hover:bg-bgray-50 dark:hover:bg-darkblack-500/40 rounded-lg transition-colors">
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${isAI ? "bg-gradient-to-br from-primary to-indigo-500" : `bg-gradient-to-br ${colorClass}`}`}>
        <span className="text-white text-xs font-semibold">{isAI ? "AI" : initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-darkblack-700 dark:text-white">{isAI ? "Ygri AI" : userName}</span>
          <span className="text-[11px] text-bgray-400 dark:text-bgray-500">{getRelativeTime(message.created_at)}</span>
          {message.edited_at && <span className="text-[11px] text-bgray-300 dark:text-bgray-600">(edited)</span>}
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm resize-none bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving || !draft.trim()} className="text-xs font-semibold text-primary hover:underline disabled:opacity-40">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => { setIsEditing(false); setDraft(message.body || ""); }} className="text-xs text-bgray-400 hover:text-bgray-600 dark:hover:text-bgray-300">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.body && (
              <div className="mt-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={messageMarkdownComponents}>{message.body}</ReactMarkdown>
              </div>
            )}
            {message.message_attachments?.length > 0 && (
              <div className="mt-1.5 space-y-1.5">
                {message.message_attachments.map(att => (
                  <a
                    key={att.id}
                    href={fileUrl(att.file_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-2.5 py-2 bg-bgray-50 dark:bg-darkblack-500 border border-bgray-100 dark:border-darkblack-400 rounded-lg text-xs hover:border-primary transition max-w-xs"
                  >
                    <span className="shrink-0">📄</span>
                    <span className="truncate text-darkblack-700 dark:text-white">{att.file_name}</span>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {isOwn && !isEditing && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
          <button onClick={() => setIsEditing(true)} className="text-bgray-400 hover:text-primary p-1" title="Edit">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={() => onDelete(message)} className="text-bgray-400 hover:text-red-500 p-1" title="Delete">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
