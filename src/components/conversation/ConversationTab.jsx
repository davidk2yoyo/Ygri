import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { sileo } from "sileo";
import MessageItem from "./MessageItem";
import MessageComposer from "./MessageComposer";

const PAGE_SIZE = 40;

const STAGE_STATUS_DOT = {
  done: "bg-green-500",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
};

export default function ConversationTab({ trackId, projectName, clientName }) {
  const [messages, setMessages] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [trackDetail, setTrackDetail] = useState(null);
  const [showContext, setShowContext] = useState(false);

  const listRef = useRef(null);
  const channelRef = useRef(null);

  const attachNames = useCallback((rows, names) => {
    return rows.map(m => ({ ...m, user_name: names[m.user_id]?.full_name }));
  }, []);

  const loadMessages = useCallback(async (names) => {
    const { data, error } = await supabase
      .from("project_messages")
      .select("*, message_attachments(*)")
      .eq("track_id", trackId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) { sileo.error({ title: "Could not load conversation", description: error.message }); return; }
    const ordered = (data || []).slice().reverse();
    setMessages(attachNames(ordered, names || profilesById));
    setHasMore((data || []).length === PAGE_SIZE);
  }, [trackId, profilesById, attachNames]);

  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const prevScrollHeight = el?.scrollHeight || 0;
    try {
      const oldest = messages[0].created_at;
      const { data, error } = await supabase
        .from("project_messages")
        .select("*, message_attachments(*)")
        .eq("track_id", trackId)
        .is("deleted_at", null)
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const older = (data || []).slice().reverse();
      setMessages(prev => [...attachNames(older, profilesById), ...prev]);
      setHasMore((data || []).length === PAGE_SIZE);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
      });
    } catch (e) {
      sileo.error({ title: "Could not load older messages", description: e.message });
    } finally {
      setLoadingOlder(false);
    }
  };

  // Initial load: current user, profiles map, track detail, first page of messages
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setCurrentUserId(session?.user?.id || null);

      const { data: profilesData } = await supabase.from("profiles").select("id, full_name");
      const names = Object.fromEntries((profilesData || []).map(p => [p.id, p]));
      if (cancelled) return;
      setProfilesById(names);

      const { data: td } = await supabase.rpc("get_track_detail", { p_track_id: trackId });
      if (!cancelled) setTrackDetail(td);

      await loadMessages(names);
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  // Realtime: any change to this project's messages triggers a refresh.
  // Simple and correct for a foundation pass — message volume per project
  // is small, so a full reload per event is cheap and avoids partial-join bugs.
  useEffect(() => {
    const channel = supabase
      .channel(`project-messages-${trackId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_messages", filter: `track_id=eq.${trackId}` }, () => {
        loadMessages();
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  // Auto-scroll to bottom on first load and when sending a new message
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };
  useEffect(() => { if (!loading) scrollToBottom(); }, [loading]);

  const handleSend = async ({ body, file }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { sileo.error({ title: "Not signed in" }); return; }

    const { data: inserted, error } = await supabase
      .from("project_messages")
      .insert({ track_id: trackId, user_id: userId, message_type: "message", body: body || null })
      .select()
      .single();
    if (error) { sileo.error({ title: "Could not send message", description: error.message }); return; }

    // Record any @mentions (stored inline in body as [@Name](mention:id)) for future notifications
    const mentionedIds = [...(body || "").matchAll(/\(mention:([a-f0-9-]+)\)/g)].map(m => m[1]);
    if (mentionedIds.length > 0) {
      await supabase.from("message_mentions").insert(
        [...new Set(mentionedIds)].map(uid => ({ message_id: inserted.id, user_id: uid }))
      );
    }

    if (file) {
      try {
        const path = `message-files/${trackId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("crm-files").upload(path, file);
        if (upErr) throw upErr;
        await supabase.from("message_attachments").insert({
          message_id: inserted.id, file_path: path, file_name: file.name, file_size: file.size,
        });
      } catch (e) {
        sileo.error({ title: "Message sent, but attachment failed", description: e.message });
      }
    }
    await loadMessages();
    scrollToBottom();
  };

  const handleSaveEdit = async (message, newBody) => {
    const { error } = await supabase
      .from("project_messages")
      .update({ body: newBody, edited_at: new Date().toISOString() })
      .eq("id", message.id);
    if (error) { sileo.error({ title: "Could not save edit", description: error.message }); return; }
    await loadMessages();
  };

  const handleDelete = async (message) => {
    if (!window.confirm("Delete this message?")) return;
    const { error } = await supabase
      .from("project_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", message.id);
    if (error) { sileo.error({ title: "Could not delete message", description: error.message }); return; }
    await loadMessages();
  };

  const stages = trackDetail?.stages || [];
  const currentStage = stages.find(s => s.track_stage_id && s.status !== "done") || stages[stages.length - 1];
  const openTodos = stages.reduce((sum, s) => sum + (s.status !== "done" ? (s.todos_count || 0) : 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Project context sidebar */}
      <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-bgray-100 dark:border-darkblack-400">
        <button
          onClick={() => setShowContext(v => !v)}
          className="md:hidden w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-darkblack-700 dark:text-white"
        >
          Project Context
          <svg className={`w-4 h-4 transition-transform ${showContext ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div className={`${showContext ? "block" : "hidden"} md:block px-4 py-4 space-y-4`}>
          <div>
            <p className="text-xs font-semibold text-bgray-400 uppercase tracking-wide mb-1">Project</p>
            <p className="text-sm font-semibold text-darkblack-700 dark:text-white">{projectName}</p>
            <p className="text-xs text-bgray-500 dark:text-bgray-400">{clientName}</p>
          </div>

          {currentStage && (
            <div>
              <p className="text-xs font-semibold text-bgray-400 uppercase tracking-wide mb-1">Current Stage</p>
              <p className="text-sm text-darkblack-700 dark:text-white">{currentStage.name}</p>
            </div>
          )}

          {openTodos > 0 && (
            <div>
              <p className="text-xs font-semibold text-bgray-400 uppercase tracking-wide mb-1">Open Todos</p>
              <p className="text-sm text-darkblack-700 dark:text-white">{openTodos} pending</p>
            </div>
          )}

          {stages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-bgray-400 uppercase tracking-wide mb-2">Stages</p>
              <div className="space-y-1.5">
                {stages.map(s => (
                  <div key={s.stage_template_id} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STAGE_STATUS_DOT[s.status] || "bg-bgray-300"}`} />
                    <span className="text-xs text-bgray-600 dark:text-bgray-300 truncate">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation feed */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {hasMore && (
            <div className="flex justify-center pb-3">
              <button onClick={loadOlder} disabled={loadingOlder} className="text-xs text-primary hover:underline disabled:opacity-50">
                {loadingOlder ? "Loading..." : "Load older messages"}
              </button>
            </div>
          )}
          {messages.length === 0 && (
            <p className="text-sm text-bgray-400 text-center py-10">No messages yet. Start the conversation below.</p>
          )}
          {messages.map(m => (
            <MessageItem key={m.id} message={m} currentUserId={currentUserId} onSaveEdit={handleSaveEdit} onDelete={handleDelete} />
          ))}
        </div>
        <MessageComposer onSend={handleSend} profiles={Object.values(profilesById)} />
      </div>
    </div>
  );
}
