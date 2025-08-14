import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../supabaseClient";

export default function DetailsPanel({ 
  isOpen, 
  selectedNode, 
  processedData,
  onClose 
}) {
  const { t } = useTranslation();
  const [currentStageDetail, setCurrentStageDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Get current stage for projects
  const getCurrentStage = (projectData) => {
    if (!projectData || !projectData.stages) return null;
    
    // Find the current active stage (in progress)
    let currentStage = projectData.stages.find(stage => stage.status === "in_progress");
    
    // If no in-progress stage, find the next stage that needs to be started
    if (!currentStage) {
      currentStage = projectData.stages.find(stage => 
        stage.status === "not_started" || stage.status === "pending"
      );
    }
    
    // If still no stage, get the first incomplete stage
    if (!currentStage) {
      currentStage = projectData.stages.find(stage => stage.status !== "completed");
    }
    
    return currentStage;
  };

  // Load current stage details when a project is selected
  useEffect(() => {
    if (!selectedNode || selectedNode.type !== "project") {
      setCurrentStageDetail(null);
      return;
    }

    const projectData = selectedNode.data;
    const currentStage = getCurrentStage(projectData);
    
    if (!currentStage) {
      setCurrentStageDetail(null);
      return;
    }

    const loadCurrentStageDetail = async () => {
      try {
        setLoading(true);
        setError("");
        
        const { data, error } = await supabase.rpc("get_stage_detail", { 
          p_track_stage_id: currentStage.id 
        });
        
        if (error) throw error;
        setCurrentStageDetail(data);
      } catch (err) {
        console.error("Error loading stage detail:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCurrentStageDetail();
  }, [selectedNode]);

  if (!isOpen || !selectedNode) return null;
  
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 z-50 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {selectedNode.type === "company" ? t("company") : 
           selectedNode.type === "client" ? t("client") : t("project")} {t("details")}
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            {selectedNode.data.label}
          </h4>
          
          {selectedNode.type === "client" && (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Owner:</span> {selectedNode.data.ownerName}</p>
              <p><span className="font-medium">Risk Level:</span> 
                <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                  selectedNode.data.risk === "high" ? "bg-red-100 text-red-700" :
                  selectedNode.data.risk === "medium" ? "bg-yellow-100 text-yellow-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  {selectedNode.data.risk}
                </span>
              </p>
              <p><span className="font-medium">Projects:</span> {selectedNode.data.tracks?.length || 0}</p>
              {selectedNode.data.email && (
                <p><span className="font-medium">Email:</span> {selectedNode.data.email}</p>
              )}
              {selectedNode.data.website && (
                <p><span className="font-medium">Website:</span> 
                  <a href={selectedNode.data.website} target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:text-blue-800 ml-1">
                    {selectedNode.data.website}
                  </a>
                </p>
              )}
            </div>
          )}
          
          {selectedNode.type === "project" && (
            <div className="space-y-4">
              {/* Basic Project Info */}
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Status:</span> 
                  <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                    selectedNode.data.status === "active" ? "bg-blue-100 text-blue-700" :
                    selectedNode.data.status === "completed" ? "bg-green-100 text-green-700" :
                    selectedNode.data.status === "on_hold" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {selectedNode.data.status}
                  </span>
                </p>
                <p><span className="font-medium">Progress:</span> {selectedNode.data.progress}%</p>
                <p><span className="font-medium">Owner:</span> {selectedNode.data.ownerName}</p>
                {selectedNode.data.nextDue && (
                  <p><span className="font-medium">Next Due:</span> {selectedNode.data.nextDue}</p>
                )}
                {selectedNode.data.overdue && (
                  <p className="text-red-600"><span className="font-medium">Status:</span> OVERDUE</p>
                )}
              </div>

              {/* Current Stage Section */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">{t("currentStage")}</h5>
                
                {loading && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t("loadingStageDetails")}</span>
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {error}
                  </div>
                )}

                {!loading && !error && currentStageDetail && (
                  <div className="space-y-4">
                    {/* Stage Info */}
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">{t("stage")}:</span> {currentStageDetail.stage_name}</p>
                      <p><span className="font-medium">Status:</span> 
                        <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                          currentStageDetail.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                          currentStageDetail.status === "completed" ? "bg-green-100 text-green-700" :
                          currentStageDetail.status === "blocked" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {currentStageDetail.status}
                        </span>
                      </p>
                      {currentStageDetail.due_date && (
                        <p><span className="font-medium">{t("dueDate")}:</span> {currentStageDetail.due_date}</p>
                      )}
                      {currentStageDetail.assignee_name && (
                        <p><span className="font-medium">{t("assignee")}:</span> {currentStageDetail.assignee_name}</p>
                      )}
                    </div>

                    {/* Todos */}
                    {currentStageDetail.todos && currentStageDetail.todos.length > 0 && (
                      <div>
                        <h6 className="font-medium text-gray-900 dark:text-white mb-2">
                          {t("todos")} ({currentStageDetail.todos.length})
                        </h6>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {currentStageDetail.todos.map((todo, index) => (
                            <div key={todo.id || index} className="flex items-center space-x-2 text-sm">
                              <div className={`w-2 h-2 rounded-full ${
                                todo.is_done ? "bg-green-500" : 
                                (todo.due_date && new Date(todo.due_date) < new Date()) ? "bg-red-500" : 
                                "bg-gray-400"
                              }`} />
                              <span className={todo.is_done ? "line-through text-gray-500" : ""}>
                                {todo.title}
                              </span>
                              {todo.due_date && !todo.is_done && (
                                <span className="text-xs text-gray-500">
                                  {new Date(todo.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Comments */}
                    {currentStageDetail.comments && currentStageDetail.comments.length > 0 && (
                      <div>
                        <h6 className="font-medium text-gray-900 dark:text-white mb-2">
                          {t("recentComments")} ({currentStageDetail.comments.length})
                        </h6>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {currentStageDetail.comments.slice(0, 3).map((comment, index) => (
                            <div key={comment.id || index} className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-xs">
                                  {comment.user_name || "Unknown"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 text-xs">
                                {comment.body}
                              </p>
                            </div>
                          ))}
                          {currentStageDetail.comments.length > 3 && (
                            <p className="text-xs text-gray-500 text-center">
                              +{currentStageDetail.comments.length - 3} {t("moreComments")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* No stage data message */}
                    {(!currentStageDetail.todos || currentStageDetail.todos.length === 0) && 
                     (!currentStageDetail.comments || currentStageDetail.comments.length === 0) && (
                      <div className="text-center py-4 text-sm text-gray-500">
                        {t("noStageDataYet")}
                      </div>
                    )}
                  </div>
                )}

                {!loading && !error && !currentStageDetail && (
                  <div className="text-center py-4 text-sm text-gray-500">
                    {t("noCurrentStage")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}