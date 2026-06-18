import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

function SpecsTable({ content }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="w-full text-sm">
        <tbody>
          {(content.rows || []).filter(r => r.label || r.value).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-5 py-3 font-medium text-gray-600 w-2/5 border-r border-gray-100">{row.label}</td>
              <td className="px-5 py-3 text-gray-800">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockRenderer({ block }) {
  const { type, content } = block;
  const linkedItem = content._linked_item;
  return (
    <div className="mb-10">
      {linkedItem && (
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">
          {[linkedItem.item_number, linkedItem.description].filter(Boolean).join(" · ")}
        </p>
      )}
      {type === "text" && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mb-3">{content.title}</h3>
          <p className="text-gray-600 leading-relaxed whitespace-pre-line">{content.content}</p>
        </>
      )}
      {type === "specs" && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mb-3">{content.title}</h3>
          <SpecsTable content={content} />
        </>
      )}
      {type === "images" && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mb-3">{content.title}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {(content.images || []).map((img, i) => (
              <div key={i} className="text-center">
                <img src={img.url} alt={img.caption || ""} className="w-full h-44 object-cover rounded-xl border border-gray-200" />
                {img.caption && <p className="text-xs text-gray-400 mt-1.5">{img.caption}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      {type === "diagram" && content.url && (
        <>
          <h3 className="text-lg font-bold text-gray-800 mb-3">{content.title}</h3>
          <img src={content.url} alt={content.caption || "Diagram"} className="w-full rounded-xl border border-gray-200 object-contain max-h-[500px]" />
          {content.caption && <p className="text-xs text-gray-400 text-center mt-2">{content.caption}</p>}
        </>
      )}
    </div>
  );
}

export default function AnnexPublicPage() {
  const { annexNumber } = useParams();
  const [annex, setAnnex] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: ax } = await supabase.from("technical_annexes").select("*").eq("annex_number", annexNumber).single();
      if (!ax) { setNotFound(true); setLoading(false); return; }
      setAnnex(ax);
      const [{ data: blks }, { data: quot }] = await Promise.all([
        supabase.from("annex_blocks").select("*").eq("annex_id", ax.id).order("sort_order"),
        supabase.from("quotations").select("quote_number, client_name, project_name").eq("id", ax.quotation_id).single(),
      ]);
      setBlocks(blks || []);
      setQuotation(quot);
      setLoading(false);
    }
    load();
  }, [annexNumber]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 text-gray-500">
      <p className="text-4xl">📄</p>
      <p className="font-semibold">Technical annex not found</p>
      <p className="text-sm">The link may be invalid or expired.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 print:border-0">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Technical Annex · {annex.annex_number}</p>
              <h1 className="text-2xl font-bold text-gray-900">{annex.title}</h1>
              {quotation && (
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                  <span>Ref: {quotation.quote_number}</span>
                  {quotation.client_name && <><span>·</span><span>{quotation.client_name}</span></>}
                  {quotation.project_name && <><span>·</span><span>{quotation.project_name}</span></>}
                </div>
              )}
            </div>
            <div className="text-right shrink-0 ml-6">
              <p className="text-xs text-gray-400">Interasia SAS</p>
              <p className="text-xs text-gray-400">Hong Kong Trade Co.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {blocks.length === 0 ? (
          <p className="text-center text-gray-400 py-20 text-sm">This annex has no content yet.</p>
        ) : (
          blocks.map(block => <BlockRenderer key={block.id} block={block} />)
        )}
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-6 pb-10 border-t border-gray-100 pt-6">
        <p className="text-xs text-gray-300 text-center">
          {annex.annex_number} · Generated by Ygri CRM · Interasia SAS
        </p>
      </div>
    </div>
  );
}
