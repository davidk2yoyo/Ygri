// Move all or part of a client payment to another proforma/invoice of the same project.
// Everything else (date, method, reference, receipt) travels with it; a partial move keeps the
// remainder on the original document.
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

export async function movePayment(supabase, { payment, targetId, amount }) {
  const total = round2(payment.amount);
  const amt = round2(amount);
  if (!targetId) throw new Error("Elige la factura destino.");
  if (!(amt > 0)) throw new Error("Indica un monto mayor que cero.");
  if (amt > total + 0.001) throw new Error(`El monto no puede superar ${total}.`);

  if (amt >= total - 0.001) {
    const { data, error } = await supabase.from("quotation_payments").update({ quotation_id: targetId }).eq("id", payment.id).select().single();
    if (error) throw error;
    return { moved: data, remaining: null };
  }
  const copy = { ...payment };
  ["id", "created_at"].forEach(k => delete copy[k]);
  const { data: moved, error: iErr } = await supabase.from("quotation_payments").insert({ ...copy, quotation_id: targetId, amount: amt }).select().single();
  if (iErr) throw iErr;
  const { data: remaining, error: uErr } = await supabase.from("quotation_payments").update({ amount: round2(total - amt) }).eq("id", payment.id).select().single();
  if (uErr) { await supabase.from("quotation_payments").delete().eq("id", moved.id); throw uErr; }
  return { moved, remaining };
}
