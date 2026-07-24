import React, { useState, useEffect } from "react";
import { sileo } from "sileo";

export default function SettingsPage() {
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", fullName: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInspectors();
  }, []);

  const loadInspectors = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/get-inspectors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInspectors(data.inspectors || []);
    } catch (e) {
      sileo.error({ title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInspector = async (e) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password.trim() || !formData.fullName.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/create-inspector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      sileo.success({ title: "Inspector created", description: formData.email });
      setFormData({ email: "", password: "", fullName: "" });
      setShowForm(false);
      await loadInspectors();
    } catch (e) {
      sileo.error({ title: "Error", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInspector = async (inspectorId, inspectorName) => {
    if (!confirm(`Delete inspector ${inspectorName}?`)) return;
    try {
      setLoading(true);
      const res = await fetch("/api/delete-inspector", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      sileo.success({ title: "Inspector deleted" });
      await loadInspectors();
    } catch (e) {
      sileo.error({ title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Settings</h1>

        {/* Inspectors Management */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inspectors</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create and manage inspector accounts</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showForm ? "Cancel" : "+ Add Inspector"}
            </button>
          </div>

          {showForm && (
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              <form onSubmit={handleCreateInspector} className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Inspector name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="inspector@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Creating..." : "Create Inspector"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading inspectors...</div>
            ) : inspectors.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No inspectors yet. Create one to get started.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {inspectors.map((inspector) => (
                    <tr key={inspector.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                        {inspector.full_name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{inspector.email}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteInspector(inspector.id, inspector.full_name)}
                          disabled={loading}
                          className="px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
