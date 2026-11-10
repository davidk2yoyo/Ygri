import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { SupplierProductionCard } from "./ProductionBoard";
import { findProductionGaps, applyProductionSync } from "../lib/productionSync";

// "Production" tab of a project: one card per supplier purchase order, with a
// ready checklist staff can edit directly (no need to open each PO). This is
// the entry point the quotation-toolbar icon button was too easy to miss.
export default function ProjectProductionSection({ trackId }) {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [quotationId, setQuotationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gaps, setGaps] = useState(null);      // quotation products that are not in any purchase order yet
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [{ data: pos, error: poErr }, { data: quotes }] = await Promise.all([
        supabase.from("purchase_orders")
          .select("id, po_number, status, supplier_id, suppliers(name), purchase_order_items(id, item_number, description, picture_url, ready_at, expected_ready_date, notes), purchase_order_photos(id, photo_url, caption, created_at)")
          .eq("track_id", trackId).order("created_at"),
        supabase.from("quotations").select("id").eq("track_id", trackId).order("created_at", { ascending: false }).limit(1),
      ]);
      if (poErr) throw poErr;
      setPurchaseOrders((pos || []).map(po => ({
        id: po.id, po_number: po.po_number, status: po.status,
        supplier_name: po.suppliers?.name, items: po.purchase_order_items || [],
        photos: (po.purchase_order_photos || []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      })));
      setQuotationId(quotes?.[0]?.id || null);
      try { setGaps(await findProductionGaps(supabase, trackId)); } catch { setGaps(null); }
    } catch (e) {
      setError(e.message || "Couldn't load production data.");
    } finally {
      setLoading(false);
    }
  }, [trackId]);
  useEffect(() => { load(); }, [load]);

  const patchItem = async (item, patch) => {
    // optimistic — the checklist shouldn't flicker while the request is in flight
    setPurchaseOrders(prev => prev.map(po => ({
      ...po, items: po.items.map(it => it.id === item.id ? { ...it, ...patch } : it),
    })));
    const { error: e } = await supabase.from("purchase_order_items").update(patch).eq("id", item.id);
    if (e) { setError(e.message); load(); }
  };

  const addPhoto = async (po, file) => {
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${po.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("purchase-order-photos").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("purchase-order-photos").getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: row, error: insErr } = await supabase.from("purchase_order_photos")
        .insert({ purchase_order_id: po.id, photo_url: publicUrl, uploaded_by: user?.id || null })
        .select().single();
      if (insErr) throw insErr;
      setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, photos: [...p.photos, row] } : p));
    } catch (e) {
      setError(e.message || "No se pudo subir la foto.");
    }
  };

  const deletePhoto = async (po, photo) => {
    if (!window.confirm("¿Eliminar esta foto?")) return;
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, photos: p.photos.filter(ph => ph.id !== photo.id) } : p));
    const { error: e } = await supabase.from("purchase_order_photos").delete().eq("id", photo.id);
    if (e) { setError(e.message); load(); }
  };

  const missingCount = gaps?.groups?.reduce((n, g) => n + g.items.length, 0) || 0;
  const syncNow = async () => {
    setSyncing(true); setError("");
    try { await applyProductionSync(supabase, trackId, gaps); await load(); }
    catch (e) { setError(e.message || "No se pudo sincronizar con la cotización."); }
    finally { setSyncing(false); }
  };

  const newPoHref = quotationId ? `/purchase-orders/new?quotationId=${quotationId}` : "/purchase-orders/new";

  if (loading) return <div className="p-6 text-sm text-bgray-500">Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-darkblack-700 dark:text-white">Production</h3>
          <p className="text-xs text-bgray-500 dark:text-bgray-400 mt-0.5">One card per supplier purchase order — check items off as they become ready.</p>
        </div>
        <a href={newPoHref} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">+ New purchase order</a>
      </div>

      {missingCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold">{missingCount} {missingCount === 1 ? "producto de la cotización no está" : "productos de la cotización no están"} en producción</p>
            <p className="text-xs mt-0.5">
              {gaps.groups.map(g => `${g.supplier_name}: ${g.items.length}${g.po ? "" : " (sin orden de compra)"}`).join(" · ")}.
              {" "}Mientras no estén aquí no se pueden marcar como listos ni salen en el Excel de lo listo.
            </p>
          </div>
          <button onClick={syncNow} disabled={syncing} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition disabled:opacity-60">
            {syncing ? "Agregando…" : "Agregar a producción"}
          </button>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {purchaseOrders.length === 0 ? (
        <p className="text-sm text-bgray-400">No purchase orders yet for this project.</p>
      ) : (
        <div className="space-y-3">
          {purchaseOrders.map(po => (
            <SupplierProductionCard key={po.id} po={po} readOnly={false}
              onItemChange={patchItem} onPhotoAdd={addPhoto} onPhotoDelete={deletePhoto} openHref={`/purchase-orders/${po.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
