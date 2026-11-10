import { COMPANY } from "./companyInfo";
import { colorToHex } from "./colorUtil";

// Styled packing-list workbook (no product photos), used by the staff editor, the PDF viewer
// and the client portal. ExcelJS is loaded on demand so it doesn't weigh on the main bundle.

const NAVY = "FF1E3A5F", GOLD = "FFC9922A", LIGHT = "FFEEF2F7", ZEBRA = "FFF9FAFB", LINE = "FFE0E4EA", GREY = "FF6B7280", WHITE = "FFFFFFFF";
const FONT = "Calibri";

export async function fetchClientDetails(supabase, clientName) {
  if (!clientName) return null;
  const { data } = await supabase.from("clients").select("*").eq("company_name", clientName).maybeSingle();
  return data || null;
}

// logo as PNG data URL, shrunk (the source image is ~6000px wide)
export async function loadLogo(url = "/images/interasia-logo.png") {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 600 / bmp.width);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/png"), w: c.width, h: c.height };
  } catch { return null; }
}

// Excel does not size rows for wrapped text reliably, so give each row a height from its text length
export const rowHeight = (text, charsPerLine) => {
  const lines = String(text || "").split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0);
  return Math.max(24, lines * 14 + 10);
};

export const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const sum = (arr, f) => arr.reduce((n, x) => n + (num(f(x)) || 0), 0);
const groupKey = (id, name) => id || `raw:${name || "Sin proveedor"}`;
export const safeName = (s) => String(s || "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");

