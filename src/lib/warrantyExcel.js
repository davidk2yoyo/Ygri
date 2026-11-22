// "Warranty Tracker" Excel: the sheet clients already use to report faulty products to us and we forward to
// the supplier. Import reads rows + the pictures embedded next to each row; export writes the same layout.

const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const cellText = (v) => {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map(x => x.text).join("");
    if (v.result != null) return String(v.result);
    if (v.text != null) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return "";
  }
  return String(v).trim();
};

// Header text → field. Order matters ("Supplier Questions" must not be read as the supplier's name).
function fieldOf(header) {
  const h = norm(header);
  if (!h) return null;
  if (h.includes("question") || h.includes("pregunta")) return "supplier_question";
  if (h.includes("answer") || h.includes("respuesta")) return "supplier_answer";
  if (h.includes("order ref") || h.includes("orden proveedor") || h.includes("# orden")) return "supplier_order_ref";
  if (h.includes("supplier model") || h.includes("ref proovedor") || h.includes("ref proveedor")) return "supplier_model";
  if (h.includes("supplier name") || h === "proveedor") return "supplier_name";
  if (h.includes("model")) return "client_model";
  if (h.includes("problem")) return "problem";
  if (h.includes("picture") || h.includes("imagen") || h.includes("video")) return "media";
  if (h.includes("cantidad") || h === "qty" || h.includes("quantity")) return "qty";
  if (h.includes("nombre") || h === "name" || h === "product") return "product_name";
  return null;
}

export async function parseWarrantyTracker(file) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const items = [];
  for (const ws of wb.worksheets) {
    // find the header row: the first one that maps at least 3 known fields
    let headerRow = 0, cols = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 30) && !headerRow; r++) {
      const map = {};
      ws.getRow(r).eachCell({ includeEmpty: false }, (c, n) => { const f = fieldOf(cellText(c.value)); if (f && !Object.values(map).includes(f)) map[n] = f; });
      if (Object.keys(map).length >= 3) { headerRow = r; cols = map; }
    }
    if (!headerRow) continue;

    const imagesByRow = {};
    for (const im of ws.getImages()) {
      const row = Math.floor(im.range.tl.nativeRow) + 1;
      const media = wb.getImage(Number(im.imageId));
      if (!media?.buffer) continue;
      (imagesByRow[row] ||= []).push({ buffer: media.buffer, ext: (media.extension || "png").toLowerCase() });
    }

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const it = { _row: r, sheet: ws.name };
      let any = false;
      for (const [n, f] of Object.entries(cols)) {
        if (f === "media") continue;
        const t = cellText(ws.getRow(r).getCell(Number(n)).value);
        if (t) { it[f] = t; any = true; }
      }
      if (!any) continue;
      it.qty = Math.max(1, parseInt(it.qty, 10) || 1);
      it.images = imagesByRow[r] || [];
      items.push(it);
    }
  }
  return items;
}

// Image buffer from the sheet → File (so it goes through the same uploader as camera photos)
export const imageToFile = (img, i = 0) => new File([img.buffer], `foto-${i + 1}.${img.ext === "jpeg" ? "jpg" : img.ext}`, { type: `image/${img.ext === "jpg" ? "jpeg" : img.ext}` });

// ── export ───────────────────────────────────────────────────────────────────────────────────────

async function loadPhoto(url) {
  if (!url) return null;
  try {
    const blob = await (await fetch(url, { mode: "cors" })).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 220 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.82), w: c.width, h: c.height };
  } catch { return null; }
}

const HEADERS = [
  ["NOMBRE", "Nombre / Name"],
  ["Supplier Name (Proveedor)"], ["Supplier Order Ref (# orden Proveedor)"], ["Supplier Model Number (Ref proveedor)"],
  ["Client Model Number (Ref cliente)"], ["Problem (Problema)"], ["Complaint date (fecha de queja)"],
  ["Picture or Video (Imagen o Video)"], ["CANTIDAD (Qty)"], ["Supplier Questions (Para llenado del proveedor)"], ["Answer (Respuesta)"],
];

// claims: [{ claim_number, created_at, items: [...] }]; same layout as the client's Warranty Tracker
export async function exportWarrantyTracker({ claims, clientName, fileName = "Warranty Tracker" }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Warranty Tracker");
  const widths = [26, 18, 18, 18, 18, 30, 16, 28, 10, 36, 36];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  ws.getCell("A1").value = "Warranty Tracker - Seguimiento Garantías"; ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = `Client / Cliente: ${clientName || ""}`;
  ws.getCell("A3").value = `Date / Fecha: ${new Date().toISOString().slice(0, 10)}`;
  ws.getCell("F3").value = "Supplier Review date:";

  const head = ws.getRow(5);
  HEADERS.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h[0];
    c.font = { bold: true, size: 10 };
    c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  head.height = 34;

  const rows = claims.flatMap(c => (c.items || []).map(i => ({ ...i, claim_number: c.claim_number })));
  const photos = await Promise.all(rows.map(r => loadPhoto((r.media || []).find(m => m.kind !== "video")?.url)));
  const ROW_H = 90;
  rows.forEach((r, idx) => {
    const n = 6 + idx;
    const row = ws.getRow(n);
    [r.product_name, r.supplier_name, r.supplier_order_ref, r.supplier_model, r.client_model, r.problem,
      r.complaint_date ? String(r.complaint_date).slice(0, 10) : "", "", r.qty, r.supplier_question || "", r.supplier_answer || ""]
      .forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v;
        c.alignment = { wrapText: true, vertical: "middle" };
        c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
    const vids = (r.media || []).filter(m => m.kind === "video");
    if (vids.length) { row.getCell(8).value = { text: "Video", hyperlink: vids[0].url }; row.getCell(8).font = { color: { argb: "FF2563EB" }, underline: true }; }
    row.height = ROW_H;
    const p = photos[idx];
    if (p) {
      const id = wb.addImage({ base64: p.data, extension: "jpeg" });
      const px = widths[7] * 7, py = ROW_H * 1.33;
      const k = Math.min(1, (px - 8) / p.w, (py - 8) / p.h);
      ws.addImage(id, { tl: { col: 7 + 4 / px, row: n - 1 + 4 / py }, ext: { width: p.w * k, height: p.h * k } });
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${fileName}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
