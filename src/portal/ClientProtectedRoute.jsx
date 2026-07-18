import React from "react";
import { Navigate } from "react-router-dom";
import { useClientPortal } from "./ClientPortalContext";

export default function ClientProtectedRoute({ children }) {
  const { session, loading } = useClientPortal();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/clientes/login" replace />;
  return children;
}
