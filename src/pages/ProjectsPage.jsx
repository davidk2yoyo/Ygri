import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "../supabaseClient";
import StageDrawer from "../StageDrawer";

// Vertical Stepper View Component
function VerticalStepperView({ stages, onStageClick }) {
  if (!stages?.length) {
    return (
      <div className="flex items-center justify-center py-12 text-bgray-500 h-full">
        No stages available
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-bgray-200 dark:bg-darkblack-400"></div>
        
        <div className="space-y-8 pb-6">
          {stages.map((stage, index) => (
            <div key={stage.track_stage_id} className="relative flex items-start">
              {/* Step indicator */}
              <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 ${
                stage.status === "done" ? "bg-green-500 border-green-500" :
                stage.status === "in_progress" ? "bg-blue-500 border-blue-500" :
                stage.status === "blocked" ? "bg-red-500 border-red-500" : 
                "bg-gray-300 border-gray-300"
              }`}>
                <span className="text-white font-semibold text-sm">{stage.order_index}</span>
              </div>
              
              {/* Content */}
              <div className="ml-6 flex-1">
                <button
                  onClick={() => onStageClick(stage.track_stage_id)}
                  className="w-full text-left p-4 bg-white dark:bg-darkblack-600 rounded-lg border border-bgray-200 dark:border-darkblack-400 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-darkblack-700 dark:text-white mb-2">
                    {stage.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-bgray-600 dark:text-bgray-300">
                    <span className="capitalize">{stage.status.replace("_", " ")}</span>
                    {stage.due_date && <span>Due: {stage.due_date}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-bgray-500">
                    <span>📎 {stage.files_count}</span>
                    <span>✅ {stage.todos_count}</span>
                    <span>💬 {stage.comments_count}</span>
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Kanban View Component
function KanbanView({ stages, onStageClick }) {
  const statusColumns = [
    { key: "not_started", title: "Not Started", color: "gray" },
    { key: "in_progress", title: "In Progress", color: "blue" },
    { key: "blocked", title: "Blocked", color: "red" },
    { key: "done", title: "Done", color: "green" }
  ];

  const stagesByStatus = statusColumns.reduce((acc, column) => {
    acc[column.key] = stages?.filter(stage => stage.status === column.key) || [];
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6 min-h-0">
        <div className="h-full grid grid-cols-4 gap-6">
          {statusColumns.map((column) => (
            <div key={column.key} className="flex flex-col h-full min-h-0">
              {/* Column Header */}
              <div className={`p-4 rounded-t-lg border-b-2 bg-${column.color}-50 dark:bg-darkblack-500 border-${column.color}-200 flex-shrink-0`}>
                <h3 className="font-semibold text-darkblack-700 dark:text-white">
                  {column.title}
                </h3>
                <span className="text-sm text-bgray-500">
                  {stagesByStatus[column.key].length} stages
                </span>
              </div>
              
              {/* Column Content */}
              <div className="flex-1 bg-bgray-50 dark:bg-darkblack-600 rounded-b-lg p-4 space-y-3 overflow-y-auto scrollbar-thin min-h-0">
                {stagesByStatus[column.key].map((stage) => (
                  <button
                    key={stage.track_stage_id}
                    onClick={() => onStageClick(stage.track_stage_id)}
                    className="w-full p-4 bg-white dark:bg-darkblack-500 rounded-lg border border-bgray-200 dark:border-darkblack-400 hover:shadow-md transition-shadow text-left flex-shrink-0"
                  >
                    <h4 className="font-medium text-darkblack-700 dark:text-white mb-2">
                      {stage.order_index}. {stage.name}
                    </h4>
                    {stage.due_date && (
                      <p className="text-xs text-bgray-500 mb-2">Due: {stage.due_date}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-bgray-500">
                      <span>📎 {stage.files_count}</span>
                      <span>✅ {stage.todos_count}</span>
                      <span>💬 {stage.comments_count}</span>
                    </div>
                  </button>
                ))}
                
                {stagesByStatus[column.key].length === 0 && (
                  <div className="text-center py-8 text-bgray-400">
                    No stages
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewProjectModal({ isOpen, onClose, onSuccess }) {
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [formData, setFormData] = useState({
    clientId: "",
    projectName: "",
    workflowKind: "Service",
    remarks: ""
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      setFormData({
        clientId: "",
        projectName: "",
        workflowKind: "Service",
        remarks: ""
      });
      setErrors({});
      setSubmitError("");
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .order("company_name", { ascending: true });
      
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoadingClients(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.clientId) newErrors.clientId = "Client is required";
    if (!formData.projectName.trim()) newErrors.projectName = "Project name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setSubmitError("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.rpc('create_track_rpc', {
        p_client_id: formData.clientId,
        p_name: formData.projectName.trim(),
        p_remarks: formData.remarks.trim() || null,
        p_workflow: formData.workflowKind,
        p_owner_id: user.id
      });

      if (error) throw error;

      onSuccess(data);
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && !submitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Project</h3>
          
          {submitError && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                {loadingClients ? (
                  <div className="flex items-center p-3 border border-gray-300 rounded-md bg-gray-50">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    <span className="text-sm text-gray-600">Loading clients...</span>
                  </div>
                ) : clients.length === 0 ? (
                  <div className="p-3 border border-yellow-300 rounded-md bg-yellow-50">
                    <p className="text-sm text-yellow-800">
                      You don't have clients yet.{" "}
                      <a href="/clients" className="underline hover:text-yellow-900">
                        Add one first
                      </a>.
                    </p>
                  </div>
                ) : (
                  <select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900 bg-white"
                  >
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company_name}
                      </option>
                    ))}
                  </select>
                )}
                {errors.clientId && (
                  <p className="mt-1 text-xs text-red-600">{errors.clientId}</p>
                )}
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900 bg-white"
                  placeholder="Enter project name"
                />
                {errors.projectName && (
                  <p className="mt-1 text-xs text-red-600">{errors.projectName}</p>
                )}
              </div>

              {/* Workflow Kind */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Kind
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="Service"
                      checked={formData.workflowKind === "Service"}
                      onChange={(e) => setFormData({ ...formData, workflowKind: e.target.value })}
                      disabled={submitting}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Service</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="Product"
                      checked={formData.workflowKind === "Product"}
                      onChange={(e) => setFormData({ ...formData, workflowKind: e.target.value })}
                      disabled={submitting}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Product</span>
                  </label>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  disabled={submitting}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900 bg-white"
                  placeholder="Optional remarks or notes"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || clients.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
              >
                {submitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {submitting ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Delete Project Confirmation Modal
function DeleteProjectModal({ isOpen, onClose, project, onConfirm, isDeleting }) {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <div className="mt-3 text-center">
            <h3 className="text-lg font-medium text-gray-900">Cancel Project</h3>
            <div className="mt-2 px-7 py-3">
              <p className="text-sm text-gray-500">
                Are you sure you want to cancel "<strong>{project.track_name}</strong>" for {project.client_name}?
              </p>
              <p className="text-sm text-orange-600 mt-2 font-medium">
                This will mark the project as cancelled and hide it from your active projects list. The project data will be preserved but marked as cancelled.
              </p>
            </div>
            
            <div className="flex justify-center space-x-3 mt-4">
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
              >
                {isDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isDeleting ? "Cancelling..." : "Cancel Project"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [overview, setOverview] = useState([]);
  const [cancelledProjects, setCancelledProjects] = useState([]);
  const [showCancelledProjects, setShowCancelledProjects] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState("");
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [viewMode, setViewMode] = useState("flow");

  // --- Data: tracks list (left panel) ---
  const fetchTracksOverview = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_tracks_overview")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []).map((r) => ({
        ...r,
        progress_pct: typeof r.progress_pct === "string" ? parseFloat(r.progress_pct) : r.progress_pct,
      }));
      
      // Debug: log the data to see what we're working with
      console.log('All projects data:', rows);
      if (rows.length > 0) {
        console.log('First project fields:', Object.keys(rows[0]));
        console.log('First project status field:', rows[0].status);
      }
      
      // Separate active and cancelled projects
      // Try different possible field names for status
      const activeProjects = rows.filter(r => 
        r.status !== 'cancelled' && 
        r.track_status !== 'cancelled' &&
        !r.track_name?.startsWith('[CANCELLED]')
      );
      const cancelledProjects = rows.filter(r => 
        r.status === 'cancelled' || 
        r.track_status === 'cancelled' ||
        r.track_name?.startsWith('[CANCELLED]')
      );
      
      console.log('Active projects:', activeProjects);
      console.log('Cancelled projects:', cancelledProjects);
      
      setOverview(activeProjects);
      setCancelledProjects(cancelledProjects);
      
      if (activeProjects.length && !activeTrackId) {
        setActiveTrackId(activeProjects[0].track_id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracksOverview();
  }, []);

  // --- Data: track detail ---
  const loadTrackDetail = async () => {
    if (!activeTrackId) return;
    const { data, error } = await supabase.rpc("get_track_detail", { p_track_id: activeTrackId });
    if (error) { setError(error.message); return; }
    setDetail(data);
  };

  useEffect(() => {
    if (activeTrackId) {
      loadTrackDetail();
    }
  }, [activeTrackId]);

  // --- Project Deletion ---
  const handleDeleteProject = async (project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
    setDeleteError("");
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError("");

      // Cancel the project by updating its status
      await cancelProject(projectToDelete.track_id);

      // Update UI state
      await fetchTracksOverview();
      
      // If deleted project was active, clear selection
      if (activeTrackId === projectToDelete.track_id) {
        setActiveTrackId(overview.length > 1 ? overview.find(t => t.track_id !== projectToDelete.track_id)?.track_id : null);
        setDetail(null);
      }

      // Only show success message if it wasn't already set by the manual deletion function
      if (!successMessage) {
        setSuccessMessage(`Project "${projectToDelete.track_name}" has been deleted successfully.`);
      }
      
      setShowDeleteModal(false);
      setProjectToDelete(null);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(""), 5000);

    } catch (err) {
      console.error("Delete project error:", err);
      setDeleteError(err.message || "Failed to delete project. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel project by marking it as cancelled
  const cancelProject = async (trackId) => {
    try {
      // Since we don't have delete permissions, mark the project as cancelled instead
      // This is often what users actually want anyway for "cancelled projects"
      const { error: updateError } = await supabase
        .from('tracks')
        .update({ 
          status: 'cancelled',
          name: `[CANCELLED] ${projectToDelete.track_name}`
        })
        .eq('id', trackId);
      
      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }
      
      // Show success message for cancellation
      setSuccessMessage(`Project "${projectToDelete.track_name}" has been cancelled and will no longer appear in active projects.`);
    } catch (err) {
      console.error('Project cancellation error:', err);
      throw err;
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProjectToDelete(null);
    setDeleteError("");
  };

  // Reactivate a cancelled project
  const reactivateProject = async (project) => {
    try {
      const originalName = project.track_name.replace('[CANCELLED] ', '');
      
      const { error } = await supabase
        .from('tracks')
        .update({
          status: 'active',
          name: originalName
        })
        .eq('id', project.track_id);

      if (error) throw error;

      // Refresh the project lists
      await fetchTracksOverview();
      
      setSuccessMessage(`Project "${originalName}" has been reactivated successfully.`);
      setTimeout(() => setSuccessMessage(""), 5000);
      
    } catch (err) {
      console.error('Reactivate project error:', err);
      setError(err.message || 'Failed to reactivate project.');
    }
  };

  // --- Build nodes/edges for React Flow ---
  const { nodes, edges } = useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };
    const baseY = 80, gapX = 230;
    const nodes = [];
    const edges = [];

    nodes.push({
      id: `track:${detail.track.id}`,
      position: { x: 20, y: baseY - 60 },
      data: { label: (
        <div className="px-4 py-2 rounded-2xl shadow-sm border bg-white">
          <div className="text-sm opacity-70">{detail.client?.company_name}</div>
          <div className="font-semibold">{detail.track.name}</div>
          <div className="text-xs mt-1">Status: {detail.track.status}</div>
        </div>
      ) },
      draggable: false,
      type: "input",
    });

    detail.stages.forEach((s, idx) => {
      const x = 220 + idx * gapX;
      const y = baseY + (s.status === "done" ? 60 : s.status === "blocked" ? -20 : 0);
      nodes.push({
        id: s.track_stage_id,
        position: { x, y },
        data: { label: (
          <button
            className={`px-4 py-3 rounded-2xl border shadow-sm text-left w-[200px] transition hover:shadow-md ${
              s.status === "done" ? "bg-green-50 border-green-200" :
              s.status === "in_progress" ? "bg-blue-50 border-blue-200" :
              s.status === "blocked" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
            onClick={() => setSelectedStageId(s.track_stage_id)}
          >
            <div className="font-semibold">{s.order_index}. {s.name}</div>
            <div className="text-xs mt-1">Status: {s.status.replaceAll("_"," ")}</div>
            <div className="text-xs">Due: {s.due_date ?? "—"}</div>
            <div className="text-[11px] mt-1 opacity-70">📎 {s.files_count} • ✅ {s.todos_count} • 💬 {s.comments_count}</div>
            <div className="mt-2 text-xs italic">Click to view details →</div>
          </button>
        ) },
      });

      const fromId = idx === 0 ? `track:${detail.track.id}` : detail.stages[idx - 1].track_stage_id;
      edges.push({ id: `${fromId}->${s.track_stage_id}`, source: fromId, target: s.track_stage_id });
    });

    return { nodes, edges };
  }, [detail, busy]);

  return (
    <div className="p-6 font-urbanist">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-darkblack-700 dark:text-white mb-2">Projects</h1>
            <p className="text-bgray-600 dark:text-bgray-300">Manage your client projects and track workflow progress</p>
          </div>
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            New Project
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-4 xl:col-span-3 space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">Active Projects</h2>
                <span className="text-xs text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-500 px-2 py-1 rounded">
                  {overview.length} total
                </span>
              </div>
              
              {error && (
                <div className="bg-error-50 text-error-300 text-sm p-3 rounded-lg mb-4 border border-error-200">
                  {error}
                </div>
              )}
              
              {successMessage && (
                <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4 border border-green-200">
                  {successMessage}
                </div>
              )}
              
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner h-6 w-6 mr-3"></div>
                  <span className="text-bgray-600 dark:text-bgray-300">Loading projects...</span>
                </div>
              )}
              
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                {!loading && overview.map((t) => (
                  <div
                    key={t.track_id}
                    className={`w-full relative p-4 rounded-lg border transition-all duration-200 hover:shadow-sm group ${
                      activeTrackId === t.track_id 
                        ? "border-primary bg-success-50 dark:bg-darkblack-500 shadow-sm" 
                        : "border-bgray-200 dark:border-darkblack-400 bg-white dark:bg-darkblack-600 hover:border-primary"
                    }`}
                  >
                    <button
                      onClick={() => setActiveTrackId(t.track_id)}
                      className="w-full text-left"
                    >
                      <div className="text-xs text-bgray-500 dark:text-bgray-400 mb-1">{t.client_name}</div>
                      <div className="font-semibold text-darkblack-700 dark:text-white mb-2">{t.track_name}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-bgray-600 dark:text-bgray-300">
                          {t.workflow_kind}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded font-medium ${
                          Number(t.progress_pct) >= 80 ? "bg-success-100 text-success-400" :
                          Number(t.progress_pct) >= 50 ? "bg-warning-100 text-warning-300" :
                          "bg-bgray-200 text-bgray-600 dark:bg-darkblack-500 dark:text-bgray-300"
                        }`}>
                          {Number(t.progress_pct).toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-xs text-bgray-500 dark:text-bgray-400 mt-2">
                        Due: {t.next_due_date ?? "No due date"}
                      </div>
                    </button>
                    
                    {/* Delete Button - Hidden by default, shown on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(t);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 hover:text-red-700"
                      title="Cancel project"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Cancelled Projects Section */}
              {cancelledProjects.length > 0 && (
                <div className="mt-4 pt-4 border-t border-bgray-200 dark:border-darkblack-400">
                  <button
                    onClick={() => setShowCancelledProjects(!showCancelledProjects)}
                    className="flex items-center justify-between w-full text-left mb-3 text-sm font-medium text-bgray-600 dark:text-bgray-300 hover:text-darkblack-700 dark:hover:text-white transition-colors"
                  >
                    <span>Cancelled Projects ({cancelledProjects.length})</span>
                    <svg 
                      className={`w-4 h-4 transform transition-transform ${showCancelledProjects ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showCancelledProjects && (
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                      {cancelledProjects.map((t) => (
                        <div
                          key={t.track_id}
                          className="w-full relative p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 group"
                        >
                          <div className="text-xs text-red-600 dark:text-red-400 mb-1">{t.client_name}</div>
                          <div className="font-semibold text-red-700 dark:text-red-300 mb-2">{t.track_name}</div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-red-600 dark:text-red-400">
                              {t.workflow_kind}
                            </div>
                            <button
                              onClick={() => reactivateProject(t)}
                              className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                              title="Reactivate project"
                            >
                              Reactivate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          <main className="col-span-8 xl:col-span-9 space-y-6">
            {/* Workflow Canvas */}
            <div className="card">
              <div className="p-4 border-b border-bgray-200 dark:border-darkblack-400">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">Workflow Canvas</h2>
                    <p className="text-sm text-bgray-600 dark:text-bgray-300">Visual representation of project stages</p>
                  </div>
                  
                  {/* View Mode Toggle */}
                  <div className="flex bg-bgray-100 dark:bg-darkblack-500 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("flow")}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        viewMode === "flow"
                          ? "bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white shadow-sm"
                          : "text-bgray-600 dark:text-bgray-300 hover:text-darkblack-700 dark:hover:text-white"
                      }`}
                    >
                      Flow View
                    </button>
                    <button
                      onClick={() => setViewMode("stepper")}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        viewMode === "stepper"
                          ? "bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white shadow-sm"
                          : "text-bgray-600 dark:text-bgray-300 hover:text-darkblack-700 dark:hover:text-white"
                      }`}
                    >
                      Stepper
                    </button>
                    <button
                      onClick={() => setViewMode("kanban")}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        viewMode === "kanban"
                          ? "bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white shadow-sm"
                          : "text-bgray-600 dark:text-bgray-300 hover:text-darkblack-700 dark:hover:text-white"
                      }`}
                    >
                      Kanban
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Conditional View Rendering */}
              <div className="h-[520px] overflow-hidden">
                {viewMode === "flow" && (
                  <ReactFlow nodes={nodes} edges={edges} fitView>
                    <MiniMap pannable zoomable />
                    <Controls />
                    <Background variant="dots" gap={16} size={1} />
                  </ReactFlow>
                )}
                
                {viewMode === "stepper" && (
                  <VerticalStepperView 
                    stages={detail?.stages || []} 
                    onStageClick={setSelectedStageId}
                  />
                )}
                
                {viewMode === "kanban" && (
                  <KanbanView 
                    stages={detail?.stages || []} 
                    onStageClick={setSelectedStageId}
                  />
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {detail && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">Quick Actions</h3>
                  <div className="text-xs text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-500 px-3 py-1 rounded-full">
                    {detail.client?.company_name} • {detail.track.name}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Add a quick comment to the active stage..."
                    className="input-field flex-1"
                  />
                  <button
                    onClick={async () => {
                      const active = detail.stages.find((s) => s.status === "in_progress");
                      if (!active || !commentDraft.trim()) return;
                      try {
                        setBusy(true);
                        // Get current user
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error("User not authenticated");
                        
                        await supabase.rpc("add_stage_comment", { 
                          p_track_stage_id: active.track_stage_id, 
                          p_body: commentDraft,
                          p_user: user.id
                        });
                        const { data } = await supabase.rpc("get_track_detail", { p_track_id: detail.track.id });
                        setDetail(data);
                        setCommentDraft("");
                      } catch (e) { setError(e.message); } finally { setBusy(false); }
                    }}
                    className="btn-primary"
                    disabled={busy || !commentDraft.trim()}
                  >
                    {busy ? (
                      <div className="flex items-center">
                        <div className="spinner h-4 w-4 mr-2"></div>
                        Adding...
                      </div>
                    ) : (
                      "Add Comment"
                    )}
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* New Project Modal */}
        <NewProjectModal
          isOpen={showNewProjectModal}
          onClose={() => setShowNewProjectModal(false)}
          onSuccess={async (newTrackId) => {
            // Refresh the sidebar list
            await fetchTracksOverview();
            // Auto-select the newly created project and load its detail
            setActiveTrackId(newTrackId);
            const { data, error } = await supabase.rpc("get_track_detail", { p_track_id: newTrackId });
            if (!error) {
              setDetail(data);
            }
          }}
        />

        {/* Delete Project Modal */}
        <DeleteProjectModal
          isOpen={showDeleteModal}
          onClose={cancelDelete}
          project={projectToDelete}
          onConfirm={confirmDeleteProject}
          isDeleting={isDeleting}
        />
        
        {deleteError && (
          <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {deleteError}
            </div>
          </div>
        )}

        {/* Stage Drawer */}
        <StageDrawer 
          stageId={selectedStageId}
          onClose={() => setSelectedStageId(null)}
          onUpdate={() => {
            loadTrackDetail(); // Refresh track detail when stage is updated
          }}
        />
      </div>
    </div>
  );
}