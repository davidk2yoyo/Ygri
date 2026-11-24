import React from "react";
import { SECTION_FIELDS, RATING_CRITERIA, hasValue, overallRating, stars } from "../lib/supplierProfile";

// Read-only render of one profile section's structured data (client portal).
const fmt = (f, v) => {
  if (f.type === "yesno") return v === "yes" ? "Sí" : v === "no" ? "No" : "";
  if (f.type === "select") return f.optionLabels?.[v] || v;
  return String(v);
};

export default function SupplierProfileView({ sectionKey, data }) {
  const groups = SECTION_FIELDS[sectionKey] || [];
  const d = data || {};
  return (
    <div className="space-y-4">
      {groups.map(g => {
        const filled = g.fields.filter(f => f.type === "stars" ? RATING_CRITERIA.some(c => d[c.key]) : hasValue(d[f.key]));
        if (!filled.length) return null;
        const inline = filled.filter(f => ["text", "number", "date", "yesno", "select"].includes(f.type));
        const blocks = filled.filter(f => !inline.includes(f));
        return (
          <div key={g.title}>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">{g.title}</h4>
            {inline.length > 0 && (
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {inline.map(f => (
                  <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-gray-500">{f.label}</dt>
                    <dd className="text-sm text-gray-900 break-words">{fmt(f, d[f.key])}</dd>
                  </div>
                ))}
              </dl>
            )}
            {blocks.map(f => (
              <div key={f.key} className="mt-3">
                {f.type === "stars" ? (
                  <div className="max-w-md">
                    {overallRating(d) != null && <p className="text-lg text-amber-500 mb-1">{stars(overallRating(d))} <span className="text-sm text-gray-700 font-semibold">{overallRating(d).toFixed(1)} / 5</span></p>}
                    {RATING_CRITERIA.filter(c => d[c.key]).map(c => (
                      <p key={c.key} className="text-xs text-gray-600 flex justify-between py-0.5"><span>{c.label}</span><span className="text-amber-500">{"★".repeat(d[c.key])}{"☆".repeat(5 - d[c.key])}</span></p>
                    ))}
                  </div>
                ) : f.type === "checks" ? (
                  <>
                    <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                    <div className="flex flex-wrap gap-1.5">{d[f.key].map(o => <span key={o} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{o}</span>)}</div>
                  </>
                ) : f.type === "table" ? (
                  <>
                    <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-gray-50 text-gray-500 text-left">{f.columns.map(c => <th key={c.key} className="px-2 py-1.5 font-semibold">{c.label}</th>)}</tr></thead>
                        <tbody>{d[f.key].filter(r => hasValue([r])).map((r, i) => (
                          <tr key={i} className="border-t border-gray-100">{f.columns.map(c => <td key={c.key} className="px-2 py-1.5 text-gray-800">{r[c.key]}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">{f.label}</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{d[f.key]}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
