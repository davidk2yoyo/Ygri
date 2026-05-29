import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import QuotationPDF from "../components/QuotationPDF";

export default function PublicQuotationPage() {
  const { quoteNumber } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: quotation, error } = await supabase
        .from("quotations")
        .select("*, quotation_items(*)")
        .eq("quote_number", quoteNumber)
        .single();

      if (error || !quotation) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      let clientName = quotation.client_name || "";
      let projectName = quotation.project_name || "";

      // Fallback: fetch from tracks view for older records that predate the column
      if ((!clientName || !projectName) && quotation.track_id) {
        const { data: track } = await supabase
          .from("v_tracks_overview")
          .select("client_name, track_name")
          .eq("track_id", quotation.track_id)
          .single();
        if (track) {
          clientName = clientName || track.client_name || "";
          projectName = projectName || track.track_name || "";
        }
      }

      const items = (quotation.quotation_items || []).map(it => ({
        ...it,
        tempId: it.id,
        picturePreview: it.picture_url || "",
      }));

      const commissionPct = parseFloat(quotation.commission_pct) || 0;
      const totalAmount = Number(quotation.total_amount || 0);
      const grandTotal = totalAmount + totalAmount * (commissionPct / 100);

      setData({ quotation, items, clientName, projectName, totalAmount, grandTotal, commissionPct });
      setLoading(false);
    }

    load();
  }, [quoteNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading quotation…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 text-center max-w-sm">
          <div className="text-5xl mb-4">📄</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Quotation not found</h1>
          <p className="text-gray-500 text-sm">
            The quotation <strong>{quoteNumber}</strong> does not exist or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <QuotationPDF
      quotation={data.quotation}
      items={data.items}
      clientName={data.clientName}
      projectName={data.projectName}
      totalAmount={data.totalAmount}
      commissionPct={data.commissionPct}
      showCommission={data.quotation.show_commission || false}
      standalone={true}
      readOnly={true}
    />
  );
}
