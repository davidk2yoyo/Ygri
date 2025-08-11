import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";

// Key Metrics Card Component
function MetricCard({ title, value, subtitle, icon, color = "blue", trend, onClick }) {
  return (
    <div 
      className={`bg-white dark:bg-darkblack-600 rounded-lg p-6 border border-bgray-200 dark:border-darkblack-400 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-bgray-600 dark:text-bgray-300 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-darkblack-700 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-bgray-500 dark:text-bgray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 flex items-center justify-center`}>
          <span className={`text-${color}-600 dark:text-${color}-400 text-xl`}>{icon}</span>
        </div>
      </div>
      {trend && (
        <div className="flex items-center mt-3">
          <span className={`text-xs font-medium ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-bgray-500'}`}>
            {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'} {Math.abs(trend)}% from last month
          </span>
        </div>
      )}
    </div>
  );
}

// Active Projects Widget
function ActiveProjectsWidget({ projects, onProjectClick }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-lg border border-bgray-200 dark:border-darkblack-400 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">{t("activeProjects")}</h3>
        <span className="text-xs text-bgray-500 bg-bgray-100 dark:bg-darkblack-500 px-2 py-1 rounded">
          {projects.length} {t("activeProjects").toLowerCase()}
        </span>
      </div>
      
      <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
        {projects.slice(0, 5).map((project) => (
          <div 
            key={project.track_id}
            className="p-3 border border-bgray-200 dark:border-darkblack-400 rounded-lg hover:bg-bgray-50 dark:hover:bg-darkblack-500 cursor-pointer transition-colors"
            onClick={() => onProjectClick(project.track_id)}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-darkblack-700 dark:text-white text-sm">{project.track_name}</h4>
              <span className="text-xs text-bgray-500">{project.client_name}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <div className="w-full bg-bgray-200 dark:bg-darkblack-400 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      project.progress_pct >= 80 ? 'bg-green-500' :
                      project.progress_pct >= 50 ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${project.progress_pct}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-xs font-medium text-darkblack-700 dark:text-white">
                {project.progress_pct}%
              </span>
            </div>
            
            {project.next_due_date && (
              <p className="text-xs text-bgray-500 mt-1">
                {t("nextDue")}: {project.next_due_date}
              </p>
            )}
          </div>
        ))}
        
        {projects.length === 0 && (
          <div className="text-center py-8 text-bgray-500">
            <div className="text-4xl mb-2">📋</div>
            <p>{t("noActiveProjects")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Recent Clients Widget
function RecentClientsWidget({ clients, onClientClick, onAddClient }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-lg border border-bgray-200 dark:border-darkblack-400 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">{t("recentClients")}</h3>
        <button
          onClick={onAddClient}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
        >
          {t("addClient")}
        </button>
      </div>
      
      <div className="space-y-3">
        {clients.slice(0, 5).map((client) => (
          <div 
            key={client.id}
            className="flex items-center justify-between p-3 border border-bgray-200 dark:border-darkblack-400 rounded-lg hover:bg-bgray-50 dark:hover:bg-darkblack-500 cursor-pointer transition-colors"
            onClick={() => onClientClick(client.id)}
          >
            <div>
              <h4 className="font-medium text-darkblack-700 dark:text-white text-sm">{client.company_name}</h4>
              <p className="text-xs text-bgray-500">{client.contact_person || client.email || t("noContactInfo")}</p>
            </div>
            <div className="text-xs text-bgray-500">
              {new Date(client.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
        
        {clients.length === 0 && (
          <div className="text-center py-8 text-bgray-500">
            <div className="text-4xl mb-2">👥</div>
            <p>{t("noClientsYet")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Calendar Widget with Todo Integration
function CalendarWidget({ todos, onDateClick }) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  
  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  
  // Create calendar grid
  const calendarDays = [];
  const totalCells = Math.ceil((daysInMonth + startingDayOfWeek) / 7) * 7;
  
  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - startingDayOfWeek + 1;
    const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
    const date = isValidDay ? new Date(currentYear, currentMonth, dayNumber) : null;
    const dateString = date ? date.toISOString().split('T')[0] : null;
    
    // Find todos for this date
    const dayTodos = dateString ? todos.filter(todo => 
      todo.due_date && todo.due_date.startsWith(dateString)
    ) : [];
    
    const isToday = date && date.toDateString() === today.toDateString();
    const hasOverdue = dayTodos.some(todo => date < today && !todo.is_done);
    const hasDueToday = dayTodos.some(todo => isToday);
    const hasUpcoming = dayTodos.some(todo => date > today);
    
    calendarDays.push({
      dayNumber: isValidDay ? dayNumber : null,
      date,
      dateString,
      todos: dayTodos,
      isToday,
      hasOverdue,
      hasDueToday,
      hasUpcoming,
      isValidDay
    });
  }
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentYear, currentMonth + direction, 1));
  };
  
  const handleDateClick = (day) => {
    if (day.isValidDay && day.todos.length > 0) {
      setSelectedDate(day);
      onDateClick?.(day);
    }
  };
  
  return (
    <div className="bg-white dark:bg-darkblack-600 rounded-lg border border-bgray-200 dark:border-darkblack-400 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">{t("todoCalendar")}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded"
          >
            <svg className="w-4 h-4 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-darkblack-700 dark:text-white min-w-[120px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded"
          >
            <svg className="w-4 h-4 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-bgray-500 dark:text-bgray-400 p-2">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((day, index) => (
          <div 
            key={index}
            className={`relative p-2 text-center text-sm cursor-pointer transition-colors min-h-[32px] flex items-center justify-center ${
              !day.isValidDay ? 'text-bgray-300 dark:text-bgray-600' :
              day.isToday ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold rounded' :
              day.todos.length > 0 ? 'hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded' :
              'text-darkblack-700 dark:text-white hover:bg-bgray-50 dark:hover:bg-darkblack-500 rounded'
            }`}
            onClick={() => handleDateClick(day)}
          >
            {day.dayNumber}
            
            {/* Todo indicators */}
            {day.todos.length > 0 && (
              <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                {day.hasOverdue && <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                {day.hasDueToday && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>}
                {day.hasUpcoming && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-bgray-600 dark:text-bgray-300">{t("overdue")}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <span className="text-bgray-600 dark:text-bgray-300">{t("dueToday")}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-bgray-600 dark:text-bgray-300">{t("upcoming")}</span>
        </div>
      </div>
    </div>
  );
}

// Todo Details Modal
function TodoDetailsModal({ selectedDate, todos, onClose }) {
  const { t } = useTranslation();
  if (!selectedDate) return null;
  
  console.log("Modal - selectedDate:", selectedDate.dateString);
  console.log("Modal - all todos:", todos);
  
  const dateTodos = todos.filter(todo => 
    todo.due_date && todo.due_date.startsWith(selectedDate.dateString)
  );
  
  console.log("Modal - filtered todos for date:", dateTodos);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-darkblack-600 rounded-lg border border-bgray-200 dark:border-darkblack-400 p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">
            {t("todosFor", { date: selectedDate.dateString })}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded"
          >
            <svg className="w-5 h-5 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {dateTodos.map((todo) => (
            <div key={todo.id} className="p-3 border border-bgray-200 dark:border-darkblack-400 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${
                  todo.is_done ? 'bg-green-500' : 
                  todo.due_date < new Date().toISOString().split('T')[0] ? 'bg-red-500' :
                  'bg-blue-500'
                }`}></div>
                <h4 className={`font-medium text-sm ${
                  todo.is_done ? 'line-through text-gray-500' : 'text-darkblack-700 dark:text-white'
                }`}>
                  {todo.title}
                </h4>
              </div>
              <p className="text-xs text-bgray-500 mb-1">
                {t("due")}: {todo.due_date}
              </p>
              <p className="text-xs text-bgray-400">
                Stage ID: {todo.track_stage_id}
              </p>
            </div>
          ))}
          
          {dateTodos.length === 0 && (
            <div className="text-center py-8 text-bgray-500">
              <div className="text-4xl mb-2">📅</div>
              <p>{t("noTodosForDate")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState({
    projects: [],
    clients: [],
    todos: [],
    metrics: {
      activeProjects: 0,
      totalClients: 0,
      avgProgress: 0,
      overdueItems: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDateForTodos, setSelectedDateForTodos] = useState(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch projects overview
      const { data: projects, error: projectsError } = await supabase
        .from("v_tracks_overview")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (projectsError) throw projectsError;

      // Fetch recent clients
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (clientsError) throw clientsError;

      // Try multiple approaches to fetch todos
      let todos = [];
      const possibleTableNames = ["stage_todos", "track_stage_todos", "todos"];
      
      // First approach: try direct table queries
      for (const tableName of possibleTableNames) {
        try {
          console.log(`Trying to fetch from table: ${tableName}`);
          const { data: todosData, error: todosError } = await supabase
            .from(tableName)
            .select("*")
            .not("due_date", "is", null)
            .order("due_date", { ascending: true });
          
          if (!todosError && todosData && todosData.length > 0) {
            console.log(`Success! Found ${todosData.length} todos in table: ${tableName}`);
            console.log("Sample todo:", todosData[0]);
            todos = todosData;
            break;
          } else if (todosError) {
            console.log(`Error with table ${tableName}:`, todosError.message);
          } else {
            console.log(`Table ${tableName} exists but has no todos with due dates`);
          }
        } catch (err) {
          console.log(`Exception with table ${tableName}:`, err.message);
        }
      }
      
      // Second approach: if no direct table access works, try getting from one project's detail
      if (todos.length === 0 && projects && projects.length > 0) {
        console.log("Trying to get todos from project details...");
        try {
          const { data: trackDetail, error: trackError } = await supabase
            .rpc("get_track_detail", { p_track_id: projects[0].track_id });
          
          if (!trackError && trackDetail?.stages) {
            console.log("Got track detail, extracting todos...");
            for (const stage of trackDetail.stages) {
              if (stage.todos && Array.isArray(stage.todos)) {
                stage.todos.forEach(todo => {
                  if (todo.due_date) {
                    todos.push({
                      ...todo,
                      stage_name: stage.name,
                      project_name: trackDetail.track.name,
                      client_name: trackDetail.client?.company_name
                    });
                  }
                });
              }
            }
            console.log(`Found ${todos.length} todos from project details`);
          }
        } catch (err) {
          console.error("Error fetching from project details:", err);
        }
      }
      
      console.log("Final todos array:", todos);
      console.log("Final todos count:", todos.length);

      // Calculate metrics
      const activeProjects = projects?.filter(p => p.progress_pct < 100).length || 0;
      const totalClients = clients?.length || 0;
      const avgProgress = projects?.length ? 
        projects.reduce((sum, p) => sum + (p.progress_pct || 0), 0) / projects.length : 0;
      // Calculate overdue items based on todos
      const today = new Date().toISOString().split('T')[0];
      const overdueItems = todos.filter(t => t.due_date < today && !t.is_done).length;

      setDashboardData({
        projects: projects || [],
        clients: clients || [],
        todos: todos || [],
        metrics: {
          activeProjects,
          totalClients,
          avgProgress: Math.round(avgProgress),
          overdueItems
        }
      });

    } catch (err) {
      setError(err.message);
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleProjectClick = (projectId) => {
    navigate('/projects');
  };

  const handleClientClick = (clientId) => {
    navigate('/clients');
  };

  const handleAddClient = () => {
    navigate('/clients');
  };

  const handleDateClick = (day) => {
    if (day.todos.length > 0) {
      setSelectedDateForTodos(day);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-4"></div>
            <span className="text-bgray-600 dark:text-bgray-300">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 font-urbanist">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-darkblack-700 dark:text-white mb-2">{t("dashboard")}</h1>
          <p className="text-bgray-600 dark:text-bgray-300">{t("overviewText")}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Active Projects"
            value={dashboardData.metrics.activeProjects}
            icon="📋"
            color="blue"
            onClick={() => navigate('/projects')}
          />
          <MetricCard
            title="Total Clients"
            value={dashboardData.metrics.totalClients}
            icon="👥"
            color="green"
            onClick={() => navigate('/clients')}
          />
          <MetricCard
            title="Avg Progress"
            value={`${dashboardData.metrics.avgProgress}%`}
            icon="📊"
            color="purple"
          />
          <MetricCard
            title="Overdue Items"
            value={dashboardData.metrics.overdueItems}
            icon="⚠️"
            color="red"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <ActiveProjectsWidget
              projects={dashboardData.projects}
              onProjectClick={handleProjectClick}
            />
          </div>

          {/* Center Column */}
          <div className="space-y-6">
            <CalendarWidget
              todos={dashboardData.todos}
              onDateClick={handleDateClick}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <RecentClientsWidget
              clients={dashboardData.clients}
              onClientClick={handleClientClick}
              onAddClient={handleAddClient}
            />
          </div>
        </div>
        
        {/* Todo Details Modal */}
        <TodoDetailsModal
          selectedDate={selectedDateForTodos}
          todos={dashboardData.todos}
          onClose={() => setSelectedDateForTodos(null)}
        />
      </div>
    </div>
  );
}