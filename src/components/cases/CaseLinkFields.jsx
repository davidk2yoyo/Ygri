import React, { useId } from "react";

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-darkblack-400 rounded-lg text-sm bg-white dark:bg-darkblack-600 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400";
const labelCls = "block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide";

// What a conversation is about: an order (picked) and/or a product (picked from the client's ordered
// products, or typed). value = { track_id, product_name, product_ref }.
export default function CaseLinkFields({ value, onChange, orders = [], products = [] }) {
  const listId = useId();
  const inOrder = value.track_id ? products.filter(p => !p.track_id || p.track_id === value.track_id) : products;
  const options = inOrder.length ? inOrder : products;

  const setProduct = (name) => {
    const hit = products.find(p => (p.name || "").toLowerCase() === name.toLowerCase());
    onChange({ ...value, product_name: name, product_ref: hit ? (hit.ref || "") : value.product_ref });
  };

  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div>
        <label className={labelCls}>Orden</label>
        <select className={inputCls} value={value.track_id || ""} onChange={e => onChange({ ...value, track_id: e.target.value })}>
          <option value="">Ninguna</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Producto</label>
        <input className={inputCls} list={listId} value={value.product_name || ""} onChange={e => setProduct(e.target.value)} placeholder="Elige o escribe un producto" />
        <datalist id={listId}>
          {options.map((p, i) => <option key={i} value={p.name}>{p.ref || ""}</option>)}
        </datalist>
      </div>
      <div>
        <label className={labelCls}>Referencia</label>
        <input className={inputCls} value={value.product_ref || ""} onChange={e => onChange({ ...value, product_ref: e.target.value })} placeholder="Opcional" />
      </div>
    </div>
  );
}
