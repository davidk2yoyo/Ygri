import { COMPANY } from "./companyInfo";
import { loadLogo, safeName, download } from "./packingListExcel";

// Commercial invoice for customs: no photos, one row per product with every detail the client's own
// order sheet carries (supplier, supplier ref, client ref, description, colour, brand, marking, packing,
// quantity, unit price, total), grouped by supplier. ExcelJS is loaded on demand.

const NAVY = "FF1E3A5F", GOLD = "FFC9922A", LIGHT = "FFEEF2F7", LINE = "FFB8C2CF", GREY = "FF6B7280", WHITE = "FFFFFFFF";
const FONT = "Calibri";

const labelOf = (opts, types) => (opts || []).filter(o => types.includes(o.option_type)).map(o => o.label).filter(Boolean).join(" / ");

// What the quotation item says (options chosen), falling back to the client's original order line.
export function customsRowFor(item, { supplierNames = {}, orderLines = {} } = {}) {
  const opts = item.selectedOptions || [];
  const line = orderLines[item.client_order_line_id] || null;
  const logo = opts.find(o => o.option_type === "logo");
  const other = opts.find(o => o.option_type === "other" && /^marca:/i.test(o.label || ""));
  const brand = other ? other.label.replace(/^marca:\s*/i, "") : logo ? logo.label.replace(/^marcaci[oó]n\s*/i, "") : (line?.brand || "");
  const extra = item.all_inclusive ? 0 : opts.reduce((s, o) => s + (parseFloat(o.extra_price) || 0), 0);
  return {
    supplier: supplierNames[item.supplier_id] || line?.supplier_name_raw || "",
    supplierRef: item.item_number || line?.supplier_ref || "",
    clientRef: item.client_ref || line?.client_ref || "",
    description: item.description || line?.name || "",
    color: labelOf(opts, ["color"]) || line?.color || "",
    brand,
    marking: logo || line?.marking === true ? "SI" : "",
    packaging: labelOf(opts, ["packaging", "box_type"]) || line?.packaging || "",
    qty: parseInt(item.quantity) || 1,
    unit: Math.round(((parseFloat(item.price) || 0) + extra) * 1e6) / 1e6,   // no float noise like 1.6300000000000001
  };
}

// Supplier groups in first-appearance order; lines keep their order inside each group.
export function groupBySupplier(rows) {
  const groups = [];
  const index = new Map();
  rows.forEach(r => {
    const key = r.supplier || "";
    if (!index.has(key)) { index.set(key, groups.length); groups.push({ supplier: key, rows: [] }); }
    groups[index.get(key)].rows.push(r);
  });
  return groups;
}

export async function fetchCustomsExtras(supabase, items) {
  let list = items || [];
  const ids = list.map(i => i.id).filter(Boolean);
  if (ids.length && list.some(i => !i.selectedOptions)) {
    const { data } = await supabase.from("quotation_item_options").select("*").in("quotation_item_id", ids).order("sort_order");
    const by = {};
    (data || []).forEach(o => { (by[o.quotation_item_id] ||= []).push(o); });
    list = list.map(i => ({ ...i, selectedOptions: i.selectedOptions || by[i.id] || [] }));
  }
  const supplierIds = [...new Set(list.map(i => i.supplier_id).filter(Boolean))];
  const lineIds = [...new Set(list.map(i => i.client_order_line_id).filter(Boolean))];
  const [{ data: sups }, { data: lines }] = await Promise.all([
    supplierIds.length ? supabase.from("suppliers").select("id, name").in("id", supplierIds) : { data: [] },
    lineIds.length ? supabase.from("client_order_lines").select("id, supplier_name_raw, supplier_ref, client_ref, name, color, brand, marking, packaging").in("id", lineIds) : { data: [] },
  ]);
  return {
    items: list,
    supplierNames: Object.fromEntries((sups || []).map(s => [s.id, s.name])),
    orderLines: Object.fromEntries((lines || []).map(l => [l.id, l])),
  };
}

