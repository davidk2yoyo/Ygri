import React from "react";

export default function DetailsPanel({ 
  isOpen, 
  selectedNode, 
  onClose 
}) {
  if (!isOpen || !selectedNode) return null;
  
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 z-50 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {selectedNode.type === "company" ? "Company" : 
           selectedNode.type === "client" ? "Client" : "Project"} Details
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
              <p><span className="font-medium">Risk Level:</span> {selectedNode.data.risk}</p>
              <p><span className="font-medium">Projects:</span> {selectedNode.data.tracks?.length || 0}</p>
              {selectedNode.data.email && (
                <p><span className="font-medium">Email:</span> {selectedNode.data.email}</p>
              )}
              {selectedNode.data.website && (
                <p><span className="font-medium">Website:</span> {selectedNode.data.website}</p>
              )}
            </div>
          )}
          
          {selectedNode.type === "project" && (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Status:</span> {selectedNode.data.status}</p>
              <p><span className="font-medium">Progress:</span> {selectedNode.data.progress}%</p>
              <p><span className="font-medium">Owner:</span> {selectedNode.data.ownerName}</p>
              {selectedNode.data.nextDue && (
                <p><span className="font-medium">Next Due:</span> {selectedNode.data.nextDue}</p>
              )}
              {selectedNode.data.overdue && (
                <p className="text-red-600"><span className="font-medium">Status:</span> OVERDUE</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}