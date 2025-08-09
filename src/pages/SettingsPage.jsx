import React from "react";

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Application Settings</h3>
            <p>Configure your CRM preferences and account settings here.</p>
            <p className="text-sm mt-2 text-gray-400">This feature will be implemented soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}