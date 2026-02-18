import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import StageDrawer from "../StageDrawer";
import NetworkGraphView from "../components/NetworkGraphView";
import PipelineView from "../components/PipelineView";
import { nodeTypes } from "../components/FlowNodes";
import HorizontalWorkflow from "../components/HorizontalWorkflow";

// Vertical Stepper View Component
function VerticalStepperView({ stages, onStageClick }) {
  const { t } = useTranslation();
  if (!stages?.length) {
    return (
      <div className="flex items-center justify-center py-12 text-bgray-500 h-full">
        {t("noStagesAvailable")}
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
                    {stage.due_date && <span>{t("due")}: {stage.due_date}</span>}
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
  const { t } = useTranslation();
  const statusColumns = [
    { key: "not_started", title: t("notStarted"), color: "gray" },
    { key: "in_progress", title: t("inProgress"), color: "blue" },
    { key: "blocked", title: t("blocked"), color: "red" },
    { key: "done", title: t("done"), color: "green" }
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
                  {stagesByStatus[column.key].length} {t("stages")}
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
                      <p className="text-xs text-bgray-500 mb-2">{t("due")}: {stage.due_date}</p>
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
                    {t("noStages")}
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
  const { t } = useTranslation();
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
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

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

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;

    try {
      setCreatingClient(true);

      const { data, error } = await supabase
        .from("clients")
        .insert([{
          company_name: newClientName.trim()
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to clients list and select it
      setClients(prev => [...prev, data].sort((a, b) => a.company_name.localeCompare(b.company_name)));
      setFormData({ ...formData, clientId: data.id });
      setNewClientName("");
      setShowNewClientForm(false);
    } catch (err) {
      console.error("Error creating client:", err);
      alert("Failed to create client: " + err.message);
    } finally {
      setCreatingClient(false);
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t("createNewProject")}</h3>
          
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
                  {t("client")} *
                </label>
                {loadingClients ? (
                  <div className="flex items-center p-3 border border-gray-300 rounded-md bg-gray-50">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    <span className="text-sm text-gray-600">{t("loadingClients")}</span>
                  </div>
                ) : (
                  <>
                    {clients.length > 0 ? (
                      <select
                        value={formData.clientId}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                        disabled={submitting}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900 bg-white"
                      >
                        <option value="">{t("selectClient")}</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.company_name}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {/* Create New Client Button */}
                    {!showNewClientForm && (
                      <button
                        type="button"
                        onClick={() => setShowNewClientForm(true)}
                        className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        {clients.length === 0 ? "Create Your First Client" : "Create New Client"}
                      </button>
                    )}

                    {/* Inline New Client Form */}
                    {showNewClientForm && (
                      <div className="mt-2 p-3 border-2 border-blue-300 rounded-md bg-blue-50">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          New Client Name
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateClient();
                              }
                            }}
                            placeholder="Enter client name..."
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                            disabled={creatingClient}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleCreateClient}
                            disabled={creatingClient || !newClientName.trim()}
                            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                          >
                            {creatingClient ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewClientForm(false);
                              setNewClientName("");
                            }}
                            disabled={creatingClient}
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                          Press Enter or click ✓ to create client
                        </p>
                      </div>
                    )}
                  </>
                )}
                {errors.clientId && (
                  <p className="mt-1 text-xs text-red-600">{errors.clientId}</p>
                )}
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("projectName")} *
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900 bg-white"
                  placeholder={t("enterProjectName")}
                />
                {errors.projectName && (
                  <p className="mt-1 text-xs text-red-600">{errors.projectName}</p>
                )}
              </div>

              {/* Workflow Kind */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("workflowKind")}
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
                    <span className="text-sm text-gray-700">{t("service")}</span>
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
                    <span className="text-sm text-gray-700">{t("product")}</span>
                  </label>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("remarks")}
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  disabled={submitting}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900 bg-white"
                  placeholder={t("optionalRemarks")}
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
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || clients.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
              >
                {submitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {submitting ? t("creating") : t("createProject")}
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
  const { t } = useTranslation();
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
            <h3 className="text-lg font-medium text-gray-900">{t("cancelProject")}</h3>
            <div className="mt-2 px-7 py-3">
              <p className="text-sm text-gray-500">
                {t("areYouSure", { projectName: project.track_name, clientName: project.client_name })}
              </p>
              <p className="text-sm text-orange-600 mt-2 font-medium">
                {t("cancelProjectWarning")}
              </p>
            </div>
            
            <div className="flex justify-center space-x-3 mt-4">
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
              >
                {isDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isDeleting ? t("cancelling") : t("cancelProject")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const location = useLocation();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarViewMode, setSidebarViewMode] = useState("network"); // "network" or "list"
  const [remarksDraft, setRemarksDraft] = useState("");
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [savingRemarks, setSavingRemarks] = useState(false);

  // --- Resizable panels ---
  const [sidebarWidth, setSidebarWidth] = useState(30); // percentage, default 30%
  const containerRef = useRef(null);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;

    const handleMouseMove = (moveEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      // Clamp between 20% and 60%
      setSidebarWidth(Math.min(60, Math.max(20, pct)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

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

      // Don't auto-select any project - let user explore the network graph first
      // Only set active track if coming from dashboard navigation
      // (removed auto-selection: was line 502)
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracksOverview();
  }, []);

  // Handle navigation from dashboard
  useEffect(() => {
    if (location.state?.activeTrackId && overview.length > 0) {
      console.log('Setting active track from dashboard navigation:', location.state.activeTrackId);
      setActiveTrackId(location.state.activeTrackId);
      if (location.state.selectedStageId) {
        // Delay setting the stage ID slightly to ensure the track loads first
        setTimeout(() => {
          console.log('Setting selected stage from dashboard navigation:', location.state.selectedStageId);
          setSelectedStageId(location.state.selectedStageId);
        }, 100);
      }
    }
  }, [location.state, overview]);

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

  // Update remarks draft when detail changes
  useEffect(() => {
    if (detail?.track?.remarks) {
      setRemarksDraft(detail.track.remarks);
    } else {
      setRemarksDraft("");
    }
    setIsEditingRemarks(false);
  }, [detail]);

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

  // Filter projects based on search query
  const filteredOverview = useMemo(() => {
    if (!searchQuery.trim()) return overview;
    
    const query = searchQuery.toLowerCase().trim();
    return overview.filter(project => 
      project.client_name?.toLowerCase().includes(query) ||
      project.track_name?.toLowerCase().includes(query)
    );
  }, [overview, searchQuery]);

  // --- Build nodes/edges for React Flow ---
  const { nodes, edges } = useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };
    const baseY = 120, gapX = 280;
    const nodes = [];
    const edges = [];

    // Project Root Node
    nodes.push({
      id: `track:${detail.track.id}`,
      position: { x: 20, y: baseY },
      data: {
        clientName: detail.client?.company_name || "Client",
        projectName: detail.track.name,
        status: detail.track.status || "Active"
      },
      draggable: false,
      type: "projectNode",
    });

    // Stage Nodes
    detail.stages.forEach((s, idx) => {
      const x = 300 + idx * gapX;
      // Organic wave pattern based on status and index
      const yOffset = s.status === "done" ? Math.sin(idx * 0.5) * 40 + 30 :
                      s.status === "blocked" ? -40 :
                      s.status === "in_progress" ? Math.cos(idx * 0.3) * 20 :
                      Math.sin(idx * 0.4) * 15;
      const y = baseY + yOffset;

      nodes.push({
        id: s.track_stage_id,
        position: { x, y },
        data: {
          name: s.name,
          status: s.status,
          orderIndex: s.order_index,
          dueDate: s.due_date,
          filesCount: s.files_count,
          todosCount: s.todos_count,
          commentsCount: s.comments_count,
          progress: s.progress_pct || 0,
          index: idx,
          onClick: () => setSelectedStageId(s.track_stage_id)
        },
        type: "stageNode",
      });

      // Create edges with enhanced styling
      const fromId = idx === 0 ? `track:${detail.track.id}` : detail.stages[idx - 1].track_stage_id;
      edges.push({
        id: `${fromId}->${s.track_stage_id}`,
        source: fromId,
        target: s.track_stage_id,
        type: 'smoothstep',
        animated: s.status === "in_progress",
        style: {
          stroke: s.status === "done" ? "#22c55e" :
                  s.status === "in_progress" ? "#3b82f6" :
                  s.status === "blocked" ? "#ef4444" :
                  "#9ca3af",
          strokeWidth: s.status === "in_progress" ? 3 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: s.status === "done" ? "#22c55e" :
                 s.status === "in_progress" ? "#3b82f6" :
                 s.status === "blocked" ? "#ef4444" :
                 "#9ca3af",
          width: 20,
          height: 20,
        },
      });
    });

    return { nodes, edges };
  }, [detail, busy]);

  return (
    <div className="p-6 font-urbanist">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-darkblack-700 dark:text-white mb-2">{t("projects")}</h1>
            <p className="text-bgray-600 dark:text-bgray-300">{t("manageProjects")}</p>
          </div>
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            {t("newProject")}
          </button>
        </div>

        <div ref={containerRef} className="flex transition-all duration-300" style={{ userSelect: isResizing.current ? "none" : "auto" }}>
          <aside className="space-y-4 flex-shrink-0 overflow-hidden" style={{ width: activeTrackId && detail ? `${sidebarWidth}%` : "100%" }}>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">{t("activeProjects")}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-500 px-2 py-1 rounded">
                    {filteredOverview.length}/{overview.length} {t("total")}
                  </span>

                  {/* View Toggle */}
                  <button
                    onClick={() => setSidebarViewMode(sidebarViewMode === "network" ? "list" : "network")}
                    className="p-1.5 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded transition-colors"
                    title={sidebarViewMode === "network" ? "Switch to list view" : "Switch to network view"}
                  >
                    {sidebarViewMode === "network" ? (
                      <svg className="w-4 h-4 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Field */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder={t("searchProjects")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-bgray-200 dark:border-darkblack-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white placeholder-bgray-500 dark:placeholder-bgray-300"
                />
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
                  <span className="text-bgray-600 dark:text-bgray-300">{t("loadingProjects")}</span>
                </div>
              )}

              {/* Conditional Rendering: Pipeline or List View */}
              {!loading && sidebarViewMode === "network" ? (
                <div className="h-[600px]">
                  <PipelineView
                    projects={filteredOverview}
                    onProjectSelect={setActiveTrackId}
                    activeProjectId={activeTrackId}
                    searchQuery={searchQuery}
                  />
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {!loading && filteredOverview.map((t) => (
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
              )}

              {/* Cancelled Projects Section */}
              {cancelledProjects.length > 0 && (
                <div className="mt-4 pt-4 border-t border-bgray-200 dark:border-darkblack-400">
                  <button
                    onClick={() => setShowCancelledProjects(!showCancelledProjects)}
                    className="flex items-center justify-between w-full text-left mb-3 text-sm font-medium text-bgray-600 dark:text-bgray-300 hover:text-darkblack-700 dark:hover:text-white transition-colors"
                  >
                    <span>{t("cancelledProjects")} ({cancelledProjects.length})</span>
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
                      {cancelledProjects.map((project) => (
                        <div
                          key={project.track_id}
                          className="w-full relative p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 group"
                        >
                          <div className="text-xs text-red-600 dark:text-red-400 mb-1">{project.client_name}</div>
                          <div className="font-semibold text-red-700 dark:text-red-300 mb-2">{project.track_name}</div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-red-600 dark:text-red-400">
                              {project.workflow_kind}
                            </div>
                            <button
                              onClick={() => reactivateProject(project)}
                              className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                              title="Reactivate project"
                            >
                              {t("reactivate")}
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

          {/* Resizable divider */}
          {activeTrackId && detail && (
            <div
              onMouseDown={handleResizeStart}
              className="flex-shrink-0 w-1.5 cursor-col-resize bg-bgray-200 dark:bg-darkblack-400 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors rounded-full mx-1"
            />
          )}

          {/* Show Workflow Canvas only when a project is selected */}
          {activeTrackId && detail && (
            <main className="flex-1 min-w-0 space-y-6 transition-all duration-300">
              <>
                {/* Workflow Canvas */}
                <div className="card">
                  <div className="p-4 border-b border-bgray-200 dark:border-darkblack-400">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">{t("workflowCanvas")}</h2>
                        <p className="text-sm text-bgray-600 dark:text-bgray-300">{t("visualRepresentation")}</p>
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
                          {t("flowView")}
                        </button>
                        <button
                          onClick={() => setViewMode("kanban")}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            viewMode === "kanban"
                              ? "bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white shadow-sm"
                              : "text-bgray-600 dark:text-bgray-300 hover:text-darkblack-700 dark:hover:text-white"
                          }`}
                        >
                          {t("kanban")}
                        </button>
                      </div>
                    </div>
                  </div>

              {/* Conditional View Rendering */}
              <div className="rounded-lg bg-white dark:bg-darkblack-700">
                {viewMode === "flow" && (
                  <div className="p-4">
                    <HorizontalWorkflow
                      detail={detail}
                      onStageClick={setSelectedStageId}
                    />
                  </div>
                )}

                {viewMode === "kanban" && (
                  <div className="h-[500px]">
                    <KanbanView
                      stages={detail?.stages || []}
                      onStageClick={setSelectedStageId}
                    />
                  </div>
                )}
              </div>
            </div>

                {/* Quick Actions */}
                {detail && (
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">{t("quickActions")}</h3>
                      <div className="text-xs text-bgray-500 dark:text-bgray-400 bg-bgray-100 dark:bg-darkblack-500 px-3 py-1 rounded-full">
                        {detail.client?.company_name} • {detail.track.name}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder={t("addQuickComment")}
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
                            {t("adding")}
                          </div>
                        ) : (
                          t("addComment")
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Project Remarks */}
                {detail && (
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">{t("projectRemarks")}</h3>
                      {!isEditingRemarks ? (
                        <button
                          onClick={() => setIsEditingRemarks(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                          {detail.track?.remarks ? t("edit") : t("add")}
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setIsEditingRemarks(false);
                              setRemarksDraft(detail.track?.remarks || "");
                            }}
                            disabled={savingRemarks}
                            className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium disabled:opacity-50"
                          >
                            {t("cancel")}
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                setSavingRemarks(true);
                                const { error } = await supabase
                                  .from('tracks')
                                  .update({ remarks: remarksDraft.trim() || null })
                                  .eq('id', detail.track.id);

                                if (error) throw error;

                                // Reload track detail
                                await loadTrackDetail();
                                setIsEditingRemarks(false);
                                setSuccessMessage(t("remarksUpdated"));
                                setTimeout(() => setSuccessMessage(""), 3000);
                              } catch (err) {
                                setError(err.message || "Failed to update remarks");
                              } finally {
                                setSavingRemarks(false);
                              }
                            }}
                            disabled={savingRemarks}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50 flex items-center"
                          >
                            {savingRemarks && (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                            )}
                            {t("save")}
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingRemarks ? (
                      <textarea
                        value={remarksDraft}
                        onChange={(e) => setRemarksDraft(e.target.value)}
                        placeholder={t("enterProjectRemarks")}
                        rows="4"
                        className="w-full px-3 py-2 border border-bgray-200 dark:border-darkblack-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white placeholder-bgray-500 dark:placeholder-bgray-300"
                        disabled={savingRemarks}
                      />
                    ) : (
                      <div className="text-sm text-bgray-700 dark:text-bgray-200 whitespace-pre-wrap">
                        {detail.track?.remarks || (
                          <span className="text-bgray-500 dark:text-bgray-400 italic">
                            {t("noRemarksYet")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            </main>
          )}
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
          trackId={activeTrackId}
          onClose={() => setSelectedStageId(null)}
          onUpdate={() => {
            loadTrackDetail(); // Refresh track detail when stage is updated
          }}
          projectName={detail?.track?.track_name || detail?.track?.name}
          clientName={detail?.client?.company_name || detail?.client?.name}
        />
      </div>
    </div>
  );
}