export async function buildCustomsInvoiceWorkbook(ExcelJS, { quotation, items = [], supplierNames, orderLines, clientName, clientDetails, projectName, commissionPct, showCommission, logo = null }) {
  const currency = quotation?.currency || "USD";
  const pct = parseFloat(commissionPct ?? quotation?.commission_pct) || 0;
  const showComm = (showCommission ?? quotation?.show_commission ?? false) && pct > 0;
  // A commission that is not shown to the client is folded into the unit prices so the lines still add up to the invoice total.
  const uplift = pct > 0 && !showComm ? 1 + pct / 100 : 1;

  const rows = items.map(it => customsRowFor(it, { supplierNames, orderLines })).map(r => ({ ...r, unit: Math.round(r.unit * uplift * 1e6) / 1e6 }));
  const groups = groupBySupplier(rows);

  const cols = [
    { label: "PROVEEDOR", width: 20 }, { label: "REF PROVEEDOR", width: 16 }, { label: "REF CLIENTE", width: 16 },
    { label: "DESCRIPCIÓN", width: 46 }, { label: "COLOR", width: 16 }, { label: "MARCA", width: 18 },
    { label: "MARCACIÓN", width: 13 }, { label: "EMPAQUE", width: 18 }, { label: "CANTIDAD", width: 12 },
    { label: `PRECIO UNIT (${currency})`, width: 16 }, { label: `TOTAL (${currency})`, width: 17 },
  ];
  const N = cols.length, QTY = 9, UNIT = 10, TOT = 11;
  const money = `"${currency} "#,##0.00`;          // totals: cents
  const moneyUnit = `"${currency} "#,##0.00##`;   // unit price keeps up to 4 decimals

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ygri CRM"; wb.company = COMPANY.name; wb.created = new Date();
  const ws = wb.addWorksheet("Factura comercial", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.columns = cols.map(c => ({ width: c.width }));

  const merge = (r, c1, c2) => { if (c2 > c1) ws.mergeCells(r, c1, r, c2); return ws.getCell(r, c1); };
  const fill = (cell, argb) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; };
  const thin = { style: "thin", color: { argb: LINE } };

  // ---- header
  if (logo) {
    const id = wb.addImage({ base64: logo.data, extension: "png" });
    const w = 190, h = Math.round((w * logo.h) / logo.w);
    ws.addImage(id, { tl: { col: 0.1, row: 0.25 }, ext: { width: w, height: h } });
  } else {
    const c = merge(1, 1, 3); c.value = "INTERASIA SAS"; c.font = { name: FONT, bold: true, size: 18, color: { argb: NAVY } };
  }
  const title = merge(1, 4, N); title.value = "FACTURA COMERCIAL / COMMERCIAL INVOICE";
  title.font = { name: FONT, bold: true, size: 20, color: { argb: NAVY } }; title.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(1).height = 36;
  [[2, COMPANY.name, true], [3, COMPANY.address, false], [4, `Phone: ${COMPANY.phone}   ·   Mobile: ${COMPANY.mobile}`, false], [5, COMPANY.website, false]].forEach(([r, text, bold]) => {
    const c = merge(r, 4, N); c.value = text;
    c.font = { name: FONT, size: bold ? 10 : 9, bold, color: { argb: bold ? NAVY : GREY } }; c.alignment = { horizontal: "right", vertical: "middle" };
    ws.getRow(r).height = 18;
  });
  ws.getRow(6).height = 5; for (let c = 1; c <= N; c++) fill(ws.getCell(6, c), NAVY);
  ws.getRow(7).height = 3; for (let c = 1; c <= N; c++) fill(ws.getCell(7, c), GOLD);
  ws.getRow(8).height = 10;

  // ---- consignee (left) + document data (right)
  const d = clientDetails || {};
  const place = [d.city, d.state, d.country].filter(Boolean).join(", ");
  const consignee = [
    ["CONSIGNEE / CLIENTE", "label"],
    [(clientName || "CLIENT").toUpperCase(), "name"],
    [d.rut_nit ? `RUT/NIT: ${d.rut_nit}` : null, "text"],
    [d.contact_person ? `Attn: ${d.contact_person}` : null, "text"],
    [d.address || null, "text"],
    [place || null, "text"],
    [d.phone ? `Tel: ${d.phone}` : null, "text"],
    [d.email || null, "text"],
  ].filter(([v], i) => i < 2 || v);
  const created = quotation?.created_at ? new Date(quotation.created_at) : new Date();
  const dateText = created.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const docData = [
    ["Invoice No.", quotation?.quote_number || "—"],
    ["Date", dateText],
    ["Incoterm", [quotation?.incoterm, quotation?.incoterm_location].filter(Boolean).join(" · ") || "—"],
    ["Currency", currency],
    ...((projectName || quotation?.project_name) ? [["Project", projectName || quotation.project_name]] : []),
  ];
  const top = 9;
  const blockRows = Math.max(consignee.length, docData.length);
  for (let i = 0; i < blockRows; i++) {
    const r = top + i;
    const left = consignee[i];
    if (left) {
      const c = merge(r, 1, 4); c.value = left[0];
      c.font = left[1] === "label" ? { name: FONT, bold: true, size: 9, color: { argb: GREY } } : left[1] === "name" ? { name: FONT, bold: true, size: 12, color: { argb: NAVY } } : { name: FONT, size: 10 };
    }
    const right = docData[i];
    if (right) {
      const l = merge(r, 8, 9); l.value = right[0]; l.font = { name: FONT, bold: true, size: 10, color: { argb: GREY } }; fill(l, LIGHT);
      const v = merge(r, 10, N); v.value = right[1]; v.font = { name: FONT, size: 10, bold: right[0] === "Invoice No." }; fill(v, LIGHT);
    }
    ws.getRow(r).height = 18;
  }
  const headerRow = top + blockRows + 1;
  ws.getRow(headerRow - 1).height = 8;

  // ---- table header
  const hr = ws.getRow(headerRow); hr.height = 34;
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1); cell.value = c.label;
    cell.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } }; fill(cell, NAVY);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });
  ws.views = [{ state: "frozen", ySplit: headerRow, showGridLines: false }];

  // ---- lines, grouped by supplier (supplier cell merged down the group, like the client's own sheet)
  let r = headerRow + 1;
  const firstData = r;
  groups.forEach(g => {
    const start = r;
    g.rows.forEach(x => {
      const row = ws.getRow(r);
      [x.supplier, x.supplierRef, x.clientRef, x.description, x.color, x.brand, x.marking, x.packaging].forEach((v, i) => { row.getCell(i + 1).value = i === 0 ? null : (v || null); });
      row.getCell(QTY).value = x.qty; row.getCell(QTY).numFmt = "#,##0";
      row.getCell(UNIT).value = x.unit; row.getCell(UNIT).numFmt = moneyUnit;
      row.getCell(TOT).value = { formula: `${ws.getCell(r, QTY).address}*${ws.getCell(r, UNIT).address}`, result: x.qty * x.unit }; row.getCell(TOT).numFmt = money;
      for (let c = 1; c <= N; c++) {
        const cell = row.getCell(c);
        cell.font = { name: FONT, size: 10 };
        cell.border = { top: thin, bottom: thin, left: thin, right: thin };
        cell.alignment = { vertical: "middle", wrapText: c === 4, horizontal: c >= QTY ? "right" : c === 7 ? "center" : "left" };
      }
      row.height = Math.max(22, Math.ceil((x.description || "").length / 48) * 15 + 6);
      r++;
    });
    const sc = ws.getCell(start, 1); sc.value = g.supplier || "SIN PROVEEDOR";
    if (r - 1 > start) ws.mergeCells(start, 1, r - 1, 1);
    sc.font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } };
    sc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  const lastData = r - 1;

  // ---- totals
  const totalQty = rows.reduce((s, x) => s + x.qty, 0);
  const lineSum = rows.reduce((s, x) => s + x.qty * x.unit, 0);
  const r2 = (n) => Math.round(n * 100) / 100;
  const commission = showComm ? r2(lineSum * (pct / 100)) : 0;
  const totalRow = (rr, label, qty, formula, result, strong) => {
    const lab = merge(rr, 1, QTY - 1); lab.value = label; lab.alignment = { horizontal: "right", vertical: "middle" };
    lab.font = { name: FONT, bold: true, size: strong ? 11 : 10, color: { argb: strong ? WHITE : NAVY } };
    for (let c = 1; c <= N; c++) { const cell = ws.getCell(rr, c); cell.border = { top: thin, bottom: thin, left: thin, right: thin }; if (strong) fill(cell, NAVY); else fill(cell, LIGHT); }
    const q = ws.getCell(rr, QTY); if (qty != null) { q.value = qty; q.numFmt = "#,##0"; }
    const t = ws.getCell(rr, TOT); t.value = { formula, result }; t.numFmt = money;
    [q, t].forEach(cell => { cell.font = { name: FONT, bold: true, size: strong ? 11 : 10, color: { argb: strong ? WHITE : "FF000000" } }; cell.alignment = { horizontal: "right", vertical: "middle" }; });
    ws.getRow(rr).height = 22;
  };
  const sumRange = `SUM(${ws.getCell(firstData, TOT).address}:${ws.getCell(lastData, TOT).address})`;
  let tr = lastData + 1;
  const qtyFormula = `SUM(${ws.getCell(firstData, QTY).address}:${ws.getCell(lastData, QTY).address})`;
  if (showComm) {
    totalRow(tr, "SUBTOTAL", totalQty, `ROUND(${sumRange},2)`, r2(lineSum), false);
    ws.getCell(tr, QTY).value = { formula: qtyFormula, result: totalQty };
    tr++;
    totalRow(tr, `Commission (${pct}%)`, null, `ROUND(${ws.getCell(tr - 1, TOT).address}*${pct / 100},2)`, commission, false);
    tr++;
    totalRow(tr, `TOTAL (${currency})`, null, `${ws.getCell(tr - 2, TOT).address}+${ws.getCell(tr - 1, TOT).address}`, r2(lineSum) + commission, true);
  } else {
    totalRow(tr, `TOTAL (${currency})`, totalQty, `ROUND(${sumRange},2)`, r2(lineSum), true);
    ws.getCell(tr, QTY).value = { formula: qtyFormula, result: totalQty };
  }

  const filename = `Factura_comercial_${safeName(quotation?.quote_number || "draft")}_${safeName(clientName || "client")}.xlsx`;
  return { wb, filename, rows: rows.length, total: r2(lineSum) + commission };
}

export async function exportCustomsInvoiceExcel(params) {
  const ExcelJS = (await import("exceljs")).default;
  const logo = await loadLogo();
  const { wb, filename } = await buildCustomsInvoiceWorkbook(ExcelJS, { ...params, logo });
  download(await wb.xlsx.writeBuffer(), filename);
}
