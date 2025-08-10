import React from "react";

export default function SavedViews({ 
  savedViews = [], 
  onSaveView, 
  onLoadView 
}) {
  return (
    <div className="p-4">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Views</h4>
      <p className="text-sm text-gray-500">Saved views coming soon...</p>
    </div>
  );
}