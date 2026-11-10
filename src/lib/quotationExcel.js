import { COMPANY, BANK_DETAILS } from "./companyInfo";
import { colorToHex } from "./colorUtil";
import { loadLogo, rowHeight, num, safeName, download } from "./packingListExcel";

// Styled quotation / proforma / commercial-invoice workbook (with product photos), used by the
// staff PDF viewer and the client portal. Two flavours: the whole document, or only the items
// already finished in production ("readyOnly") with the balance computed for just those.
// ExcelJS is loaded on demand so it doesn't weigh on the main bundle.

const NAVY = "FF1E3A5F", GOLD = "FFC9922A", LIGHT = "FFEEF2F7", ZEBRA = "FFF9FAFB", LINE = "FFE0E4EA", GREY = "FF6B7280", WHITE = "FFFFFFFF";
const GREEN = "FF16A34A", GREEN_BG = "FFDCFCE7", AMBER_BG = "FFFEF3C7", AMBER = "FF92400E";
const FONT = "Calibri";

const DOC_META = {
  quotation: { title: "QUOTATION", refLabel: "Quote Number", amountLabel: "Total Amount", prefix: "Quotation" },
  proforma: { title: "PROFORMA INVOICE", refLabel: "Proforma Number", amountLabel: "Amount Due", prefix: "Proforma" },
  invoice: { title: "COMMERCIAL INVOICE", refLabel: "Invoice Number", amountLabel: "Amount Due", prefix: "Invoice" },
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

// ---- data helpers -----------------------------------------------------------------------------

// Staff side: make sure items carry their chosen options, and find which item numbers are ready.
export async function fetchStaffQuotationExtras(supabase, { quotation, items }) {
  let list = items || [];
  const ids = list.map(i => i.id).filter(Boolean);
  if (ids.length && list.some(i => !i.selectedOptions)) {
    const { data } = await supabase.from("quotation_item_options").select("*").in("quotation_item_id", ids).order("sort_order");
    const by = {};
    (data || []).forEach(o => { (by[o.quotation_item_id] = by[o.quotation_item_id] || []).push(o); });
    list = list.map(i => ({ ...i, selectedOptions: i.selectedOptions || by[i.id] || [] }));
  }
  let readyNumbers = null;
  if (quotation?.track_id) {
    const { data: pos } = await supabase.from("purchase_orders").select("id").eq("track_id", quotation.track_id);
    const poIds = (pos || []).map(p => p.id);
    readyNumbers = new Set();
    if (poIds.length) {
      const { data: poi } = await supabase.from("purchase_order_items").select("item_number, ready_at").in("purchase_order_id", poIds).not("ready_at", "is", null);
      (poi || []).forEach(r => { if (r.item_number) readyNumbers.add(r.item_number); });
    }
  }
  return { items: list, readyNumbers };
}

// Portal side: the quotation detail comes from a SECURITY DEFINER RPC (client's own documents only).
export async function fetchPortalQuotation(supabase, sessionId, quotationId) {
  const { data, error } = await supabase.rpc("client_portal_get_quotation_detail", { p_session_id: sessionId, p_quotation_id: quotationId });
  if (error) throw error;
  if (!data) throw new Error("No pudimos cargar el documento.");
  return data;
}

export const readyNumbersFromPOs = (purchaseOrders = []) => {
  const s = new Set();
  purchaseOrders.forEach(po => (po.items || []).forEach(i => { if (i.ready_at && i.item_number) s.add(i.item_number); }));
  return s;
};

// ---- photos -------------------------------------------------------------------------------------

async function loadPhoto(url) {
  if (!url) return null;
  try {
    const blob = await (await fetch(url, { mode: "cors" })).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 200 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.82), w: c.width, h: c.height };
  } catch { return null; }
}

async function loadPhotos(urls, concurrency = 6) {
  const out = new Array(urls.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (next < urls.length) { const i = next++; out[i] = await loadPhoto(urls[i]); }
  }));
  return out;
}

// ---- export -------------------------------------------------------------------------------------

