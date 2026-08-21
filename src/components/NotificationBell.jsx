import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function stripHtmlToText(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").trim();
}

const getRelativeTime = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1m" : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1h" : `${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d" : `${days}d`;
};

export default function NotificationBell() {
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const popRef = useRef(null);

  const load = useCallback(async (uid) => {
    if (!uid) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("message_mentions")
      .select("id, created_at, project_messages(id, body, track_id, track_stage_id, user_id, profiles(full_name), tracks(name))")
      .eq("user_id", uid)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setNotifications(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) load(uid);
    };
    init();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`mentions-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_mentions", filter: `user_id=eq.${userId}` }, () => {
        load(userId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const markRead = async (ids) => {
    if (ids.length === 0) return;
    await supabase.from("message_mentions").update({ read_at: new Date().toISOString() }).in("id", ids);
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
  };

  const goToMention = async (notif) => {
    const msg = notif.project_messages;
    if (!msg) { markRead([notif.id]); return; }
    setOpen(false);
    markRead([notif.id]);

    let stageId = msg.track_stage_id;
    if (!stageId) {
      const { data: td } = await supabase.rpc("get_track_detail", { p_track_id: msg.track_id });
      const stages = td?.stages || [];
      const current = stages.find(s => s.track_stage_id && s.status !== "done") || stages[stages.length - 1];
      stageId = current?.track_stage_id || null;
    }
    if (!stageId) return;

    navigate("/projects", {
      state: {
        activeTrackId: msg.track_id,
        selectedStageId: stageId,
        openTab: "conversation",
        _navToken: Date.now(),
      },
    });
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-darkblack-600 border border-bgray-200 dark:border-darkblack-400 rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-bgray-100 dark:border-darkblack-400">
            <span className="text-sm font-semibold text-darkblack-700 dark:text-white">Mentions</span>
            {unreadCount > 0 && (
              <button onClick={() => markRead(notifications.map(n => n.id))} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {loading && notifications.length === 0 ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-bgray-400 text-center py-8">No new mentions</p>
          ) : (
            notifications.map(n => {
              const msg = n.project_messages;
              const senderName = msg?.profiles?.full_name || "Someone";
              const projectName = msg?.tracks?.name || "a project";
              const preview = stripHtmlToText(msg?.body) || "(attachment)";
              return (
                <button
                  key={n.id}
                  onClick={() => goToMention(n)}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-bgray-50 dark:hover:bg-darkblack-500 border-b border-bgray-50 dark:border-darkblack-500 last:border-b-0 transition"
                >
                  <span className="shrink-0 w-2 h-2 mt-1.5 bg-primary rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-darkblack-700 dark:text-white">
                      <span className="font-semibold">{senderName}</span> mentioned you in <span className="font-medium">{projectName}</span>
                    </p>
                    <p className="text-xs text-bgray-500 dark:text-bgray-400 truncate mt-0.5">{preview}</p>
                    <p className="text-[11px] text-bgray-400 dark:text-bgray-500 mt-0.5">{getRelativeTime(n.created_at)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
