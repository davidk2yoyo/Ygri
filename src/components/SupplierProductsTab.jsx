import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function ProductCard({ product }) {
  return (
    <div className="bg-white dark:bg-darkblack-500 border border-bgray-200 dark:border-darkblack-400 rounded-xl p-4 hover:shadow-md transition">
      <div className="flex items-start gap-3 mb-2">
        {product.picture_url ? (
          <img src={product.picture_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-bgray-100 dark:border-darkblack-400" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-bgray-100 dark:bg-darkblack-400 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-bgray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {product.item_number && (
            <p className="text-xs font-mono text-bgray-400 dark:text-bgray-500 mb-0.5 truncate">{product.item_number}</p>
          )}
          <h3 className="text-sm font-semibold text-darkblack-700 dark:text-white leading-snug line-clamp-2">
            {product.description}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-bgray-100 dark:border-darkblack-400">
        {product.supplier_price ? (
          <span className="text-sm font-semibold text-amber-600">
            {product.supplier_currency || "USD"} {Number(product.supplier_price).toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-bgray-400">No price</span>
        )}
        <div className="flex items-center gap-2">
          {product.moq && (
            <span className="text-xs text-bgray-400">MOQ: {product.moq}</span>
          )}
          {product.times_quoted > 1 && (
            <span className="text-xs bg-bgray-100 dark:bg-darkblack-400 text-bgray-500 dark:text-bgray-400 px-1.5 py-0.5 rounded-full">
              {product.times_quoted}× quoted
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupplierProductsTab({ supplierId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, [supplierId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quotation_items")
        .select("id, item_number, description, picture_url, supplier_price, supplier_currency, moq, catalog_item_id, quotations(created_at)")
        .eq("supplier_id", supplierId)
        .not("description", "is", null)
        .neq("description", "");
      if (error) throw error;

      // Deduplicate: group by catalog_item_id or item_number+description
      const grouped = new Map();
      (data || []).forEach(qi => {
        const key = qi.catalog_item_id
          ? `cat::${qi.catalog_item_id}`
          : `raw::${(qi.item_number || "")}::${qi.description}`;
        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, { ...qi, times_quoted: 1 });
        } else {
          const existDate = existing.quotations?.created_at || "";
          const newDate = qi.quotations?.created_at || "";
          if (newDate > existDate) {
            grouped.set(key, { ...qi, times_quoted: existing.times_quoted + 1 });
          } else {
            existing.times_quoted += 1;
          }
        }
      });

      setProducts(
        [...grouped.values()].sort((a, b) => (a.description || "").localeCompare(b.description || ""))
      );
    } catch (e) {
      console.error("Error loading products:", e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.item_number || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-darkblack-700 dark:text-white">Products</h2>
          <p className="text-sm text-bgray-500 dark:text-bgray-400 mt-0.5">
            {products.length} product{products.length !== 1 ? "s" : ""} quoted from this supplier
          </p>
        </div>
      </div>

      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by item # or description…"
          className="w-full pl-9 pr-3 py-2 border border-bgray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-darkblack-700 dark:text-white focus:ring-2 focus:ring-primary placeholder-bgray-400"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-bgray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-sm">Loading products…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-bgray-100 dark:bg-darkblack-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-bgray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-bgray-500 dark:text-bgray-400 text-sm">
            {products.length === 0
              ? "No products yet. They appear automatically when you create quotations with this supplier."
              : "No products match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <ProductCard key={p.id || i} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
