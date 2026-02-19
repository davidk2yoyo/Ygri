import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";

const STATUS_FILTERS = ["all", "pending", "done", "overdue"];

const PRIORITY_COLORS = {
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function getTaskStatus(todo) {
  if (todo.is_done) return "done";
  if (todo.due_date && new Date(todo.due_date) < new Date()) return "overdue";
  return "pending";
}

function TaskRow({ todo, onToggle, busy }) {
  const status = getTaskStatus(todo);
  const isOverdue = status === "overdue";

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 hover:shadow-sm
        ${todo.is_done
          ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60"
          : isOverdue
          ? "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
        }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo.id, todo.is_done)}
        disabled={busy}
        className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors
          ${todo.is_done
            ? "bg-emerald-500 border-emerald-500"
            : "border-gray-300 dark:border-gray-600 hover:border-emerald-500"
          }`}
      >
        {todo.is_done && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${todo.is_done ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}>
          {todo.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {/* Client */}
          {todo.client_name && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {todo.client_name}
            </span>
          )}
          {/* Project */}
          {todo.track_name && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {todo.track_name}
            </span>
          )}
          {/* Stage */}
          {todo.stage_name && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              {todo.stage_name}
            </span>
          )}
          {/* Due date */}
          {todo.due_date && (
            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue && !todo.is_done ? "text-rose-600 dark:text-rose-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(todo.due_date).toLocaleDateString()}
            </span>
          )}
          {/* Creator */}
          {todo.creator_name && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {todo.creator_name}
            </span>
          )}
          {/* Assignee */}
          {todo.assignee_name && (
            <span className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {todo.assignee_name}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[status]}`}>
        {status}
      </span>
    </div>
  );
}

export default function TasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [newTask, setNewTask] = useState({ title: "", due_date: "" });
  const [projects, setProjects] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all tables separately and join in JS
      // track_stages has no name — name lives in stage_templates
      const [todosRes, stagesRes, templatesRes, tracksRes, clientsRes, profilesRes] = await Promise.all([
        supabase
          .from("stage_todos")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("track_stages")
          .select("id, track_id, stage_template_id"),
        supabase
          .from("stage_templates")
          .select("id, name"),
        supabase
          .from("tracks")
          .select("id, name, client_id"),
        supabase
          .from("clients")
          .select("id, company_name"),
        supabase
          .from("profiles")
          .select("id, full_name"),
      ]);

      if (todosRes.error) throw todosRes.error;
      if (stagesRes.error) throw stagesRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (tracksRes.error) throw tracksRes.error;

      const stageMap = Object.fromEntries((stagesRes.data || []).map((s) => [s.id, s]));
      const templateMap = Object.fromEntries((templatesRes.data || []).map((t) => [t.id, t]));
      const trackMap = Object.fromEntries((tracksRes.data || []).map((t) => [t.id, t]));
      const clientMap = Object.fromEntries((clientsRes.data || []).map((c) => [c.id, c]));
      const profileMap = Object.fromEntries((profilesRes.data || []).map((p) => [p.id, p]));

      const mapped = (todosRes.data || []).map((todo) => {
        const stage = stageMap[todo.track_stage_id] ?? {};
        const template = templateMap[stage.stage_template_id] ?? {};
        const track = trackMap[stage.track_id] ?? {};
        const client = clientMap[track.client_id] ?? {};
        const creatorId = todo.created_by ?? null;
        const assigneeId = todo.assignee_user_id ?? null;
        const creator = profileMap[creatorId] ?? {};
        const assignee = profileMap[assigneeId] ?? {};
        return {
          ...todo,
          stage_name: template.name ?? "",
          track_name: track.name ?? "",
          track_id: track.id ?? null,
          client_name: client.company_name ?? "",
          creator_name: creator.full_name ?? "",
          assignee_name: assignee.full_name ?? "",
        };
      });

      setTasks(mapped);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from("tracks")
      .select("id, name")
      .order("name");
    setProjects(data || []);
  }, []);

  const loadStagesForProject = useCallback(async (trackId) => {
    if (!trackId) { setStages([]); setSelectedStageId(""); return; }
    // track_stages has no name; join with stage_templates for the name
    const { data: tsData } = await supabase
      .from("track_stages")
      .select("id, stage_template_id, order_index")
      .eq("track_id", trackId)
      .order("order_index");

    if (!tsData?.length) { setStages([]); setSelectedStageId(""); return; }

    const templateIds = tsData.map((s) => s.stage_template_id).filter(Boolean);
    const { data: tplData } = await supabase
      .from("stage_templates")
      .select("id, name")
      .in("id", templateIds);

    const tplMap = Object.fromEntries((tplData || []).map((t) => [t.id, t]));
    const merged = tsData.map((s) => ({
      id: s.id,
      name: tplMap[s.stage_template_id]?.name ?? `Stage ${s.order_index}`,
    }));
    setStages(merged);
    setSelectedStageId("");
  }, []);

  useEffect(() => { loadTasks(); loadProjects(); }, [loadTasks, loadProjects]);

  useEffect(() => { loadStagesForProject(selectedProjectId); }, [selectedProjectId, loadStagesForProject]);

  const handleToggle = async (todoId, currentDone) => {
    try {
      setBusy(true);
      await supabase.rpc("update_stage_todo", { p_todo_id: todoId, p_done: !currentDone });
      await loadTasks();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim() || !selectedStageId) return;
    try {
      setBusy(true);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.rpc("add_stage_todo", {
        p_track_stage_id: selectedStageId,
        p_title: newTask.title.trim(),
        p_due: newTask.due_date || null,
        p_assignee: null,
        p_user: user.id,
      });
      setNewTask({ title: "", due_date: "" });
      setSelectedProjectId("");
      setSelectedStageId("");
      setShowAddForm(false);
      await loadTasks();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Filter & search
  const filtered = tasks.filter((t) => {
    const status = getTaskStatus(t);
    const matchFilter = filter === "all" || status === filter;
    const matchSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.track_name.toLowerCase().includes(search.toLowerCase()) ||
      t.stage_name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => getTaskStatus(t) === "pending").length,
    done: tasks.filter((t) => t.is_done).length,
    overdue: tasks.filter((t) => getTaskStatus(t) === "overdue").length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            All tasks across every project stage
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleAddTask} className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">New Task</h3>
          <input
            type="text"
            placeholder="Task title..."
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={!stages.length}
            >
              <option value="">Select stage...</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !newTask.title.trim() || !selectedStageId}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              Add Task
            </button>
          </div>
        </form>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`p-3 rounded-xl border text-left transition-all duration-200
              ${filter === f
                ? f === "overdue"
                  ? "bg-rose-500 border-rose-500 text-white shadow-md"
                  : f === "done"
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                  : f === "pending"
                  ? "bg-amber-500 border-amber-500 text-white shadow-md"
                  : "bg-blue-600 border-blue-600 text-white shadow-md"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-sm"
              }`}
          >
            <div className={`text-2xl font-bold ${filter === f ? "text-white" : "text-gray-900 dark:text-white"}`}>
              {counts[f]}
            </div>
            <div className={`text-xs capitalize mt-0.5 ${filter === f ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              {f}
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search tasks, projects, stages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((todo) => (
            <TaskRow key={todo.id} todo={todo} onToggle={handleToggle} busy={busy} />
          ))}
        </div>
      )}
    </div>
  );
}
