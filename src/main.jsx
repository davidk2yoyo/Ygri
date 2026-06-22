// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "./Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MapPage from "./pages/MapPage";
import ProjectsPage from "./pages/ProjectsPage";
import ClientsPage from "./pages/ClientsPage";
import FilesPage from "./pages/FilesPage";
import InvoicesPage from "./pages/InvoicesPage";
import SuppliersPage from "./pages/SuppliersPage";
import SettingsPage from "./pages/SettingsPage";
import TasksPage from "./pages/TasksPage";
import EmailThreadsPage from "./pages/EmailThreadsPage";
import ItemsPage from "./pages/ItemsPage";
import PublicQuotationPage from "./pages/PublicQuotationPage";
import AnnexEditorPage from "./pages/AnnexEditorPage";
import AnnexPublicPage from "./pages/AnnexPublicPage";
import InspectionReportsPage from "./pages/InspectionReportsPage";
import InspectionReportEditorPage from "./pages/InspectionReportEditorPage";
import InspectionReportPublicPage from "./pages/InspectionReportPublicPage";
import CalendarPage from "./pages/CalendarPage";
import "./index.css";
import "./i18n";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/q/:quoteNumber" element={<PublicQuotationPage />} />
        <Route path="/a/:annexNumber" element={<AnnexPublicPage />} />
        <Route path="/r/:reportNumber" element={<InspectionReportPublicPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/emails" element={<EmailThreadsPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/reports" element={<InspectionReportsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/quotations/:quotationId/annex" element={<AnnexEditorPage />} />
        </Route>
        <Route path="/reports/:reportId/edit" element={
          <ProtectedRoute>
            <InspectionReportEditorPage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
);