export async function exportQuotationExcel({
  quotation, items = [], payments = [], clientName, clientDetails, projectName,
  readyNumbers = null,      // Set of item_numbers already finished in production (null = unknown)
  readyOnly = false,        // export just the ready items, with the balance for those
  commissionPct, showCommission,
}) {
  const ExcelJS = (await import("exceljs")).default;
  const meta = DOC_META[quotation?.document_type] || DOC_META.quotation;
  const currency = quotation?.currency || "USD";
  const isReady = (it) => !!(readyNumbers && it.item_number && readyNumbers.has(it.item_number));
  const showStatus = !!readyNumbers && !readyOnly;
  const rows = readyOnly ? items.filter(isReady) : items;
  if (readyOnly && rows.length === 0) throw new Error("Todavía no hay productos listos en producción.");

  const pct = parseFloat(commissionPct ?? quotation?.commission_pct) || 0;
  const showComm = showCommission ?? quotation?.show_commission ?? false;
  const showMoq = quotation?.document_type === "quotation" && rows.some(i => i.moq);

  const priceOf = (it) => {
    const extra = it.all_inclusive ? 0 : (it.selectedOptions || []).reduce((s, o) => s + (parseFloat(o.extra_price) || 0), 0);
    return (parseFloat(it.price) || 0) + extra;
  };
  const qtyOf = (it) => parseInt(it.quantity) || 1;
  const subtotalOf = (list) => list.reduce((s, it) => s + priceOf(it) * qtyOf(it), 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ygri CRM"; wb.company = COMPANY.name; wb.created = new Date();
  const ws = wb.addWorksheet(meta.prefix, {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  // ---- columns: # | Photo | Description | [Status] | Qty | [MOQ] | Price | Amount
  const cols = [
    { key: "no", label: "#", width: 9 }, { key: "photo", label: "Image", width: 12 }, { key: "desc", label: "Description", width: 50 },
    ...(showStatus ? [{ key: "status", label: "Production", width: 14, center: true }] : []),
    { key: "qty", label: "Qty", width: 9, num: "#,##0" },
    ...(showMoq ? [{ key: "moq", label: "MOQ", width: 9, num: "#,##0" }] : []),
    { key: "price", label: `Price (${currency})`, width: 15, num: "#,##0.00" },
    { key: "amount", label: `Amount (${currency})`, width: 17, num: "#,##0.00" },
  ];
  ws.columns = cols.map(c => ({ width: c.width }));
  const N = cols.length;
  const ci = (key) => cols.findIndex(c => c.key === key) + 1;
  const descIdx = ci("desc");
  const mid = descIdx + 1;                         // right-hand blocks start here
  const merge = (r, c1, c2) => { if (c2 > c1) ws.mergeCells(r, c1, r, c2); return ws.getCell(r, c1); };
  const fill = (cell, argb) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; };
  const box = (r1, c1, r2, c2, argb = LINE) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = {
        top: r === r1 ? { style: "thin", color: { argb } } : undefined, bottom: r === r2 ? { style: "thin", color: { argb } } : undefined,
        left: c === c1 ? { style: "thin", color: { argb } } : undefined, right: c === c2 ? { style: "thin", color: { argb } } : undefined,
      };
    }
  };

  // ---- header: logo + title + company
  const logo = await loadLogo();
  if (logo) {
    const id = wb.addImage({ base64: logo.data, extension: "png" });
    const w = 190, h = Math.round((w * logo.h) / logo.w);
    ws.addImage(id, { tl: { col: 0.1, row: 0.25 }, ext: { width: w, height: h } });
  } else {
    const c = merge(1, 1, mid - 1); c.value = "INTERASIA SAS"; c.font = { name: FONT, bold: true, size: 18, color: { argb: NAVY } };
  }
  for (let r = 1; r <= 5; r++) ws.getRow(r).height = 20;
  const title = merge(1, descIdx, N); title.value = meta.title;
  title.font = { name: FONT, bold: true, size: 22, color: { argb: NAVY } }; title.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(1).height = 36;
  [[2, COMPANY.name, true], [3, COMPANY.address, false], [4, `Phone: ${COMPANY.phone}   ·   Mobile: ${COMPANY.mobile}`, false], [5, COMPANY.website, false]].forEach(([r, text, bold]) => {
    const c = merge(r, descIdx, N); c.value = text;
    c.font = { name: FONT, size: bold ? 10 : 9, bold, color: { argb: bold ? NAVY : GREY } }; c.alignment = { horizontal: "right", vertical: "middle" };
  });
  ws.getRow(6).height = 5; for (let c = 1; c <= N; c++) fill(ws.getCell(6, c), NAVY);
  ws.getRow(7).height = 3; for (let c = 1; c <= N; c++) fill(ws.getCell(7, c), GOLD);
  ws.getRow(8).height = 10;

  // ---- bill to (left) + document data (right)
  const d = clientDetails || {};
  const place = [d.city, d.state, d.country].filter(Boolean).join(", ");
  const billTo = [
    ["BILL TO", null],
    [(clientName || "CLIENT").toUpperCase(), "name"],
    [projectName || quotation?.project_name ? `Project: ${projectName || quotation.project_name}` : null, "text"],
    [d.rut_nit ? `RUT/NIT: ${d.rut_nit}` : null, "text"],
    [d.contact_person ? `Attn: ${d.contact_person}` : null, "text"],
    [d.address || null, "text"],
    [place || null, "text"],
    [d.phone ? `Tel: ${d.phone}` : null, "text"],
    [d.email || null, "text"],
    [d.website || null, "text"],
  ].filter(([v], i) => i < 2 || v);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const subtotal = subtotalOf(rows);
  const fullSubtotal = subtotalOf(items);
  const commission = (readyOnly ? subtotal : fullSubtotal) * (pct / 100);
  const grand = (readyOnly ? subtotal : fullSubtotal) + commission;
  const metaRows = [
    [meta.refLabel, quotation?.quote_number || "DRAFT"],
    ["Date", today],
    quotation?.document_type === "quotation" && quotation?.valid_until ? ["Valid Until", longDate(quotation.valid_until)] : null,
    quotation?.type === "product" && quotation?.incoterm ? ["Incoterm", `${quotation.incoterm}${quotation.incoterm_location ? ` ${quotation.incoterm_location}` : ""}`] : null,
    quotation?.type === "product" && quotation?.delivery_time ? ["Delivery Time", quotation.delivery_time] : null,
    readyOnly ? ["Scope", "Ready items"] : null,
    [readyOnly ? `Ready items (${currency})` : `${meta.amountLabel} (${currency})`, grand, true],
  ].filter(Boolean);

  const top = 9;
  const blockRows = Math.max(billTo.length, metaRows.length + 1);
  for (let i = 0; i < blockRows; i++) {
    const r = top + i;
    ws.getRow(r).height = i === 0 ? 16 : 17;
    const l = billTo[i];
    if (l) {
      const c = merge(r, 1, mid - 1); c.value = l[0];
      if (i === 0) c.font = { name: FONT, size: 8, bold: true, color: { argb: "FF888888" } };
      else if (l[1] === "name") c.font = { name: FONT, size: 13, bold: true, color: { argb: NAVY } };
      else c.font = { name: FONT, size: 10, color: { argb: "FF444444" } };
      c.alignment = { vertical: "middle", indent: 1 };
    } else merge(r, 1, mid - 1);
    if (i === 0) {
      const c = merge(r, mid, N); c.value = "DOCUMENT"; c.font = { name: FONT, size: 8, bold: true, color: { argb: "FF888888" } }; c.alignment = { vertical: "middle", indent: 1 };
    } else if (metaRows[i - 1]) {
      const [label, value, big] = metaRows[i - 1];
      const k = merge(r, mid, N - 1); k.value = label; k.font = { name: FONT, size: 10, color: { argb: GREY } }; k.alignment = { vertical: "middle", indent: 1 };
      const v = ws.getCell(r, N); v.value = value;
      v.font = { name: FONT, size: big ? 12 : 10, bold: true, color: { argb: big ? NAVY : "FF1A1A1A" } };
      v.alignment = { vertical: "middle", horizontal: "right", shrinkToFit: true };
      if (big) v.numFmt = "#,##0.00";
    }
  }
  const blockEnd = top + blockRows - 1;
  for (let r = top; r <= blockEnd; r++) for (let c = 1; c <= N; c++) fill(ws.getCell(r, c), "FFF7F8FA");
  box(top, 1, blockEnd, mid - 1); box(top, mid, blockEnd, N);
  ws.getRow(blockEnd + 1).height = 12;

  // ---- items table
  const headRow = blockEnd + 2;
  const hr = ws.getRow(headRow); hr.height = 24;
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1); cell.value = c.label;
    fill(cell, NAVY); cell.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: c.num ? "right" : c.center ? "center" : "left", indent: c.num || c.center ? 0 : 1, wrapText: true };
  });
  ws.pageSetup.printTitlesRow = `${headRow}:${headRow}`;

  const photos = await loadPhotos(rows.map(i => i.picturePreview || i.picture_url || ""));
  const thin = { style: "thin", color: { argb: LINE } };
  let r = headRow + 1;
  rows.forEach((it, idx) => {
    const row = ws.getRow(r);
    const options = it.selectedOptions || [];
    const tiers = it.priceTiers || [];
    // description cell: name, client ref, chosen options, quantity tiers
    const lines = [it.description || "—"];
    if (it.client_ref) lines.push(`Your ref: ${it.client_ref}`);
    if (options.length) {
      if (it.all_inclusive) lines.push("ALL-INCLUSIVE PRICE");
      options.forEach(o => lines.push(`${String(o.option_type || "").toUpperCase()}: ${o.label}${!it.all_inclusive && parseFloat(o.extra_price) > 0 ? ` (+${Number(o.extra_price).toFixed(2)})` : ""}`));
    }
    if (tiers.length) {
      lines.push("Price by quantity:");
      tiers.forEach(t => {
        const range = t.max_qty != null && t.max_qty !== t.min_qty ? `${t.min_qty}${t.max_qty ? `–${t.max_qty}` : "+"} pcs` : `${t.min_qty} pcs`;
        lines.push(`  ${range}: ${Number(t.price || 0).toFixed(2)}${t.notes ? ` · ${t.notes}` : ""}`);
      });
    }
    const text = lines.join("\n");
    row.height = Math.max(rowHeight(text, 56), photos[idx] ? 64 : 24);

    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: FONT, size: 10, color: { argb: "FF1A1A1A" } };
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: c.num ? "right" : c.center ? "center" : "left", indent: c.num || c.center ? 0 : 1 };
      cell.border = { bottom: thin };
      if (idx % 2) fill(cell, ZEBRA);
      if (c.num) cell.numFmt = c.num;
    });
    row.getCell(ci("no")).value = it.item_number || idx + 1;
    row.getCell(ci("no")).font = { name: FONT, size: 10, color: { argb: GREY } };
    const dc = row.getCell(descIdx); dc.value = text; dc.alignment = { vertical: "top", wrapText: true, indent: 1 };
    // bold first line: rich text keeps the rest regular
    dc.value = { richText: lines.map((ln, li) => ({
      text: ln + (li < lines.length - 1 ? "\n" : ""),
      font: li === 0 ? { name: FONT, size: 10, bold: true, color: { argb: "FF1A1A1A" } } : { name: FONT, size: 9, color: { argb: "FF555555" } },
    })) };
    if (showStatus) {
      const sc = row.getCell(ci("status"));
      const ok = isReady(it);
      sc.value = ok ? "Ready" : "In production";
      sc.font = { name: FONT, size: 9, bold: true, color: { argb: ok ? GREEN : AMBER } };
      fill(sc, ok ? GREEN_BG : AMBER_BG);
    }
    row.getCell(ci("qty")).value = qtyOf(it);
    if (showMoq) row.getCell(ci("moq")).value = num(it.moq);
    const price = priceOf(it);
    if (tiers.length && !(price > 0)) { row.getCell(ci("price")).value = "See tiers"; row.getCell(ci("price")).font = { name: FONT, size: 9, italic: true, color: { argb: GREY } }; }
    else { row.getCell(ci("price")).value = price; row.getCell(ci("amount")).value = price * qtyOf(it); row.getCell(ci("amount")).font = { name: FONT, size: 10, bold: true, color: { argb: "FF1A1A1A" } }; }

    const p = photos[idx];
    if (p) {
      const id = wb.addImage({ base64: p.data, extension: "jpeg" });
      const side = 56, k = Math.min(side / p.w, side / p.h);
      const w = Math.round(p.w * k), h = Math.round(p.h * k);
      const colPx = cols[1].width * 7 + 5, rowPx = (row.height * 96) / 72;
      ws.addImage(id, { tl: { col: 1 + Math.max(0, (colPx - w) / 2) / colPx, row: r - 1 + Math.max(0, (rowPx - h) / 2) / rowPx }, ext: { width: w, height: h } });
    }
    r++;
  });

  // ---- bottom: notes + bank (left) | totals + payments (right)
  r += 1;
  const bottomTop = r;
  const left = [];
  const notes = [quotation?.negotiation_term ? `Negotiation Terms: ${quotation.negotiation_term}` : null, quotation?.notes || null].filter(Boolean).join("\n");
  if (readyOnly) left.push({ text: "This statement covers only the items already finished in production. Items still in production are not included.", style: "note" });
  if (notes) { left.push({ text: "NOTES / TERMS", style: "label" }, { text: notes, style: "text" }); }
  left.push({ text: "BANK DETAILS", style: "label" });
  [["Company Name", BANK_DETAILS.company], ["Address", BANK_DETAILS.address], ["Account Number", BANK_DETAILS.accountNumber],
   ["Bank Name", BANK_DETAILS.bankName], ["Bank Address", BANK_DETAILS.bankAddress], ["Bank Code", BANK_DETAILS.bankCode], ["SWIFT Code", BANK_DETAILS.swift]]
    .forEach(([k, v]) => left.push({ k, v, style: "kv" }));

  // payments (proforma / invoice only)
  const showPayments = (quotation?.document_type === "proforma" || quotation?.document_type === "invoice") && payments.length > 0;
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const right = [];
  if (readyOnly) {
    const dep = (parseFloat(quotation?.deposit_pct) || 0) / 100;
    const fullGrand = fullSubtotal + fullSubtotal * (pct / 100);
    const depositApplied = grand * dep;
    const extraPaid = Math.max(totalPaid - fullGrand * dep, 0);
    const balance = Math.max(grand - depositApplied - extraPaid, 0);
    right.push({ k: "Ready items subtotal", v: subtotal });
    if (pct > 0 && showComm) right.push({ k: `Commission (${pct}%)`, v: commission });
    if (dep > 0) right.push({ k: `Deposit applied (${quotation.deposit_pct}%)`, v: -depositApplied, tone: "green" });
    if (extraPaid > 0) right.push({ k: "Additional payments applied", v: -extraPaid, tone: "green" });
    right.push({ k: `Balance due, ready items (${currency})`, v: balance, style: "total" });
  } else {
    right.push({ k: "Subtotal", v: fullSubtotal });
    if (showComm && pct > 0) right.push({ k: `Commission (${pct}%)`, v: commission });
    right.push({ k: `${meta.amountLabel} (${currency})`, v: grand, style: "total" });
    if (showPayments) {
      right.push({ k: "PAYMENT STATUS", style: "label" });
      payments.forEach(p => right.push({ k: `${longDate(p.payment_date)}${p.method ? ` · ${p.method}` : ""}`, v: parseFloat(p.amount) || 0, small: true }));
      const bal = Math.max(grand - totalPaid, 0);
      right.push({ k: "Paid", v: totalPaid, tone: "green", bold: true });
      right.push({ k: "Balance Due", v: bal, tone: bal > 0.004 ? "gold" : "green", bold: true });
    }
  }

  const rowsNeeded = Math.max(left.length, right.length);
  for (let i = 0; i < rowsNeeded; i++) {
    const rr = bottomTop + i;
    const row = ws.getRow(rr); row.height = 17;
    const l = left[i];
    if (l) {
      if (l.style === "kv") {
        const k = ws.getCell(rr, 1); k.value = l.k; k.font = { name: FONT, size: 9, color: { argb: GREY } }; k.alignment = { vertical: "middle", indent: 1 };
        ws.mergeCells(rr, 1, rr, 2);
        const v = merge(rr, 3, descIdx); v.value = l.v; v.font = { name: FONT, size: 10, bold: /Account|Bank Name|SWIFT|Company/.test(l.k), color: { argb: "FF1A1A1A" } }; v.alignment = { vertical: "middle", wrapText: true };
        if (String(l.v).length > 46) row.height = 29;
      } else {
        const c = merge(rr, 1, descIdx); c.value = l.text;
        if (l.style === "label") { c.font = { name: FONT, size: 8, bold: true, color: { argb: "FF888888" } }; c.alignment = { vertical: "middle", indent: 1 }; }
        else {
          c.font = { name: FONT, size: 10, italic: l.style === "note", color: { argb: l.style === "note" ? AMBER : "FF333333" } };
          c.alignment = { vertical: "top", wrapText: true, indent: 1 };
          const chars = cols.slice(0, descIdx).reduce((n, x) => n + x.width, 0);
          row.height = Math.max(17, rowHeight(l.text, chars) - 8);
        }
      }
    }
    const rt = right[i];
    if (rt) {
      const k = merge(rr, mid, N - 1); const v = ws.getCell(rr, N);
      k.value = rt.k; v.value = rt.style === "label" ? null : rt.v;
      if (rt.style === "label") {
        k.font = { name: FONT, size: 8, bold: true, color: { argb: "FF888888" } }; k.alignment = { vertical: "bottom", indent: 1 };
      } else if (rt.style === "total") {
        row.height = 26;
        k.font = { name: FONT, size: 11, bold: true, color: { argb: WHITE } }; v.font = { name: FONT, size: 13, bold: true, color: { argb: GOLD } };
        for (let c = mid; c <= N; c++) fill(ws.getCell(rr, c), NAVY);
        k.alignment = { vertical: "middle", indent: 1 }; v.alignment = { vertical: "middle", horizontal: "right" };
      } else {
        const color = rt.tone === "green" ? GREEN : rt.tone === "gold" ? GOLD : "FF444444";
        k.font = { name: FONT, size: rt.small ? 9 : 10, bold: !!rt.bold, color: { argb: rt.tone ? color : GREY } };
        v.font = { name: FONT, size: rt.small ? 9 : 10, bold: rt.bold !== false && !rt.small, color: { argb: rt.tone ? color : "FF1A1A1A" } };
        k.alignment = { vertical: "middle", indent: 1 }; v.alignment = { vertical: "middle", horizontal: "right" };
        for (let c = mid; c <= N; c++) ws.getCell(rr, c).border = { bottom: thin };
      }
      v.numFmt = "#,##0.00;-#,##0.00";
    }
  }
  const bottomEnd = bottomTop + rowsNeeded - 1;
  r = bottomEnd + 2;
  const foot = merge(r, 1, N); foot.value = `Generated by Ygri CRM · ${COMPANY.website}`;
  foot.font = { name: FONT, size: 8, color: { argb: "FFAAAAAA" } }; foot.alignment = { horizontal: "center" };

  const buffer = await wb.xlsx.writeBuffer();
  download(buffer, `${meta.prefix}_${safeName(quotation?.quote_number || "draft")}_${safeName(clientName || "client")}${readyOnly ? "_ready-items" : ""}.xlsx`);
}
