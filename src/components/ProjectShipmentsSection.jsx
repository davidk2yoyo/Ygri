import React, { useState, useEffect, useCallback } from "react";
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
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "customs", label: "Customs" },
  { value: "delivered", label: "Delivered" },
  { value: "exception", label: "Exception" },
];

function getCarrierBadge(carrier) {
  if (!carrier) return { abbrev: "??", colorClass: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
  const c = carrier.toLowerCase();
  if (c.includes("dhl")) return { abbrev: "DH", colorClass: "bg-yellow-400 text-yellow-900" };
  if (c.includes("fedex")) return { abbrev: "FX", colorClass: "bg-purple-600 text-white" };
  if (c.includes("ups")) return { abbrev: "UP", colorClass: "bg-amber-700 text-white" };
  if (c.includes("sf")) return { abbrev: "SF", colorClass: "bg-red-600 text-white" };
  if (c.includes("ems")) return { abbrev: "EM", colorClass: "bg-green-600 text-white" };
  if (c.includes("maersk")) return { abbrev: "MK", colorClass: "bg-blue-700 text-white" };
  if (c.includes("cosco")) return { abbrev: "CO", colorClass: "bg-blue-500 text-white" };
  if (c.includes("msc")) return { abbrev: "MC", colorClass: "bg-indigo-600 text-white" };
  if (c.includes("china")) return { abbrev: "CP", colorClass: "bg-red-400 text-white" };
  return { abbrev: (carrier.slice(0, 2).toUpperCase()), colorClass: "bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200" };
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
  if (c.includes("dhl")) return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
  if (c.includes("fedex")) return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c.includes("sf")) return `https://www.sf-express.com/en_US/dynamic_function/waybill/#search/bill-number/${trackingNumber}`;
  return null;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
};

function map17Status(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "delivered") return "delivered";
  if (["intransit", "pickedup", "outfordelivery", "availableforpickup"].includes(s)) return "in_transit";
  if (["exception", "expired", "undelivered", "deliveryfailure", "attemptfail", "returning", "returned"].includes(s)) return "exception";
  if (["inforeceived", "notfound"].includes(s)) return "pending";
  return null;
}

function get17TrackCode(carrier) {
  if (!carrier) return null;
  const c = carrier.toLowerCase();
  if (c.includes("dhl"))   return 100001;
  if (c.includes("ups"))   return 100002;
  if (c.includes("fedex")) return 100003;
  if (c.includes("tnt"))   return 100004;
  if (c.includes("sf"))    return 100012;
  return null;
}

function buildTrackItem(trackingNumber, carrier) {
  const code = get17TrackCode(carrier);
  return code ? { number: trackingNumber, carrier: code } : { number: trackingNumber };
}

async function call17Track(action, numbers) {
  const res = await fetch("/api/17track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, numbers }),
  });
  if (!res.ok) throw new Error(`17Track proxy error: ${res.status}`);
  return res.json();
}

