import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";

// ─── Animated Counter ────────────────────────────────────────────
function useCounter(target, duration = 1200) {
  const [count, setCount] = useState(0);
  const startTime = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startTime.current = null;
    const animate = (timestamp) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [target, duration]);

  return count;
}

// ─── Metric Card ──────────────────────────────────────────────────
const METRIC_CONFIGS = {
  projects: {
    gradient: "from-blue-500 to-indigo-600",
    glow: "shadow-blue-500/25",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  clients: {
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/25",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  progress: {
    gradient: "from-violet-500 to-purple-600",
    glow: "shadow-violet-500/25",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  overdue: {
    gradient: "from-orange-500 to-red-500",
    glow: "shadow-orange-500/25",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
};

function MetricCard({ type, title, value, suffix = "", onClick }) {
  const cfg = METRIC_CONFIGS[type];
  const numericValue = typeof value === "number" ? value : parseInt(value) || 0;
  const animated = useCounter(numericValue);
  const displayValue = suffix ? `${animated}${suffix}` : animated;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cfg.gradient} ${cfg.glow} shadow-lg shadow-lg/50 p-5 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${onClick ? "cursor-pointer" : ""}`}
    >
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
      <div className="absolute -bottom-8 -left-4 w-40 h-40 bg-white/5 rounded-full" />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-white/70 text-sm font-medium">{title}</p>
          <p className="text-4xl font-bold mt-1 tracking-tight">{displayValue}</p>
        </div>
        <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
          {cfg.icon}
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────
function SectionHeader({ title, badge, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-darkblack-700 dark:text-white">{title}</h3>
        {badge && (
          <span className="text-xs font-semibold bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Active Projects Widget ──────────────────────────────────────
function ActiveProjectsWidget({ projects, onProjectClick }) {
  const { t } = useTranslation();
  const active = projects.filter(p => p.track_status !== "cancelled" && p.progress_pct < 100);

  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-100 dark:border-darkblack-400 p-5 shadow-sm">
      <SectionHeader title={t("activeProjects")} badge={`${active.length} active`} />
      <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
        {active.slice(0, 6).map((project) => {
          const pct = Number(project.progress_pct) || 0;
          const color = pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-blue-500" : "bg-violet-500";
          return (
            <div
              key={project.track_id}
              onClick={() => onProjectClick(project.track_id)}
              className="group flex items-center gap-3 p-3 rounded-xl bg-bgray-50 dark:bg-darkblack-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 cursor-pointer"
            >
              {/* Progress ring */}
              <div className="flex-shrink-0 relative w-10 h-10">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke={pct >= 75 ? "#10b981" : pct >= 40 ? "#3b82f6" : "#8b5cf6"} strokeWidth="3" strokeDasharray={`${pct * 0.942} 94.2`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-darkblack-700 dark:text-white">{pct}%</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-darkblack-700 dark:text-white truncate">{project.track_name}</p>
                <p className="text-xs text-bgray-500 dark:text-bgray-400">{project.client_name}</p>
              </div>

              {/* Arrow on hover */}
              <svg className="w-4 h-4 text-bgray-300 dark:text-bgray-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          );
        })}
        {active.length === 0 && (
          <div className="text-center py-10 text-bgray-400 text-sm">No active projects</div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Widget ──────────────────────────────────────────────
function CalendarWidget({ todos, onDateClick }) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const calendarDays = [];
  const totalCells = Math.ceil((daysInMonth + startingDayOfWeek) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - startingDayOfWeek + 1;
    const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
    const date = isValidDay ? new Date(currentYear, currentMonth, dayNumber) : null;
    const dateString = date ? date.toISOString().split("T")[0] : null;
    const dayTodos = dateString ? todos.filter((todo) => todo.due_date && todo.due_date.startsWith(dateString)) : [];
    const isToday = date && date.toDateString() === today.toDateString();
    const hasOverdue = dayTodos.some(() => date < today);
    const hasUpcoming = dayTodos.some(() => date >= today);

    calendarDays.push({ dayNumber: isValidDay ? dayNumber : null, date, dateString, todos: dayTodos, isToday, hasOverdue, hasUpcoming, isValidDay });
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-100 dark:border-darkblack-400 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-darkblack-700 dark:text-white">{t("todoCalendar")}</h3>
        <div className="flex items-center gap-1 bg-bgray-100 dark:bg-darkblack-500 rounded-lg px-1 py-0.5">
          <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="p-1 hover:bg-white dark:hover:bg-darkblack-400 rounded-md transition-colors">
            <svg className="w-3.5 h-3.5 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-xs font-semibold text-darkblack-700 dark:text-white px-1">{monthNames[currentMonth].slice(0, 3)} {currentYear}</span>
          <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="p-1 hover:bg-white dark:hover:bg-darkblack-400 rounded-md transition-colors">
            <svg className="w-3.5 h-3.5 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-bgray-400 dark:text-bgray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => (
          <button
            key={i}
            onClick={() => day.isValidDay && day.todos.length > 0 && onDateClick?.(day)}
            className={`relative flex flex-col items-center justify-center rounded-lg transition-all duration-150 text-xs
              ${!day.isValidDay ? "opacity-0 pointer-events-none" : ""}
              ${day.isToday ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/30" : "text-darkblack-600 dark:text-bgray-300 hover:bg-bgray-100 dark:hover:bg-darkblack-500"}
              ${day.todos.length > 0 && !day.isToday ? "font-semibold" : ""}
            `}
            style={{ minHeight: "32px" }}
          >
            {day.dayNumber}
            {/* Dot indicators */}
            {day.todos.length > 0 && (
              <div className="flex gap-0.5 mt-0.5">
                {day.hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                {day.hasUpcoming && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-bgray-100 dark:border-darkblack-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-bgray-500 dark:text-bgray-400">{t("overdue")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-bgray-500 dark:text-bgray-400">{t("upcoming")}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Latest Todos Widget ──────────────────────────────────────────
function LatestTodosWidget({ todos, projects, onTodoClick }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split("T")[0];
  const recentTodos = todos.sort((a, b) => new Date(b.created_at || b.due_date) - new Date(a.created_at || a.due_date)).slice(0, 5);

  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-100 dark:border-darkblack-400 p-5 shadow-sm">
      <SectionHeader title="Latest To-do's" badge={`${recentTodos.length} items`} />
      <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
        {recentTodos.map((todo) => {
          const isOverdue = todo.due_date && todo.due_date < today && !todo.is_done;
          const isDueToday = todo.due_date === today;
          const project = projects.find((p) => p.track_id === todo.track_id);

          return (
            <div
              key={todo.id}
              onClick={() => onTodoClick?.(todo)}
              className="group flex items-start gap-3 p-3 rounded-xl bg-bgray-50 dark:bg-darkblack-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 border border-transparent hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200 cursor-pointer"
            >
              {/* Priority dot */}
              <div className={`flex-shrink-0 mt-1 w-2.5 h-2.5 rounded-full ${isOverdue ? "bg-red-500 shadow-sm shadow-red-500/50" : isDueToday ? "bg-orange-500 shadow-sm shadow-orange-500/50" : "bg-blue-500"}`} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-darkblack-700 dark:text-white truncate">{todo.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {project && <span className="text-xs text-bgray-500 dark:text-bgray-400 truncate">{project.track_name}</span>}
                  {todo.due_date && (
                    <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : isDueToday ? "text-orange-600" : "text-bgray-400"}`}>
                      • {todo.due_date}
                    </span>
                  )}
                </div>
              </div>

              <svg className="w-4 h-4 text-bgray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          );
        })}
        {recentTodos.length === 0 && (
          <div className="text-center py-10 text-bgray-400 text-sm">No todos yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Latest Comments Widget ──────────────────────────────────────
function LatestCommentsWidget({ comments, projects, onCommentClick }) {
  const { t } = useTranslation();
  const recentComments = comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);

  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-100 dark:border-darkblack-400 p-5 shadow-sm">
      <SectionHeader title={t("latestComments")} badge={`${recentComments.length} comments`} />
      <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
        {recentComments.map((comment) => {
          const project = projects.find((p) => p.track_id === comment.track_id);
          const initials = (comment.user_name || "U").slice(0, 2).toUpperCase();

          return (
            <div
              key={comment.id}
              onClick={() => onCommentClick?.(comment)}
              className="group flex items-start gap-3 p-3 rounded-xl bg-bgray-50 dark:bg-darkblack-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-200 cursor-pointer"
            >
              {/* Avatar */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-xs text-darkblack-700 dark:text-white">{comment.user_name || "Unknown"}</p>
                  <p className="text-[10px] text-bgray-400">{new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                <p className="text-xs text-bgray-600 dark:text-bgray-300 mt-0.5 line-clamp-2">{comment.body}</p>
                {project && <p className="text-[10px] text-bgray-400 mt-1">{project.track_name} • {project.client_name}</p>}
              </div>
            </div>
          );
        })}
        {recentComments.length === 0 && (
          <div className="text-center py-10 text-bgray-400 text-sm">No comments yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Recent Clients Widget ───────────────────────────────────────
function RecentClientsWidget({ clients, onClientClick, onAddClient }) {
  const { t } = useTranslation();

  // Color palette for client avatars
  const avatarColors = [
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-violet-500 to-purple-600",
    "from-orange-500 to-red-500",
    "from-cyan-500 to-blue-600",
  ];

  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-100 dark:border-darkblack-400 p-5 shadow-sm">
      <SectionHeader title={t("recentClients")}>
        <button
          onClick={onAddClient}
          className="text-xs font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1.5 rounded-lg hover:shadow-md hover:shadow-blue-500/30 transition-all duration-200"
        >
          + {t("addClient")}
        </button>
      </SectionHeader>

      <div className="space-y-2">
        {clients.slice(0, 5).map((client, i) => {
          const initials = (client.company_name || "C").slice(0, 2).toUpperCase();
          return (
            <div
              key={client.id}
              onClick={() => onClientClick(client.id)}
              className="group flex items-center gap-3 p-3 rounded-xl bg-bgray-50 dark:bg-darkblack-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 cursor-pointer"
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-darkblack-700 dark:text-white truncate">{client.company_name}</p>
                <p className="text-xs text-bgray-500 dark:text-bgray-400">{client.contact_person || client.email || t("noContactInfo")}</p>
              </div>
              <svg className="w-4 h-4 text-bgray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          );
        })}
        {clients.length === 0 && (
          <div className="text-center py-10 text-bgray-400 text-sm">No clients yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Todo Details Modal ──────────────────────────────────────────
function TodoDetailsModal({ selectedDate, todos, onClose }) {
  if (!selectedDate) return null;
  const dateTodos = todos.filter((todo) => todo.due_date && todo.due_date.startsWith(selectedDate.dateString));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-100 dark:border-darkblack-400 shadow-2xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-darkblack-700 dark:text-white">Todos for {selectedDate.dateString}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-bgray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {dateTodos.map((todo) => (
            <div key={todo.id} className="flex items-start gap-2.5 p-3 bg-bgray-50 dark:bg-darkblack-500 rounded-xl">
              <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${todo.is_done ? "bg-emerald-500" : todo.due_date < new Date().toISOString().split("T")[0] ? "bg-red-500" : "bg-blue-500"}`} />
              <div>
                <p className={`text-sm font-semibold ${todo.is_done ? "line-through text-bgray-400" : "text-darkblack-700 dark:text-white"}`}>{todo.title}</p>
                <p className="text-xs text-bgray-400 mt-0.5">Due: {todo.due_date}</p>
              </div>
            </div>
          ))}
          {dateTodos.length === 0 && <p className="text-center text-bgray-400 text-sm py-6">No todos for this date</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState({
    projects: [],
    clients: [],
    todos: [],
    comments: [],
    metrics: { activeProjects: 0, totalClients: 0, avgProgress: 0, overdueItems: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDateForTodos, setSelectedDateForTodos] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const { data: projects, error: projectsError } = await supabase.from("v_tracks_overview").select("*").order("created_at", { ascending: false });
      if (projectsError) throw projectsError;

      const { data: clients, error: clientsError } = await supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(10);
      if (clientsError) throw clientsError;

      let todos = [];
      let comments = [];

      const projectDetails = {};
      for (const project of (projects || []).slice(0, 5)) {
        try {
          const { data: trackDetail } = await supabase.rpc("get_track_detail", { p_track_id: project.track_id });
          if (trackDetail) projectDetails[project.track_id] = trackDetail;
        } catch (err) {
          console.error(`Error fetching details for ${project.track_id}:`, err);
        }
      }

      const stageToTrackMap = {};
      const userMap = {};
      Object.entries(projectDetails).forEach(([trackId, trackDetail]) => {
        if (trackDetail.stages) {
          trackDetail.stages.forEach((stage) => {
            stageToTrackMap[stage.track_stage_id] = trackId;
            if (stage.comments && Array.isArray(stage.comments)) {
              stage.comments.forEach((comment) => {
                if (comment.user_id && comment.user_name) userMap[comment.user_id] = comment.user_name;
              });
            }
          });
        }
      });

      let currentUser = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
        if (currentUser) userMap[currentUser.id] = currentUser.email?.split("@")[0] || "You";
      } catch (err) {}

      try {
        const { data: todosData } = await supabase.from("stage_todos").select("*").order("created_at", { ascending: false });
        if (todosData) {
          todos = todosData.filter((todo) => !todo.is_done).map((todo) => ({ ...todo, track_id: stageToTrackMap[todo.track_stage_id] }));
        }
      } catch (err) {}

      try {
        const { data: commentsData } = await supabase.from("stage_comments").select("*").order("created_at", { ascending: false });
        if (commentsData) {
          comments = commentsData.map((comment) => {
            const userId = comment.user_id || comment.assignee_user_id;
            let userName = userMap[userId];
            if (!userName) userName = userId === currentUser?.id ? currentUser?.email?.split("@")[0] || "You" : "Unknown User";
            return { ...comment, track_id: stageToTrackMap[comment.track_stage_id], user_name: userName };
          });
        }
      } catch (err) {}

      const activeProjects = (projects || []).filter((p) => p.progress_pct < 100).length;
      const totalClients = clients?.length || 0;
      const avgProgress = (projects || []).length ? (projects || []).reduce((sum, p) => sum + (p.progress_pct || 0), 0) / (projects || []).length : 0;
      const today = new Date().toISOString().split("T")[0];
      const overdueItems = todos.filter((t) => t.due_date < today && !t.is_done).length;

      setDashboardData({
        projects: projects || [],
        clients: clients || [],
        todos,
        comments,
        metrics: { activeProjects, totalClients, avgProgress: Math.round(avgProgress), overdueItems },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const handleProjectClick = () => navigate("/projects");
  const handleClientClick = () => navigate("/clients");
  const handleTodoClick = (todo) => {
    if (todo.track_id && todo.track_stage_id) navigate("/projects", { state: { activeTrackId: todo.track_id, selectedStageId: todo.track_stage_id } });
    else navigate("/projects");
  };
  const handleCommentClick = (comment) => {
    if (comment.track_id && comment.track_stage_id) navigate("/projects", { state: { activeTrackId: comment.track_id, selectedStageId: comment.track_stage_id } });
    else navigate("/projects");
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </div>
          <span className="text-bgray-500 dark:text-bgray-300 font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 font-urbanist min-h-screen bg-bgray-50 dark:bg-darkblack-700">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-darkblack-700 dark:text-white">{t("dashboard")}</h1>
          <p className="text-bgray-500 dark:text-bgray-400 mt-1">{t("overviewText")}</p>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">{error}</div>}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard type="projects" title="Active Projects" value={dashboardData.metrics.activeProjects} onClick={() => navigate("/projects")} />
          <MetricCard type="clients" title="Total Clients" value={dashboardData.metrics.totalClients} onClick={() => navigate("/clients")} />
          <MetricCard type="progress" title="Avg Progress" value={dashboardData.metrics.avgProgress} suffix="%" />
          <MetricCard type="overdue" title="Overdue Items" value={dashboardData.metrics.overdueItems} />
        </div>

        {/* Main grid: 2 col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            <ActiveProjectsWidget projects={dashboardData.projects} onProjectClick={handleProjectClick} />
            <LatestTodosWidget todos={dashboardData.todos} projects={dashboardData.projects} onTodoClick={handleTodoClick} />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <CalendarWidget todos={dashboardData.todos} onDateClick={setSelectedDateForTodos} />
            <LatestCommentsWidget comments={dashboardData.comments} projects={dashboardData.projects} onCommentClick={handleCommentClick} />
            <RecentClientsWidget clients={dashboardData.clients} onClientClick={handleClientClick} onAddClient={handleAddClient} />
          </div>
        </div>

        <TodoDetailsModal selectedDate={selectedDateForTodos} todos={dashboardData.todos} onClose={() => setSelectedDateForTodos(null)} />
      </div>
    </div>
  );

  function handleAddClient() { navigate("/clients"); }
}
