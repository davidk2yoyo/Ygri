import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";

// CSV utility functions
const downloadCSV = (data, filename) => {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const parseCSV = (text) => {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
};

function BulkImportModal({ isOpen, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setCsvData([]);
      setPreviewData([]);
      setError('');
      setValidationErrors([]);
    }
  }, [isOpen]);

  const downloadSample = () => {
    const sampleData = `company_name,contact_person,email,phone,website,address,remark
"Acme Corp","John Doe","john@acmecorp.com","+1-555-0123","https://acmecorp.com","123 Main St, City, State 12345","Important client"
"Tech Solutions","Jane Smith","jane@techsolutions.com","+1-555-0456","https://techsolutions.com","456 Tech Ave, Silicon Valley, CA 94105","New partnership"`;
    downloadCSV(sampleData, 'clients_sample.csv');
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('Please select a valid CSV file');
      return;
    }

    setFile(selectedFile);
    setError('');

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setPreviewData(parsed.slice(0, 5)); // Show first 5 rows for preview
      validateData(parsed);
    } catch (err) {
      setError('Failed to parse CSV file: ' + err.message);
    }
  };

  const validateData = (data) => {
    const errors = [];
    data.forEach((row, index) => {
      if (!row.company_name?.trim()) {
        errors.push(`Row ${index + 2}: Company name is required`);
      }
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Row ${index + 2}: Invalid email format`);
      }
    });
    setValidationErrors(errors);
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      setError('Please fix validation errors before importing');
      return;
    }

    try {
      setImporting(true);
      setError('');

      const validData = csvData
        .filter(row => row.company_name?.trim())
        .map(row => ({
          company_name: row.company_name?.trim() || null,
          contact_person: row.contact_person?.trim() || null,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          website: row.website?.trim() || null,
          address: row.address?.trim() || null,
          remark: row.remark?.trim() || null
        }));

      const { error } = await supabase
        .from('clients')
        .insert(validData);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to import clients');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t("bulkImportClients")}</h3>
          
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{t("step1")}</h4>
                <button
                  onClick={downloadSample}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  {t("downloadSample")}
                </button>
              </div>
              <p className="text-sm text-gray-600">
                Download the sample CSV file, modify it with your client data, then upload it below.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">{t("step2")}</h4>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {validationErrors.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <h5 className="font-medium text-yellow-800 mb-2">{t("validationErrors")}</h5>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {validationErrors.slice(0, 10).map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                  {validationErrors.length > 10 && (
                    <li>• ... and {validationErrors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}

            {previewData.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">{t("step3", { count: csvData.length })}</h4>
                <div className="overflow-x-auto max-h-60 border border-gray-200 rounded">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">{row.company_name || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{row.contact_person || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{row.email || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{row.phone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2">Showing first 5 rows of {csvData.length} total rows</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || csvData.length === 0 || validationErrors.length > 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {importing && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {importing ? t('importing') : t('importClients', { count: csvData.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    company_name: "",
    email: "",
    contact_person: "",
    phone: "",
    website: "",
    address: "",
    remark: ""
  });
  const [formError, setFormError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  const itemsPerPage = 10;

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, contact_person, email, phone, website, remark, created_at")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      setError("Failed to load clients");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(client =>
      client.company_name?.toLowerCase().includes(term) ||
      client.contact_person?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.phone?.toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(startIndex + itemsPerPage - 1, filteredClients.length);

  const resetForm = () => {
    setFormData({
      company_name: "",
      email: "",
      contact_person: "",
      phone: "",
      website: "",
      address: "",
      remark: ""
    });
    setFormError("");
    setEditingClient(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setFormData({
      company_name: client.company_name || "",
      email: client.email || "",
      contact_person: client.contact_person || "",
      phone: client.phone || "",
      website: client.website || "",
      address: client.address || "",
      remark: client.remark || ""
    });
    setEditingClient(client);
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.company_name.trim()) {
      setFormError("Company name is required");
      return;
    }

    try {
      setSubmitLoading(true);
      setFormError("");

      const submitData = {
        company_name: formData.company_name.trim(),
        email: formData.email.trim() || null,
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        address: formData.address.trim() || null,
        remark: formData.remark.trim() || null
      };

      if (editingClient) {
        const { data, error } = await supabase
          .from("clients")
          .update(submitData)
          .eq("id", editingClient.id)
          .select()
          .single();
        
        if (error) throw error;
        
        setClients(prev => prev.map(client => 
          client.id === editingClient.id ? { ...client, ...data } : client
        ));
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert([submitData])
          .select()
          .single();
        
        if (error) throw error;
        
        setClients(prev => [data, ...prev]);
      }
      
      closeModal();
    } catch (err) {
      setFormError(err.message || "Failed to save client");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (client) => {
    if (!window.confirm(`Are you sure you want to delete ${client.company_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);
      
      if (error) throw error;
      
      setClients(prev => prev.filter(c => c.id !== client.id));
    } catch (err) {
      setError("Failed to delete client");
      console.error(err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && showModal) {
      handleSubmit(e);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">{t("clients")}</h1>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder={t("searchClients")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const csvContent = [
                    'company_name,contact_person,email,phone,website,address,remark',
                    ...filteredClients.map(client => 
                      `"${client.company_name || ''}","${client.contact_person || ''}","${client.email || ''}","${client.phone || ''}","${client.website || ''}","${client.address || ''}","${client.remark || ''}"`
                    )
                  ].join('\n');
                  downloadCSV(csvContent, 'clients_export.csv');
                }}
                disabled={filteredClients.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("exportCSV")}
              </button>
              <button
                onClick={() => setShowBulkImportModal(true)}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 border border-gray-800 font-medium"
              >
                {t("bulkImport")}
              </button>
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {t("addClient")}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              {t("loadingClients")}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <div className="text-4xl mb-4">⚠️</div>
              <p>{error}</p>
              <button
                onClick={fetchClients}
                className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? t("noClientsFound") : t("noClientsYet")}
              </h3>
              <p>
                {searchTerm
                  ? t("tryAdjusting")
                  : t("addFirstClient")}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("company")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("contact")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("email")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("phone")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("website")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("remark")}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedClients.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{client.company_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-900">{client.contact_person || "-"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-900">{client.email || "-"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-900">{client.phone || "-"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {client.website ? (
                            <a
                              href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {client.website}
                            </a>
                          ) : (
                            <span className="text-gray-900">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-gray-900 max-w-xs truncate">{client.remark || "-"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(client)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            {t("edit")}
                          </button>
                          <button
                            onClick={() => handleDelete(client)}
                            className="text-red-600 hover:text-red-900"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {totalPages > 1 && (
                <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 bg-white">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{startIndex}</span> to{" "}
                        <span className="font-medium">{endIndex}</span> of{" "}
                        <span className="font-medium">{filteredClients.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingClient ? t("editClient") : t("addNewClient")}
              </h3>
              <form onSubmit={handleSubmit} onKeyPress={handleKeyPress}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("companyName")} *
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("contactPerson")}
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remark
                    </label>
                    <textarea
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                {formError && (
                  <div className="mt-3 text-sm text-red-600">
                    {formError}
                  </div>
                )}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {submitLoading ? t("saving") : editingClient ? t("update") : t("addClient")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={() => {
          fetchClients();
          setShowBulkImportModal(false);
        }}
      />
    </div>
  );
}