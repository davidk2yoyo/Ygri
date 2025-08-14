import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

export default function StageDrawer({ stageId, onClose, onUpdate, projectName, clientName }) {
  const [stageDetail, setStageDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  
  // Form states
  const [commentDraft, setCommentDraft] = useState("");
  const [todoDraft, setTodoDraft] = useState("");
  const [newTodoDueDate, setNewTodoDueDate] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [fileUpload, setFileUpload] = useState(null);
  const [fileLabel, setFileLabel] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  
  // Enhanced comment states
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [showFileMentions, setShowFileMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);

  // Load current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

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
        console.log('Stage detail data:', data); // Debug log to see available data
        setStageDetail(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadStageDetail();
  }, [stageId]);

  // Helper functions for files
  const isImageFile = (filePath) => {
    const ext = filePath.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  };

  const getFileUrl = (filePath) => {
    const { data } = supabase.storage
      .from("crm-files")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  // File upload handler
  const handleFileUpload = async () => {
    if (!fileUpload || !currentUser) return;

    try {
      setUploadingFile(true);
      
      // Generate unique file name
      const fileExt = fileUpload.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `stage-files/${stageId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("crm-files")
        .upload(filePath, fileUpload);

      if (uploadError) throw uploadError;

      // Insert file record into database using RPC function
      const { error: dbError } = await supabase.rpc("add_stage_file", {
        p_track_stage_id: stageId,
        p_file_path: filePath,
        p_label: fileLabel.trim() || fileUpload.name,
        p_user: currentUser.id
      });

      if (dbError) throw dbError;

      // Reset form and reload data
      setFileUpload(null);
      setFileLabel("");
      const { data } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(data);
    } catch (err) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  // File download handler
  const handleDownloadFile = async (file) => {
    try {
      const { data, error } = await supabase.storage
        .from("crm-files")
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.label || file.file_path.split("/").pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download file");
    }
  };

  // File preview handler
  const handlePreviewFile = (file) => {
    setPreviewFile(file);
  };

  // Add comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentDraft.trim() || busy) return;
    
    try {
      setBusy(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      // Convert clean @filename mentions to UUID storage format
      const storageText = convertMentionsForStorage(commentDraft.trim());
      
      await supabase.rpc("add_stage_comment", {
        p_track_stage_id: stageId,
        p_body: storageText,
        p_user: user.id
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

  // Edit comment
  const handleEditComment = async (commentId) => {
    try {
      setBusy(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      // Convert clean @filename mentions to UUID storage format
      const storageText = convertMentionsForStorage(editCommentText.trim());
      
      // Try to call the RPC function
      const { data, error } = await supabase.rpc("update_stage_comment", {
        p_comment_id: commentId,
        p_new_body: storageText,
        p_user: user.id
      });
      
      if (error) {
        console.error("Update comment RPC error:", error);
        throw new Error(`Failed to update comment: ${error.message}`);
      }
      
      // Reload stage detail
      const { data: stageData } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(stageData);
      setEditingCommentId(null);
      setEditCommentText("");
      onUpdate?.();
    } catch (e) {
      console.error("Edit comment error:", e);
      setError(e.message || "Failed to edit comment");
    } finally {
      setBusy(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    
    try {
      setBusy(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      // Try to call the RPC function
      const { data, error } = await supabase.rpc("delete_stage_comment", {
        p_comment_id: commentId,
        p_user: user.id
      });
      
      if (error) {
        console.error("Delete comment RPC error:", error);
        throw new Error(`Failed to delete comment: ${error.message}`);
      }
      
      // Reload stage detail
      const { data: stageData } = await supabase.rpc("get_stage_detail", { 
        p_track_stage_id: stageId 
      });
      setStageDetail(stageData);
      onUpdate?.();
    } catch (e) {
      console.error("Delete comment error:", e);
      setError(e.message || "Failed to delete comment");
    } finally {
      setBusy(false);
    }
  };

  // Start editing comment
  const startEditingComment = (comment) => {
    setEditingCommentId(comment.id);
    // Convert from storage format to clean display format for editing
    const displayText = comment.body.replace(/@\{([a-f0-9\-]+):(.*?)\}/g, '@$2');
    setEditCommentText(displayText);
  };

  // Cancel editing comment
  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditCommentText("");
  };

  // Handle @ file mentions in comment
  const handleCommentTextChange = (e, isEdit = false) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    if (isEdit) {
      setEditCommentText(text);
    } else {
      setCommentDraft(text);
    }
    
    setCursorPosition(cursorPos);
    
    // Check for @ mentions
    const beforeCursor = text.substring(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1 && atIndex === beforeCursor.length - 1) {
      // Just typed @, show file mentions
      setShowFileMentions(true);
      setMentionQuery("");
    } else if (atIndex !== -1) {
      // Check if we're in the middle of a mention
      const afterAt = beforeCursor.substring(atIndex + 1);
      const spaceIndex = afterAt.indexOf(" ");
      
      if (spaceIndex === -1) {
        // Still typing mention
        setShowFileMentions(true);
        setMentionQuery(afterAt);
      } else {
        setShowFileMentions(false);
      }
    } else {
      setShowFileMentions(false);
    }
  };

  // Insert file mention
  const insertFileMention = (file, isEdit = false) => {
    const currentText = isEdit ? editCommentText : commentDraft;
    const beforeCursor = currentText.substring(0, cursorPosition);
    const afterCursor = currentText.substring(cursorPosition);
    
    // Find the @ that started the mention
    const atIndex = beforeCursor.lastIndexOf("@");
    const beforeAt = currentText.substring(0, atIndex);
    
    // Show only clean filename to user, but store UUID format for backend
    const fileName = file.label || file.file_path.split("/").pop();
    const mentionText = `@${fileName}`;  // Clean display format
    const newText = beforeAt + mentionText + " " + afterCursor;
    
    if (isEdit) {
      setEditCommentText(newText);
    } else {
      setCommentDraft(newText);
    }
    
    setShowFileMentions(false);
    setMentionQuery("");
  };

  // Parse file mentions in comment text
  const parseFileMentions = (text) => {
    // Updated regex to match UUID format (with hyphens)
    const mentionRegex = /@\{([a-f0-9\-]+):(.*?)\}/g;
    let lastIndex = 0;
    const parts = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: text.substring(lastIndex, match.index) });
      }
      
      // Add the mention
      parts.push({
        type: "mention",
        fileId: match[1],
        fileName: match[2],
        content: `@${match[2]}`
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.substring(lastIndex) });
    }
    
    return parts;
  };

  // Filter files for mentions
  const getFilteredFiles = () => {
    if (!stageDetail?.files) return [];
    
    return stageDetail.files.filter(file => {
      const fileName = file.label || file.file_path.split("/").pop();
      return fileName.toLowerCase().includes(mentionQuery.toLowerCase());
    });
  };

  // Convert clean @filename format to UUID storage format before saving
  const convertMentionsForStorage = (text) => {
    if (!stageDetail?.files) return text;
    
    // Replace @filename with @{uuid:filename} format
    let convertedText = text;
    
    // Find all @filename mentions
    const mentionRegex = /@([^@\s]+)/g;
    let match;
    const replacements = [];
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const fileName = match[1];
      // Find the file by filename
      const file = stageDetail.files.find(f => {
        const fName = f.label || f.file_path.split("/").pop();
        return fName === fileName;
      });
      
      if (file) {
        replacements.push({
          original: match[0],
          replacement: `@{${file.id}:${fileName}}`
        });
      }
    }
    
    // Apply replacements
    replacements.forEach(({ original, replacement }) => {
      convertedText = convertedText.replace(original, replacement);
    });
    
    return convertedText;
  };

  // Add todo
  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!todoDraft.trim() || busy) return;
    
    try {
      setBusy(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      await supabase.rpc("add_stage_todo", {
        p_track_stage_id: stageId,
        p_title: todoDraft.trim(),
        p_due: newTodoDueDate || null,
        p_assignee: null, // Can be set to user.id if you want to auto-assign
        p_user: user.id
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-end z-50 font-urbanist">
      <div className="w-[900px] h-full bg-white dark:bg-darkblack-600 shadow-xl flex flex-col border-l border-bgray-200 dark:border-darkblack-400">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bgray-200 dark:border-darkblack-400">
          <h2 className="text-lg font-semibold text-darkblack-700 dark:text-white">
            Stage Details
            {clientName && ` - ${clientName}`}
            {projectName && ` - ${projectName}`}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded-lg text-bgray-600 dark:text-bgray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="spinner h-6 w-6 mr-3"></div>
              <span className="text-bgray-600 dark:text-bgray-300">Loading stage details...</span>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-error-300 text-sm m-6">
              {error}
            </div>
          )}

          {stageDetail && (
            <div className="grid grid-cols-2 gap-6 p-6 h-full">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Stage Info */}
                <div className="bg-bgray-50 dark:bg-darkblack-500 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-darkblack-700 dark:text-white mb-2">
                    {stageDetail.stage?.name}
                  </h3>
                  
                  
                  <div className="text-sm text-gray-600">
                    <p>Status: <span className="capitalize">{stageDetail.stage?.status?.replace("_", " ")}</span></p>
                    <p>Due: {stageDetail.stage?.due_date || "—"}</p>
                    {stageDetail.stage?.assignee_name && (
                      <p>Assigned to: {stageDetail.stage.assignee_name}</p>
                    )}
                  </div>
                </div>
                
                {/* Complete Stage Button */}
                <div>
                  {stageDetail.stage?.status === "in_progress" && (
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
                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {stageDetail.todos?.map((todo) => (
                      <div key={todo.id} className="flex items-center gap-3 p-3 bg-white dark:bg-darkblack-500 rounded-lg border border-bgray-200 dark:border-darkblack-400">
                        <input
                          type="checkbox"
                          checked={todo.is_done}
                          onChange={() => handleToggleTodo(todo.id, todo.is_done)}
                          className="rounded border-bgray-300 text-primary focus:ring-primary"
                          disabled={busy}
                        />
                        <div className="flex-1">
                          <p className={`text-sm ${todo.is_done ? "line-through text-gray-500" : "text-darkblack-700 dark:text-white"}`}>
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
                  <form onSubmit={handleAddTodo} className="space-y-3">
                    <input
                      type="text"
                      value={todoDraft}
                      onChange={(e) => setTodoDraft(e.target.value)}
                      placeholder="Add a todo..."
                      disabled={busy}
                      className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white placeholder-bgray-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newTodoDueDate}
                        onChange={(e) => setNewTodoDueDate(e.target.value)}
                        disabled={busy}
                        className="flex-1 px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={!todoDraft.trim() || busy}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {busy ? "Adding..." : "Add"}
                      </button>
                    </div>
                  </form>
                </div>

              </div>
              
              {/* Right Column */}
              <div className="space-y-6">
                {/* Files Section */}
                <div>
                  <h4 className="font-medium mb-3">Files ({stageDetail.files?.length || 0})</h4>
                  
                  {/* File Upload Form */}
                  <div className="mb-4 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                    <input
                      type="file"
                      onChange={(e) => setFileUpload(e.target.files[0])}
                      disabled={uploadingFile}
                      className="block w-full text-sm text-gray-500 mb-2 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                      accept="*/*"
                    />
                    {fileUpload && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={fileLabel}
                          onChange={(e) => setFileLabel(e.target.value)}
                          placeholder="File label (optional)"
                          disabled={uploadingFile}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-2 disabled:bg-gray-50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleFileUpload}
                            disabled={uploadingFile || !fileUpload}
                            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center"
                          >
                            {uploadingFile && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            )}
                            {uploadingFile ? "Uploading..." : "Upload File"}
                          </button>
                          <button
                            onClick={() => {
                              setFileUpload(null);
                              setFileLabel("");
                            }}
                            disabled={uploadingFile}
                            className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Files List */}
                  {stageDetail.files?.length > 0 && (
                    <div className="space-y-2">
                      {stageDetail.files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{file.label || file.file_path.split("/").pop()}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded by {file.uploaded_by_name || "Unknown"} on {new Date(file.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {isImageFile(file.file_path) && (
                              <button
                                onClick={() => handlePreviewFile(file)}
                                className="text-blue-600 text-sm hover:underline"
                              >
                                Preview
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadFile(file)}
                              className="text-green-600 text-sm hover:underline"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Comments ({stageDetail.comments?.length || 0})</h4>
                  </div>
                  
                  {/* Comments list */}
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {stageDetail.comments?.map((comment) => (
                      <div key={comment.id} className="p-3 bg-white dark:bg-darkblack-500 rounded-lg border border-bgray-200 dark:border-darkblack-400 group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-darkblack-700 dark:text-white">
                            {comment.user_name || 
                             (comment.user_id === currentUser?.id ? (currentUser?.email?.split("@")[0] || "You") : "Unknown")}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-bgray-500 dark:text-bgray-400">
                              {new Date(comment.created_at).toLocaleDateString()}
                              {comment.updated_at && comment.updated_at !== comment.created_at && (
                                <span className="ml-1 italic">(edited)</span>
                              )}
                            </span>
                            {/* Edit/Delete buttons for own comments */}
                            {comment.user_id === currentUser?.id && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEditingComment(comment)}
                                  className="p-1 hover:bg-bgray-100 dark:hover:bg-darkblack-400 rounded text-bgray-500 hover:text-primary transition-colors"
                                  title="Edit comment"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-bgray-500 hover:text-red-600 transition-colors"
                                  title="Delete comment"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Comment content - editable or display */}
                        {editingCommentId === comment.id ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <textarea
                                value={editCommentText}
                                onChange={(e) => handleCommentTextChange(e, true)}
                                rows={3}
                                className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white"
                              />
                              
                              {/* File mention dropdown for edit mode */}
                              {showFileMentions && getFilteredFiles().length > 0 && (
                                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                  {getFilteredFiles().map(file => (
                                    <button
                                      key={file.id}
                                      onClick={() => insertFileMention(file, true)}
                                      className="w-full text-left px-3 py-2 hover:bg-bgray-50 dark:hover:bg-darkblack-400 text-sm flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      {file.label || file.file_path.split("/").pop()}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditComment(comment.id)}
                                disabled={!editCommentText.trim() || busy}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50 hover:bg-blue-700 transition-colors"
                              >
                                {busy ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEditingComment}
                                className="px-3 py-1 bg-bgray-200 dark:bg-darkblack-400 text-bgray-700 dark:text-bgray-200 rounded text-xs hover:bg-bgray-300 dark:hover:bg-darkblack-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-bgray-700 dark:text-bgray-300">
                            {/* Render comment with file mentions */}
                            {parseFileMentions(comment.body).map((part, index) => (
                              part.type === "mention" ? (
                                <button
                                  key={index}
                                  onClick={() => {
                                    const file = stageDetail.files?.find(f => f.id === part.fileId);
                                    if (file) setPreviewFile(file);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {part.content}
                                </button>
                              ) : (
                                <span key={index}>{part.content}</span>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add comment form */}
                  <form onSubmit={handleAddComment} className="space-y-3">
                    <div className="relative">
                      <textarea
                        value={commentDraft}
                        onChange={(e) => handleCommentTextChange(e, false)}
                        placeholder="Add a comment... (Type @ to mention files)"
                        rows={3}
                        disabled={busy}
                        className="w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white placeholder-bgray-500"
                      />
                      
                      {/* File mention dropdown for new comments */}
                      {showFileMentions && getFilteredFiles().length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {getFilteredFiles().map(file => (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => insertFileMention(file, false)}
                              className="w-full text-left px-3 py-2 hover:bg-bgray-50 dark:hover:bg-darkblack-400 text-sm flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {file.label || file.file_path.split("/").pop()}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={!commentDraft.trim() || busy}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
                    >
                      {busy ? "Adding..." : "Add Comment"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced File Preview Modal */}
      {previewFile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" 
          onClick={() => setPreviewFile(null)}
        >
          <div 
            className="max-w-5xl max-h-5xl w-full mx-4 bg-white dark:bg-darkblack-600 rounded-lg shadow-xl" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-bgray-200 dark:border-darkblack-400">
              <h3 className="font-semibold text-lg text-darkblack-700 dark:text-white">
                {previewFile.label || previewFile.file_path.split("/").pop()}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadFile(previewFile)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 hover:bg-bgray-100 dark:hover:bg-darkblack-500 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 max-h-[70vh] overflow-auto">
              {isImageFile(previewFile.file_path) ? (
                <img
                  src={getFileUrl(previewFile.file_path)}
                  alt={previewFile.label || "Preview"}
                  className="max-w-full h-auto rounded-lg mx-auto"
                />
              ) : previewFile.file_path.endsWith('.pdf') ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-bgray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-bgray-600 dark:text-bgray-300 mb-4">PDF Document</p>
                  <a
                    href={getFileUrl(previewFile.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-bgray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-bgray-600 dark:text-bgray-300 mb-4">
                    File Type: {previewFile.file_path.split('.').pop()?.toUpperCase() || 'Unknown'}
                  </p>
                  <p className="text-sm text-bgray-500 dark:text-bgray-400 mb-4">
                    This file type cannot be previewed. You can download it to view the contents.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}