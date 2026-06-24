import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const CARRIERS = [
  "DHL",
  "DHL Express",
  "FedEx",
  "UPS",
  "SF Express",
  "EMS",
  "China Post",
  "Maersk",
  "COSCO",
  "MSC",
  "Other",
];

const STATUS_OPTIONS = [
  { value: "pending",    label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "customs",    label: "Customs" },
  { value: "delivered",  label: "Delivered" },
  { value: "exception",  label: "Exception" },
];

const FILTER_CHIPS = [
  { value: "all",        label: "All",        color: "bg-bgray-100 text-bgray-600 dark:bg-darkblack-500 dark:text-bgray-300 border border-bgray-200 dark:border-darkblack-400" },
  { value: "in_transit", label: "In Transit", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800" },
  { value: "customs",    label: "Customs",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  { value: "delivered",  label: "Delivered",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800" },
  { value: "exception",  label: "Exception",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800" },
  { value: "pending",    label: "Pending",    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700" },
];

function getCarrierBadge(carrier) {
  if (!carrier) return { abbrev: "??", colorClass: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
  const c = carrier.toLowerCase();
  if (c.includes("dhl"))    return { abbrev: "DH", colorClass: "bg-yellow-400 text-yellow-900" };
  if (c.includes("fedex"))  return { abbrev: "FX", colorClass: "bg-purple-600 text-white" };
  if (c.includes("ups"))    return { abbrev: "UP", colorClass: "bg-amber-700 text-white" };
  if (c.includes("sf"))     return { abbrev: "SF", colorClass: "bg-red-600 text-white" };
  if (c.includes("ems"))    return { abbrev: "EM", colorClass: "bg-green-600 text-white" };
  if (c.includes("maersk")) return { abbrev: "MK", colorClass: "bg-blue-700 text-white" };
  if (c.includes("cosco"))  return { abbrev: "CO", colorClass: "bg-blue-500 text-white" };
  if (c.includes("msc"))    return { abbrev: "MC", colorClass: "bg-indigo-600 text-white" };
  if (c.includes("china"))  return { abbrev: "CP", colorClass: "bg-red-400 text-white" };
  return { abbrev: carrier.slice(0, 2).toUpperCase(), colorClass: "bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200" };
}

function getStatusChip(status) {
  switch (status) {
    case "pending":    return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    case "in_transit": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "customs":    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "delivered":  return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "exception":  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    default:           return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
}

function getTrackingUrl(carrier, trackingNumber) {
  if (!carrier || !trackingNumber) return null;
  const c = carrier.toLowerCase();
  if (c.includes("dhl"))   return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
  if (c.includes("fedex")) return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`;
  if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c.includes("sf"))    return `https://www.sf-express.com/en_US/dynamic_function/waybill/#search/bill-number/${trackingNumber}`;
  return null;
}

function formatETA(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

const BLANK_FORM = {
  tracking_number: "",
  carrier: "DHL",
  description: "",
  status: "pending",
  status_detail: "",
  origin: "",
  destination: "",
  estimated_delivery: "",
  track_id: "",
};

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("shipments")
        .select("*, tracks(name, id)")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setShipments(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTracks = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("tracks")
        .select("id, name")
        .order("name", { ascending: true });
      if (err) throw err;
      setTracks(data || []);
    } catch (e) {
      console.error("Error fetching tracks:", e.message);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
    fetchTracks();
  }, [fetchShipments, fetchTracks]);

  // Filtered shipments
  const filtered = shipments.filter((s) => {
    const matchesFilter = activeFilter === "all" || s.status === activeFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (s.tracking_number || "").toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q) ||
      (s.tracks?.name || "").toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  // Counts per status for chip badges
  const counts = shipments.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const openAddModal = () => {
    setEditingId(null);
    setForm(BLANK_FORM);
    setModalOpen(true);
  };

  const openEditModal = (shipment) => {
    setEditingId(shipment.id);
    setForm({
      tracking_number: shipment.tracking_number || "",
      carrier: shipment.carrier || "DHL",
      description: shipment.description || "",
      status: shipment.status || "pending",
      status_detail: shipment.status_detail || "",
      origin: shipment.origin || "",
      destination: shipment.destination || "",
      estimated_delivery: shipment.estimated_delivery || "",
      track_id: shipment.track_id || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(BLANK_FORM);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.tracking_number.trim()) return;
    setSaving(true);
    try {
      const payload = {
        tracking_number: form.tracking_number.trim(),
        carrier: form.carrier,
        description: form.description.trim(),
        status: form.status,
        status_detail: form.status_detail.trim(),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        estimated_delivery: form.estimated_delivery || null,
        track_id: form.track_id || null,
      };
      if (editingId) {
        const { error: err } = await supabase.from("shipments").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("shipments").insert([payload]);
        if (err) throw err;
      }
      closeModal();
      await fetchShipments();
    } catch (e) {
      alert("Error saving shipment: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error: err } = await supabase.from("shipments").delete().eq("id", id);
      if (err) throw err;
      setDeleteConfirmId(null);
      await fetchShipments();
    } catch (e) {
      alert("Error deleting shipment: " + e.message);
    }
  };

  const refreshTracking = async (shipment) => {
    setRefreshingId(shipment.id);
    try {
      const res = await fetch("/api/17track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "gettrackinfo", numbers: [shipment.tracking_number] }),
      });
      if (!res.ok) throw new Error(`17Track proxy error: ${res.status}`);
      const data = await res.json();
      const accepted = data?.data?.accepted?.[0];
      if (!accepted) throw new Error("Tracking number not found in 17Track");
      const info = accepted.track_info;
      const statusMap = { delivered: "delivered", intransit: "in_transit", pickedup: "in_transit", outfordelivery: "in_transit", availableforpickup: "in_transit", exception: "exception", expired: "exception", undelivered: "exception", deliveryfailure: "exception", attemptfail: "exception", returning: "exception", returned: "exception" };
      const raw = info?.latest_status?.status?.toLowerCase();
      const mappedStatus = statusMap[raw] || null;
      const latestEvent = info?.latest_event;
      const update = {
        ...(mappedStatus && { status: mappedStatus }),
        ...(latestEvent?.description && { status_detail: `${latestEvent.description}${latestEvent.location ? ` — ${latestEvent.location}` : ""}` }),
        ...(info?.time_metrics?.estimated_delivery_date?.from && { estimated_delivery: info.time_metrics.estimated_delivery_date.from }),
        updated_at: new Date().toISOString(),
      };
      const { error: err } = await supabase.from("shipments").update(update).eq("id", shipment.id);
      if (err) throw err;
      await fetchShipments();
    } catch (e) {
      alert("Tracking refresh failed: " + e.message);
    } finally {
      setRefreshingId(null);
    }
  };

  const labelClass = "block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1.5 uppercase tracking-wide";
  const inputClass = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400";

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-darkblack-700 dark:text-white">Shipments</h1>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">
            {loading ? "Loading..." : `${shipments.length} total shipment${shipments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Shipment
        </button>
      </div>

      {/* Filter Chips + Search */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilter === chip.value;
          const count = chip.value === "all" ? shipments.length : (counts[chip.value] || 0);
          return (
            <button
              key={chip.value}
              onClick={() => setActiveFilter(chip.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                isActive
                  ? chip.color + " ring-2 ring-offset-1 ring-primary/40"
                  : chip.color + " opacity-60 hover:opacity-100"
              }`}
            >
              {chip.label}
              <span className="text-xs opacity-75">({count})</span>
            </button>
          );
        })}

        {/* Search */}
        <div className="relative ml-auto flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracking # or description..."
            className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-xl text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3"></div>
            <span className="text-sm text-bgray-500 dark:text-bgray-400">Loading shipments...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-14 h-14 mx-auto mb-3 text-bgray-300 dark:text-bgray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-sm font-semibold text-bgray-600 dark:text-bgray-300 mb-1">No shipments found</p>
            <p className="text-xs text-bgray-400 dark:text-bgray-500">
              {search || activeFilter !== "all"
                ? "Try adjusting your filters."
                : "Add a tracking number to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bgray-200 dark:border-darkblack-400 bg-bgray-50 dark:bg-darkblack-500">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Carrier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Tracking #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">ETA</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-bgray-500 dark:text-bgray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bgray-100 dark:divide-darkblack-400">
                {filtered.map((s) => {
                  const badge = getCarrierBadge(s.carrier);
                  const trackUrl = getTrackingUrl(s.carrier, s.tracking_number);
                  const statusLabel = STATUS_OPTIONS.find(o => o.value === s.status)?.label || s.status;
                  const projectName = s.tracks?.name;
                  const projectId = s.tracks?.id;

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-bgray-50 dark:hover:bg-darkblack-500/50 transition group"
                    >
                      {/* Carrier */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${badge.colorClass}`}>
                            {badge.abbrev}
                          </div>
                          <span className="text-xs text-bgray-600 dark:text-bgray-300 hidden lg:block">{s.carrier}</span>
                        </div>
                      </td>

                      {/* Tracking Number */}
                      <td className="px-4 py-3">
                        {trackUrl ? (
                          <a
                            href={trackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-primary hover:underline"
                            title={s.tracking_number}
                          >
                            {s.tracking_number}
                          </a>
                        ) : (
                          <span className="text-xs font-mono text-darkblack-700 dark:text-white">{s.tracking_number}</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-darkblack-600 dark:text-bgray-200 truncate" title={s.description}>
                          {s.description || <span className="italic text-bgray-400">—</span>}
                        </p>
                        {s.status_detail && (
                          <p className="text-xs text-bgray-400 dark:text-bgray-500 truncate mt-0.5">{s.status_detail}</p>
                        )}
                      </td>

                      {/* Project */}
                      <td className="px-4 py-3">
                        {projectName ? (
                          <button
                            onClick={() => navigate("/projects", { state: { activeTrackId: s.track_id } })}
                            className="text-xs font-semibold text-primary hover:underline bg-primary/10 px-2 py-1 rounded-lg truncate max-w-[120px] block text-left"
                            title={projectName}
                          >
                            {projectName}
                          </button>
                        ) : (
                          <span className="text-xs text-bgray-400 dark:text-bgray-500">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${getStatusChip(s.status)}`}>
                          {statusLabel}
                        </span>
                      </td>

                      {/* Route */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-bgray-500 dark:text-bgray-400">
                          <span className="truncate max-w-[60px]">{s.origin || "—"}</span>
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <span className="truncate max-w-[60px]">{s.destination || "—"}</span>
                        </div>
                      </td>

                      {/* ETA */}
                      <td className="px-4 py-3 text-xs text-bgray-500 dark:text-bgray-400 whitespace-nowrap">
                        {s.estimated_delivery ? formatETA(s.estimated_delivery) : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => refreshTracking(s)}
                            disabled={refreshingId === s.id}
                            className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 dark:text-blue-400 transition disabled:opacity-50"
                            title="Refresh tracking"
                          >
                            <svg
                              className={`w-4 h-4 ${refreshingId === s.id ? "animate-spin" : ""}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 rounded-lg hover:bg-bgray-200 dark:hover:bg-darkblack-400 text-bgray-500 dark:text-bgray-300 transition"
                            title="Edit shipment"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirmId === s.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(s.id)}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 text-xs border border-bgray-300 dark:border-darkblack-400 text-bgray-600 dark:text-bgray-300 rounded-lg hover:bg-bgray-100 dark:hover:bg-darkblack-400 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(s.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-bgray-500 dark:text-bgray-300 hover:text-red-500 transition"
                              title="Delete shipment"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-bgray-200 dark:border-darkblack-400 sticky top-0 bg-white dark:bg-darkblack-600 z-10">
              <h2 className="text-base font-semibold text-darkblack-700 dark:text-white">
                {editingId ? "Edit Shipment" : "Add Shipment"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-bgray-100 dark:hover:bg-darkblack-500 text-bgray-500 dark:text-bgray-300 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {/* Project Selector */}
              <div>
                <label className={labelClass}>Project</label>
                <select
                  value={form.track_id}
                  onChange={(e) => setForm(f => ({ ...f, track_id: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— No project —</option>
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Tracking Number */}
              <div>
                <label className={labelClass}>Tracking Number *</label>
                <input
                  type="text"
                  value={form.tracking_number}
                  onChange={(e) => setForm(f => ({ ...f, tracking_number: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 1Z999AA10123456784"
                  required
                />
              </div>

              {/* Carrier + Status row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Carrier</label>
                  <select
                    value={form.carrier}
                    onChange={(e) => setForm(f => ({ ...f, carrier: e.target.value }))}
                    className={inputClass}
                  >
                    {CARRIERS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 10x Product A, Sample batch"
                />
              </div>

              {/* Status Detail */}
              <div>
                <label className={labelClass}>Status Detail</label>
                <input
                  type="text"
                  value={form.status_detail}
                  onChange={(e) => setForm(f => ({ ...f, status_detail: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Arrived at customs facility"
                />
              </div>

              {/* Origin + Destination row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Origin</label>
                  <input
                    type="text"
                    value={form.origin}
                    onChange={(e) => setForm(f => ({ ...f, origin: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Shenzhen, CN"
                  />
                </div>
                <div>
                  <label className={labelClass}>Destination</label>
                  <input
                    type="text"
                    value={form.destination}
                    onChange={(e) => setForm(f => ({ ...f, destination: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Los Angeles, US"
                  />
                </div>
              </div>

              {/* ETA */}
              <div>
                <label className={labelClass}>Estimated Delivery</label>
                <input
                  type="date"
                  value={form.estimated_delivery}
                  onChange={(e) => setForm(f => ({ ...f, estimated_delivery: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm border border-bgray-300 dark:border-darkblack-400 text-bgray-600 dark:text-bgray-300 rounded-lg hover:bg-bgray-50 dark:hover:bg-darkblack-500 transition"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition font-semibold disabled:opacity-60"
                  disabled={saving || !form.tracking_number.trim()}
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