export function download(buffer, filename) {
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportPackingListExcel({
  packingList, items, supplierTotals = [], clientName, clientDetails, projectName, quoteNumber, quoteRefLabel = "Quote Ref", notes,
}) {
  const ExcelJS = (await import("exceljs")).default;
  const bySupplier = packingList?.mode === "by_supplier";
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ygri CRM"; wb.company = COMPANY.name; wb.created = new Date();
  const ws = wb.addWorksheet("Packing List", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  // ---- column grid -------------------------------------------------------
  // normal:      Item# | Description | ● | Color | Cartons | Qty | L | W | H | CBM | N.W. | G.W.
  // by supplier: Supplier | Ref | Description | ● | Color | Qty | Cartons | N.W. | G.W. | CBM
  const cols = bySupplier
    ? [["Supplier", 24], ["Ref", 15], ["Description", 46], ["", 3], ["Color", 16], ["Qty", 10], ["Cartons", 11], ["N.W. (kg)", 12], ["G.W. (kg)", 12], ["CBM", 12]]
    : [["Item #", 15], ["Description", 46], ["", 3], ["Color", 16], ["Cartons", 10], ["Qty", 10], ["L (cm)", 9], ["W (cm)", 9], ["H (cm)", 9], ["CBM", 11], ["N.W. (kg)", 11], ["G.W. (kg)", 11]];
  ws.columns = cols.map(([, w]) => ({ width: w }));
  const N = cols.length;
  const mid = Math.ceil(N / 2) + 1;           // right-hand blocks start here
  const merge = (r, c1, c2) => { if (c2 > c1) ws.mergeCells(r, c1, r, c2); return ws.getCell(r, c1); };
  const fill = (cell, argb) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; };
  const box = (r1, c1, r2, c2, argb = LINE) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: r === r1 ? { style: "thin", color: { argb } } : undefined, bottom: r === r2 ? { style: "thin", color: { argb } } : undefined,
        left: c === c1 ? { style: "thin", color: { argb } } : undefined, right: c === c2 ? { style: "thin", color: { argb } } : undefined,
      };
    }
  };

  // ---- header: logo + company -------------------------------------------
  const logo = await loadLogo();
  for (let r = 1; r <= 5; r++) ws.getRow(r).height = 20;
  if (logo) {
    const id = wb.addImage({ base64: logo.data, extension: "png" });
    const w = 190, h = Math.round((w * logo.h) / logo.w);
    ws.addImage(id, { tl: { col: 0.1, row: 0.25 }, ext: { width: w, height: h } });
  } else {
    const c = merge(1, 1, mid - 1); c.value = "INTERASIA SAS"; c.font = { name: FONT, bold: true, size: 18, color: { argb: NAVY } };
  }
  const title = merge(1, mid, N); title.value = "PACKING LIST";
  title.font = { name: FONT, bold: true, size: 24, color: { argb: NAVY } }; title.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(1).height = 36;
  [[2, COMPANY.name, true], [3, COMPANY.address, false], [4, `Phone: ${COMPANY.phone}   ·   Mobile: ${COMPANY.mobile}`, false], [5, COMPANY.website, false]].forEach(([r, text, bold]) => {
    const c = merge(r, mid, N); c.value = text;
    c.font = { name: FONT, size: bold ? 10 : 9, bold, color: { argb: bold ? NAVY : GREY } }; c.alignment = { horizontal: "right", vertical: "middle" };
  });
  // gold + navy rule
  ws.getRow(6).height = 5;
  for (let c = 1; c <= N; c++) fill(ws.getCell(6, c), NAVY);
  ws.getRow(7).height = 3;
  for (let c = 1; c <= N; c++) fill(ws.getCell(7, c), GOLD);
  ws.getRow(8).height = 10;

  // ---- ship to (left) + document data (right) ---------------------------
  const d = clientDetails || {};
  const place = [d.city, d.state, d.country].filter(Boolean).join(", ");
  const shipTo = [
    ["SHIP TO", null],
    [(clientName || "CLIENT").toUpperCase(), "name"],
    [projectName ? `Project: ${projectName}` : null, "text"],
    [d.rut_nit ? `RUT/NIT: ${d.rut_nit}` : null, "text"],
    [d.contact_person ? `Attn: ${d.contact_person}` : null, "text"],
    [d.address || null, "text"],
    [place || null, "text"],
    [d.phone ? `Tel: ${d.phone}` : null, "text"],
    [d.email || null, "text"],
    [d.website || null, "text"],
  ].filter(([v], i) => i < 2 || v);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const meta = [
    ["Packing List No.", packingList?.pl_number || "DRAFT"],
    quoteNumber ? [`${quoteRefLabel}`, quoteNumber] : null,
    ["Date", today],
    ["Mode", bySupplier ? "Totals per supplier" : "Per item"],
    packingList?.title && packingList.title !== "Packing List" ? ["Title", packingList.title] : null,
  ].filter(Boolean);

  const top = 9;
  const blockRows = Math.max(shipTo.length, meta.length + 1);
  for (let i = 0; i < blockRows; i++) {
    const r = top + i;
    ws.getRow(r).height = i === 0 ? 16 : 17;
    // left
    const l = shipTo[i];
    if (l) {
      const c = merge(r, 1, mid - 1); c.value = l[0];
      if (i === 0) c.font = { name: FONT, size: 8, bold: true, color: { argb: "FF888888" } };
      else if (l[1] === "name") c.font = { name: FONT, size: 13, bold: true, color: { argb: NAVY } };
      else c.font = { name: FONT, size: 10, color: { argb: "FF444444" } };
      c.alignment = { vertical: "middle", indent: 1, wrapText: false };
    } else merge(r, 1, mid - 1);
    // right
    if (i === 0) {
      const c = merge(r, mid, N); c.value = "DOCUMENT"; c.font = { name: FONT, size: 8, bold: true, color: { argb: "FF888888" } };
      c.alignment = { vertical: "middle", indent: 1 };
    } else if (meta[i - 1]) {
      const k = ws.getCell(r, mid); k.value = meta[i - 1][0]; k.font = { name: FONT, size: 10, color: { argb: GREY } }; k.alignment = { vertical: "middle", indent: 1 };
      ws.mergeCells(r, mid, r, mid + 1);
      const v = merge(r, mid + 2, N); v.value = meta[i - 1][1]; v.font = { name: FONT, size: 10, bold: true, color: { argb: "FF1A1A1A" } }; v.alignment = { vertical: "middle" };
    }
  }
  const blockEnd = top + blockRows - 1;
  box(top, 1, blockEnd, mid - 1);
  box(top, mid, blockEnd, N);
  for (let r = top; r <= blockEnd; r++) { for (let c = 1; c <= N; c++) fill(ws.getCell(r, c), "FFF7F8FA"); }
  ws.getRow(blockEnd + 1).height = 12;

  // ---- table --------------------------------------------------------------
  const headRow = blockEnd + 2;
  const numCols = bySupplier ? { Qty: "#,##0", Cartons: "#,##0", "N.W. (kg)": "#,##0.00", "G.W. (kg)": "#,##0.00", CBM: "0.0000" }
    : { Cartons: "#,##0", Qty: "#,##0", "L (cm)": "0.##", "W (cm)": "0.##", "H (cm)": "0.##", CBM: "0.0000", "N.W. (kg)": "#,##0.00", "G.W. (kg)": "#,##0.00" };
  const hr = ws.getRow(headRow); hr.height = 24;
  cols.forEach(([label], i) => {
    const c = hr.getCell(i + 1); c.value = label;
    fill(c, NAVY); c.font = { name: FONT, bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { vertical: "middle", horizontal: numCols[label] ? "right" : "left", indent: numCols[label] ? 0 : 1, wrapText: true };
  });
  ws.pageSetup.printTitlesRow = `${headRow}:${headRow}`;

  const thin = { style: "thin", color: { argb: LINE } };
  let r = headRow + 1, zebra = 0;
  const styleRow = (row, bg) => {
    for (let c = 1; c <= N; c++) {
      const cell = row.getCell(c);
      cell.font = { name: FONT, size: 10, color: { argb: "FF1A1A1A" } };
      cell.alignment = { vertical: "middle", wrapText: true, horizontal: numCols[cols[c - 1][0]] ? "right" : "left", indent: numCols[cols[c - 1][0]] ? 0 : 1 };
      cell.border = { bottom: thin };
      if (bg) fill(cell, bg);
      const fmt = numCols[cols[c - 1][0]]; if (fmt) cell.numFmt = fmt;
    }
  };
  const swatch = (row, col, color) => {
    const hex = colorToHex(color);
    const cell = row.getCell(col);
    if (hex) { fill(cell, "FF" + hex.slice(1).toUpperCase()); cell.border = { top: { style: "medium", color: { argb: WHITE } }, bottom: { style: "medium", color: { argb: WHITE } }, left: { style: "thin", color: { argb: WHITE } }, right: { style: "thin", color: { argb: WHITE } } }; }
  };
  const putItem = (row, col, it) => {
    if (it.color) row.getCell(col + 1).value = it.color;
    swatch(row, col, it.color);
    // photos are intentionally left out of the packing list
  };

  if (!bySupplier) {
    items.forEach((it) => {
      const row = ws.getRow(r++); styleRow(row, zebra++ % 2 ? ZEBRA : null);
      row.height = rowHeight(it.description, 50);
      row.getCell(1).value = it.item_number || ""; row.getCell(2).value = it.description || "";
      putItem(row, 3, it);
      row.getCell(5).value = num(it.carton_qty); row.getCell(6).value = num(it.qty);
      row.getCell(7).value = num(it.length_cm); row.getCell(8).value = num(it.width_cm); row.getCell(9).value = num(it.height_cm);
      row.getCell(10).value = num(it.cbm); row.getCell(11).value = num(it.nw); row.getCell(12).value = num(it.gw);
    });
    const tot = ws.getRow(r++);
    tot.height = 24;
    for (let c = 1; c <= N; c++) { const cell = tot.getCell(c); fill(cell, LIGHT); cell.font = { name: FONT, bold: true, size: 10.5, color: { argb: NAVY } }; cell.border = { top: { style: "medium", color: { argb: NAVY } } }; cell.alignment = { vertical: "middle", horizontal: "right" }; }
    tot.getCell(1).value = "TOTAL"; tot.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    tot.getCell(5).value = sum(items, i => i.carton_qty); tot.getCell(6).value = sum(items, i => i.qty);
    tot.getCell(10).value = sum(items, i => i.cbm); tot.getCell(11).value = sum(items, i => i.nw); tot.getCell(12).value = sum(items, i => i.gw);
    ["E", "F"].forEach(L => { tot.getCell(L).numFmt = "#,##0"; });
    tot.getCell(10).numFmt = "0.0000"; tot.getCell(11).numFmt = "#,##0.00"; tot.getCell(12).numFmt = "#,##0.00";
  } else {
    const groups = [];
    const idx = {};
    items.forEach(it => {
      const k = groupKey(it.supplier_id, it.supplier_name);
      if (!(k in idx)) { idx[k] = groups.length; groups.push({ key: k, name: it.supplier_name || "Sin proveedor", items: [] }); }
      groups[idx[k]].items.push(it);
    });
    const grand = { carton_qty: 0, nw: 0, gw: 0, cbm: 0, qty: 0 };
    groups.forEach((g, gi) => {
      const t = supplierTotals.find(x => groupKey(x.supplier_id, x.supplier_name) === g.key) || {};
      const start = r;
      g.items.forEach((it) => {
        const row = ws.getRow(r++); styleRow(row, gi % 2 ? ZEBRA : null);
        row.height = rowHeight(it.description, 50);
        row.getCell(2).value = it.item_number || ""; row.getCell(3).value = it.description || "";
        putItem(row, 4, it);
        row.getCell(6).value = num(it.qty);
        grand.qty += num(it.qty) || 0;
      });
      const end = r - 1;
      if (end > start) [1, 7, 8, 9, 10].forEach(c => ws.mergeCells(start, c, end, c));
      const first = ws.getRow(start);
      first.getCell(1).value = g.name; first.getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: NAVY } };
      first.getCell(1).alignment = { vertical: "top", wrapText: true, indent: 1 };
      first.getCell(7).value = num(t.carton_qty); first.getCell(8).value = num(t.nw); first.getCell(9).value = num(t.gw); first.getCell(10).value = num(t.cbm);
      [7, 8, 9, 10].forEach(c => { first.getCell(c).alignment = { vertical: "top", horizontal: "right" }; });
      for (let rr = start; rr <= end; rr++) for (let c = 1; c <= N; c++) { ws.getCell(rr, c).border = Object.assign({}, ws.getCell(rr, c).border, rr === end ? { bottom: { style: "thin", color: { argb: "FFB8C0CC" } } } : {}); }
      grand.carton_qty += num(t.carton_qty) || 0; grand.nw += num(t.nw) || 0; grand.gw += num(t.gw) || 0; grand.cbm += num(t.cbm) || 0;
    });
    const tot = ws.getRow(r++);
    tot.height = 24;
    for (let c = 1; c <= N; c++) { const cell = tot.getCell(c); fill(cell, LIGHT); cell.font = { name: FONT, bold: true, size: 10.5, color: { argb: NAVY } }; cell.border = { top: { style: "medium", color: { argb: NAVY } } }; cell.alignment = { vertical: "middle", horizontal: "right" }; }
    tot.getCell(1).value = "TOTAL"; tot.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    tot.getCell(6).value = grand.qty; tot.getCell(6).numFmt = "#,##0";
    tot.getCell(7).value = grand.carton_qty; tot.getCell(7).numFmt = "#,##0";
    tot.getCell(8).value = grand.nw; tot.getCell(8).numFmt = "#,##0.00";
    tot.getCell(9).value = grand.gw; tot.getCell(9).numFmt = "#,##0.00";
    tot.getCell(10).value = grand.cbm; tot.getCell(10).numFmt = "0.0000";
  }

  // ---- notes + footer -------------------------------------------------------
  if (notes?.trim()) {
    r += 1;
    const lab = merge(r, 1, N); lab.value = "NOTES"; lab.font = { name: FONT, size: 8, bold: true, color: { argb: "FF888888" } };
    r += 1;
    const c = merge(r, 1, N); c.value = notes.trim();
    c.font = { name: FONT, size: 10, color: { argb: "FF333333" } }; c.alignment = { vertical: "top", wrapText: true, indent: 1 };
    const approxChars = cols.reduce((n, [, w]) => n + w, 0);
    const lines = notes.trim().split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / approxChars)), 0);
    ws.getRow(r).height = Math.max(20, lines * 15 + 6);
    box(r, 1, r, N); for (let cc = 1; cc <= N; cc++) fill(ws.getCell(r, cc), "FFF7F8FA");
  }
  r += 2;
  const foot = merge(r, 1, N); foot.value = `Generated by Ygri CRM · ${COMPANY.website}`;
  foot.font = { name: FONT, size: 8, color: { argb: "FFAAAAAA" } }; foot.alignment = { horizontal: "center" };

  const buffer = await wb.xlsx.writeBuffer();
  download(buffer, `PackingList_${safeName(packingList?.pl_number || "draft")}_${safeName(clientName || "client")}.xlsx`);
}
