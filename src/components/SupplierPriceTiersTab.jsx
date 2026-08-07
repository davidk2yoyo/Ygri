import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { sileo } from "sileo";

export default function SupplierPriceTiersTab({ supplierId }) {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    min_qty: 1,
    max_qty: "",
    price: "",
    currency: "USD",
    notes: ""
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("supplier_price_tiers")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("min_qty");
      if (error) throw error;
      setTiers(data || []);
    } catch (e) {
      sileo.error({ title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTiers(); }, [supplierId]);

  const resetForm = () => {
    setFormData({
      description: "",
      min_qty: 1,
      max_qty: "",
      price: "",
      currency: "USD",
      notes: ""
    });
    setEditing(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!formData.description.trim() || !formData.price) {
      sileo.error({ title: "Error", description: "Description and price required" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("supplier_price_tiers")
          .update(formData)
          .eq("id", editing.id);
        if (error) throw error;
        sileo.success({ title: "Price tier updated" });
      } else {
        const { error } = await supabase
          .from("supplier_price_tiers")
          .insert({ ...formData, supplier_id: supplierId });
        if (error) throw error;
        sileo.success({ title: "Price tier added" });
      }
      resetForm();
      await loadTiers();
    } catch (e) {
      sileo.error({ title: "Error", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this price tier?")) return;
    try {
      const { error } = await supabase.from("supplier_price_tiers").delete().eq("id", id);
      if (error) throw error;
      sileo.success({ title: "Price tier deleted" });
      await loadTiers();
    } catch (e) {
      sileo.error({ title: "Error", description: e.message });
    }
  };

  const inputCls = "w-full px-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-darkblack-700 dark:text-white">Volume Pricing</h3>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          {showForm ? "Cancel" : "+ Add Tier"}
        </button>
      </div>

      {showForm && (
        <div className="bg-bgray-50 dark:bg-darkblack-500 p-4 rounded-lg space-y-3 border border-bgray-200 dark:border-darkblack-400">
          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Product/Description *</label>
            <input
              type="text"
              placeholder="e.g. Pan 24cm Stainless Steel"
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Min Qty *</label>
              <input
                type="number"
                value={formData.min_qty}
                onChange={e => setFormData(p => ({ ...p, min_qty: parseInt(e.target.value) || 1 }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Max Qty</label>
              <input
                type="number"
                placeholder="Leave empty for unlimited"
                value={formData.max_qty}
                onChange={e => setFormData(p => ({ ...p, max_qty: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Price *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-bgray-600 dark:text-bgray-300 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Bulk discount, minimum order, etc."
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm border border-bgray-300 dark:border-darkblack-400 rounded-lg text-bgray-600 dark:text-bgray-300 hover:bg-bgray-100 dark:hover:bg-darkblack-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : editing ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-bgray-500">Loading price tiers...</div>
      ) : tiers.length === 0 ? (
        <div className="text-center py-8 text-bgray-500 text-sm">
          No volume pricing set. Add tiers to let customers see bulk discounts in quotations.
        </div>
      ) : (
        <div className="space-y-2">
          {tiers.map(tier => (
            <div
              key={tier.id}
              className="flex items-center justify-between p-3 bg-bgray-50 dark:bg-darkblack-500 rounded-lg border border-bgray-200 dark:border-darkblack-400"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-darkblack-700 dark:text-white text-sm">{tier.description}</p>
                <p className="text-xs text-bgray-500 dark:text-bgray-400 mt-1">
                  {tier.min_qty} {tier.max_qty ? `- ${tier.max_qty}` : "+"} units @ {tier.currency} {parseFloat(tier.price).toFixed(2)}
                  {tier.notes && ` • ${tier.notes}`}
                </p>
              </div>
              <div className="flex gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditing(tier);
                    setFormData(tier);
                    setShowForm(true);
                  }}
                  className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(tier.id)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
