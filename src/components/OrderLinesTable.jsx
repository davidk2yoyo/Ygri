import React from "react";
import { emptyLine, lineProblems } from "../lib/orderDiff";

const cell = "w-full px-1.5 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none rounded text-xs bg-transparent";

const COLS = [
  ["supplier", "Proveedor", "w-28"],
  ["supplier_ref", "Ref. prov.", "w-24"],
  ["name", "Nombre", "w-48"],
  ["color", "Color", "w-20"],
  ["qty", "Cant.", "w-16", "number"],
  ["price", "Precio obj.", "w-20", "number"],
  ["client_ref", "Ref. cliente", "w-24"],
  ["brand", "Marca", "w-24"],
];

// Editable table of order lines, shared by the client portal and the staff view.
// lines: array in orderDiff "editable line" shape. onChange(nextLines).
export default function OrderLinesTable({ lines, onChange, readOnly = false, highlight = true }) {
  const patch = (key, p) => onChange(lines.map(l => (l._key === key ? { ...l, ...p } : l)));
  const remove = (key) => onChange(lines.filter(l => l._key !== key));
  const add = () => onChange([...lines, emptyLine(lines[lines.length - 1]?.sheet_name || "")]);

  return (
    <div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-2 py-1.5 w-10" />
              {COLS.map(([, label, w]) => <th key={label} className={`px-2 py-1.5 text-left font-semibold ${w}`}>{label}</th>)}
              <th className="px-2 py-1.5 text-left font-semibold w-16">Marc.</th>
              <th className="px-2 py-1.5 text-left font-semibold w-28">Empaque</th>
              <th className="px-2 py-1.5 text-left font-semibold w-40">Notas</th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const p = highlight ? lineProblems(l) : {};
              const bad = p.id || p.qty;
              return (
                <tr key={l._key} className={`border-t border-gray-100 ${bad ? "bg-red-50" : ""}`}>
                  <td className="px-2 py-1">
                    {l.photo_url ? <img src={l.photo_url} alt="" className="w-8 h-8 object-cover rounded" /> : <div className="w-8 h-8 rounded bg-gray-100" />}
                  </td>
                  {COLS.map(([f, , , type]) => (
                    <td key={f} className="px-1 py-0.5">
                      {readOnly
                        ? <span className="px-1.5">{l[f]}</span>
                        : <input type={type || "text"} min={type ? 0 : undefined} step={type ? "any" : undefined} value={l[f] ?? ""}
                            onChange={e => patch(l._key, { [f]: e.target.value })}
                            className={`${cell} ${f === "qty" && p.qty ? "border-red-400" : ""} ${f === "name" && p.id ? "border-red-400" : ""}`} />}
                    </td>
                  ))}
                  <td className="px-1 py-0.5">
                    {readOnly
                      ? <span className="px-1.5">{l.marking === true ? "SI" : l.marking === false ? "NO" : ""}</span>
                      : <select value={l.marking == null ? "" : l.marking ? "1" : "0"}
                          onChange={e => patch(l._key, { marking: e.target.value === "" ? null : e.target.value === "1" })} className={cell}>
                          <option value="" /><option value="1">SI</option><option value="0">NO</option>
                        </select>}
                  </td>
                  <td className="px-1 py-0.5">
                    {readOnly ? <span className="px-1.5">{l.packaging}</span>
                      : <input value={l.packaging ?? ""} onChange={e => patch(l._key, { packaging: e.target.value })} className={cell} />}
                  </td>
                  <td className="px-1 py-0.5">
                    {readOnly ? <span className="px-1.5">{l.notes}</span>
                      : <input value={l.notes ?? ""} onChange={e => patch(l._key, { notes: e.target.value })} className={cell} />}
                  </td>
                  {!readOnly && (
                    <td className="px-1 text-center">
                      <button onClick={() => remove(l._key)} title="Quitar" className="text-gray-400 hover:text-red-500 text-base leading-none">×</button>
                    </td>
                  )}
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-6 text-center text-gray-400">Sin productos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button onClick={add} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">+ Agregar producto</button>
      )}
    </div>
  );
}