export default function ProjectShipmentsSection({ trackId }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);

  const fetchShipments = useCallback(async () => {
    if (!trackId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("shipments")
        .select("*")
        .eq("track_id", trackId)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setShipments(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

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
        track_id: trackId,
      };
      if (editingId) {
        const { error: err } = await supabase.from("shipments").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("shipments").insert([payload]);
        if (err) throw err;
        // Auto-register with 17Track (include carrier code for detection)
        call17Track("register", [buildTrackItem(payload.tracking_number, payload.carrier)]).catch(() => {});
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
      const item = buildTrackItem(shipment.tracking_number, shipment.carrier);
      // Register first (idempotent — re-registering is fine, and needed if not yet registered)
      await call17Track("register", [item]).catch(() => {});
      const data = await call17Track("gettrackinfo", [item]);
      const accepted = data?.data?.accepted?.[0];
      if (!accepted) throw new Error("Tracking number not found in 17Track");
      const info = accepted.track_info;
      const mappedStatus = map17Status(info?.latest_status?.status);
      const latestEvent = info?.latest_event;
      const isDelivered = mappedStatus === "delivered";
      const eventDate = latestEvent?.time_raw?.date;
      const eventTime = latestEvent?.time_raw?.time?.slice(0, 5);
      const transitDays = info?.time_metrics?.days_of_transit_done;

      const detailParts = [];
      if (latestEvent?.description) detailParts.push(latestEvent.description);
      if (isDelivered && eventTime) detailParts.push(`at ${eventTime}`);
      if (latestEvent?.location) detailParts.push(`— ${latestEvent.location}`);
      if (isDelivered && transitDays) detailParts.push(`(${transitDays}d transit)`);
      const statusDetailStr = detailParts.join(" ");

      const update = {
        ...(mappedStatus && { status: mappedStatus }),
        ...(statusDetailStr && { status_detail: statusDetailStr }),
        ...(isDelivered && eventDate && { estimated_delivery: eventDate }),
        ...(!isDelivered && info?.time_metrics?.estimated_delivery_date?.from && { estimated_delivery: info.time_metrics.estimated_delivery_date.from }),
        ...(info?.shipping_info?.shipper_address?.country && !shipment.origin && { origin: info.shipping_info.shipper_address.country }),
        ...(info?.shipping_info?.recipient_address?.city && !shipment.destination && { destination: info.shipping_info.recipient_address.city }),
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
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-bgray-600 dark:text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <h3 className="text-base font-semibold text-darkblack-700 dark:text-white">Shipments</h3>
          {!loading && (
            <span className="text-xs font-semibold bg-bgray-100 dark:bg-darkblack-500 text-bgray-600 dark:text-bgray-300 px-2 py-0.5 rounded-full">
              {shipments.length}
            </span>
          )}
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:opacity-90 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Shipment
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
          <span className="text-sm text-bgray-500 dark:text-bgray-400">Loading shipments...</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 py-4 text-center">{error}</div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-2 text-bgray-300 dark:text-bgray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <p className="text-sm text-bgray-500 dark:text-bgray-400">No shipments yet. Add a tracking number to monitor this order.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shipments.map((s) => {
            const badge = getCarrierBadge(s.carrier);
            const trackUrl = getTrackingUrl(s.carrier, s.tracking_number);
            const statusLabel = STATUS_OPTIONS.find(o => o.value === s.status)?.label || s.status;
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3 bg-bgray-50 dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl hover:shadow-sm transition group"
              >
                {/* Carrier Badge */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${badge.colorClass}`}>
                  {badge.abbrev}
                </div>

                {/* Tracking Number */}
                <div className="flex-shrink-0 min-w-0 w-36">
                  {trackUrl ? (
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-primary hover:underline block truncate"
                      title={s.tracking_number}
                    >
                      {s.tracking_number}
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-darkblack-700 dark:text-white block truncate" title={s.tracking_number}>
                      {s.tracking_number}
                    </span>
                  )}
                  <span className="text-xs text-bgray-500 dark:text-bgray-400">{s.carrier}</span>
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-darkblack-600 dark:text-bgray-200 truncate">
                    {s.description || <span className="italic text-bgray-400">No description</span>}
                  </p>
                  {s.status_detail && (
                    <p className="text-xs text-bgray-500 dark:text-bgray-400 truncate mt-0.5">{s.status_detail}</p>
                  )}
                </div>

                {/* Status Chip */}
                <div className="flex-shrink-0">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusChip(s.status)}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Origin → Destination */}
                <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-xs text-bgray-600 dark:text-bgray-300 min-w-0 max-w-[150px]">
                  <span className="truncate">{s.origin || "—"}</span>
                  <svg className="w-3 h-3 flex-shrink-0 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="truncate">{s.destination || "—"}</span>
                </div>

                {/* ETA / Delivered */}
                <div className="flex-shrink-0 text-xs w-20 text-right">
                  {s.estimated_delivery ? (
                    s.status === "delivered" ? (
                      <div>
                        <p className="font-semibold text-green-600 dark:text-green-400">Delivered</p>
                        <p className="text-bgray-400 dark:text-bgray-500">{formatDate(s.estimated_delivery)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-bgray-400 dark:text-bgray-500">ETA</p>
                        <p className="text-bgray-600 dark:text-bgray-300">{formatDate(s.estimated_delivery)}</p>
                      </div>
                    )
                  ) : (
                    <span className="text-bgray-300 dark:text-bgray-600">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  {/* Refresh from 17Track */}
                  <button
                    onClick={() => refreshTracking(s)}
                    disabled={refreshingId === s.id}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-bgray-500 dark:text-bgray-300 hover:text-blue-600 transition"
                    title="Refresh tracking status"
                  >
                    {refreshingId === s.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
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
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-darkblack-600 rounded-2xl border border-bgray-200 dark:border-darkblack-400 w-full max-w-lg shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-bgray-200 dark:border-darkblack-400">
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
