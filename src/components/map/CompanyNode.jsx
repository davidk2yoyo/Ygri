import React from "react";

export default function CompanyNode({ data }) {
  return (
    <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full shadow-lg border-2 border-blue-500 min-w-[200px]">
      <div className="text-center">
        <div className="font-bold text-lg">{data.label}</div>
        <div className="text-xs opacity-90 mt-1">
          {data.totalClients} Clients • {data.totalProjects} Projects
        </div>
      </div>
    </div>
  );
}