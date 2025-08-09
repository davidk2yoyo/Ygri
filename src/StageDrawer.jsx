import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function StageDrawer({ stageId, onClose, onUpdate }) {
  const [stageDetail, setStageDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  
  // Form states
  const [commentDraft, setCommentDraft] = useState("");
  const [todoDraft, setTodoDraft] = useState("");
  const [newTodoDueDate, setNewTodoDueDate] = useState("");

  // Load stage details
  useEffect(() => {
    if (!stageId) return;
    
    const loadStageDetail = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_stage_detail", { 
          p_track_stage_id: stageId 
        });
        if (error) throw error;
        setStageDetail(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadStageDetail();
  }, [stageId]);

  // Add comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentDraft.trim() || busy) return;
    
    try {
      setBusy(true);
      await supabase.rpc("add_stage_comment", {
        p_track_stage_id: stageId,
        p_body: commentDraft.trim()
      });
      
      // Reload stage detail
      const { data } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(data);
      setCommentDraft("");
      onUpdate?.(); // Refresh parent component
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Add todo
  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!todoDraft.trim() || busy) return;
    
    try {
      setBusy(true);
      await supabase.rpc("add_stage_todo", {
        p_track_stage_id: stageId,
        p_title: todoDraft.trim(),
        p_due_date: newTodoDueDate || null
      });
      
      // Reload stage detail
      const { data } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(data);
      setTodoDraft("");
      setNewTodoDueDate("");
      onUpdate?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Toggle todo completion
  const handleToggleTodo = async (todoId, currentDone) => {
    try {
      setBusy(true);
      await supabase.rpc("update_stage_todo", {
        p_todo_id: todoId,
        p_done: !currentDone
      });
      
      // Reload stage detail
      const { data } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(data);
      onUpdate?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Complete stage and advance
  const handleCompleteStage = async () => {
    try {
      setBusy(true);
      await supabase.rpc("complete_stage_and_advance", { 
        p_track_stage_id: stageId 
      });
      
      onUpdate?.(); // This will refresh the parent view
      onClose?.(); // Close the drawer since stage has changed
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!stageId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-end z-50">
      <div className="w-96 h-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Stage Details</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && <div className="text-center py-4">Loading...</div>}
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {stageDetail && (
            <>
              {/* Stage Info */}
              <div className="space-y-3">
                <h3 className="font-semibold">{stageDetail.stage?.name}</h3>
                <div className="text-sm text-gray-600">
                  <p>Status: <span className="capitalize">{stageDetail.stage?.status?.replace('_', ' ')}</span></p>
                  <p>Due: {stageDetail.stage?.due_date || '—'}</p>
                  {stageDetail.stage?.assignee_name && (
                    <p>Assigned to: {stageDetail.stage.assignee_name}</p>
                  )}
                </div>
                
                {/* Complete Stage Button */}
                {stageDetail.stage?.status === 'in_progress' && (
                  <button
                    onClick={handleCompleteStage}
                    disabled={busy}
                    className="w-full py-2 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-green-700 transition"
                  >
                    {busy ? "Completing..." : "Complete & Advance to Next Stage"}
                  </button>
                )}
              </div>

              {/* Todos Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Todos ({stageDetail.todos?.length || 0})</h4>
                </div>
                
                {/* Todo list */}
                <div className="space-y-2 mb-4">
                  {stageDetail.todos?.map((todo) => (
                    <div key={todo.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={todo.is_done}
                        onChange={() => handleToggleTodo(todo.id, todo.is_done)}
                        disabled={busy}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className={`text-sm ${todo.is_done ? 'line-through text-gray-500' : ''}`}>
                          {todo.title}
                        </p>
                        {todo.due_date && (
                          <p className="text-xs text-gray-500">Due: {todo.due_date}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add todo form */}
                <form onSubmit={handleAddTodo} className="space-y-2">
                  <input
                    type="text"
                    value={todoDraft}
                    onChange={(e) => setTodoDraft(e.target.value)}
                    placeholder="Add a todo..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
                      className="flex-1 px-2 py-1 border rounded text-sm"
                      placeholder="Due date"
                    />
                    <button
                      type="submit"
                      disabled={!todoDraft.trim() || busy}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </div>

              {/* Comments Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Comments ({stageDetail.comments?.length || 0})</h4>
                </div>
                
                {/* Comments list */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {stageDetail.comments?.map((comment) => (
                    <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{comment.user_name || 'Unknown'}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.body}</p>
                    </div>
                  ))}
                </div>

                {/* Add comment form */}
                <form onSubmit={handleAddComment} className="space-y-2">
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!commentDraft.trim() || busy}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {busy ? "Adding..." : "Add Comment"}
                  </button>
                </form>
              </div>

              {/* Files Section */}
              {stageDetail.files?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Files ({stageDetail.files.length})</h4>
                  <div className="space-y-2">
                    {stageDetail.files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{file.label || file.file_path.split('/').pop()}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="text-blue-600 text-sm hover:underline">
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}