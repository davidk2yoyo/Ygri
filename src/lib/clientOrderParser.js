import * as XLSX from "xlsx";
import JSZip from "jszip";

// Client purchase-order workbooks: one sheet per supplier, header row near the
// top, embedded product photos. Parsing is deterministic; sheets whose headers
// we can't recognise come back as kind "unknown" so the UI can ask for a mapping.

export const normalizeHeader = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const FIELD_BY_HEADER = {
  "REF PROVEEDOR": "supplier_ref",
  PROVEEDOR: "supplier",
  NOMBRE: "name",
  DESCRIPCION: "name",
  FOTO: "photo",
  COLOR: "color",
  CANTIDAD: "qty",
  "NUEVO PEDIDO": "qty",
  PRECIO: "price",
  "PRECIO UNIT USD": "price",
  TOTAL: "total",
  "TOTAL USD": "total",
  "REF CLIENTE": "client_ref",
  REFERENCIA: "client_ref",
  DESCMARCA: "brand",
  DESMARCA: "brand",
  MARCACION: "marking",
  EMPAQUE: "packaging",
  NOTA: "notes",
  NOTAS: "notes",
  "NOTAS IMPORTANTE": "notes",
};

function fieldForHeader(raw) {
  const h = normalizeHeader(raw);
  if (!h) return null;
  if (FIELD_BY_HEADER[h]) return FIELD_BY_HEADER[h];
  // client's own SKU column is named after the client, e.g. "REF CCSF"
  if (/^REF [A-Z0-9]{2,}$/.test(h) && h !== "REF PROVEEDOR") return "client_ref";
  return null;
}

const num = (v) => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const str = (v) => (v == null ? "" : String(v).replace(/ /g, " ").trim());

function parseSheet(ws, name) {
  const ref = ws["!ref"];
  if (!ref) return { name, kind: "empty", lines: [] };
  const start = XLSX.utils.decode_range(ref).s.r;
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });

  const firstCells = grid.slice(0, 8).flat().map((c) => normalizeHeader(c));
  const isProforma = normalizeHeader(name) === "PROFORMA" || firstCells.some((c) => c.includes("COMMERCIAL INVOICE"));

  let headerIdx = -1;
  let mapping = {};
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const m = {};
    (grid[i] || []).forEach((cell, col) => {
      const f = fieldForHeader(cell);
      if (f && m[f] == null) m[f] = col;
    });
    if (Object.keys(m).length >= 4 && (m.qty != null || m.name != null)) { headerIdx = i; mapping = m; break; }
  }
  if (headerIdx < 0) return { name, kind: isProforma ? "proforma" : "unknown", lines: [], mapping: {}, headerRow: null };

  // free-text column with no header (e.g. "Necesito foto de la caja") → notes
  const headerRowCells = grid[headerIdx] || [];
  const lines = [];
  let generated = null;
  const gen = grid.slice(0, headerIdx).flat().find((c) => /GENERACION/.test(normalizeHeader(c)));
  if (gen) generated = str(gen);

  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const get = (f) => (mapping[f] != null ? row[mapping[f]] : null);
    const label = normalizeHeader(row[0]);
    if (label === "TOTAL" || label.startsWith("TOTAL ")) continue;
    const line = {
      row: start + i + 1, // 1-based sheet row, matches image anchors
      supplier_ref: str(get("supplier_ref")),
      supplier: str(get("supplier")),
      name: str(get("name")),
      color: str(get("color")),
      qty: num(get("qty")),
      price: num(get("price")),
      total: num(get("total")),
      client_ref: str(get("client_ref")),
      brand: str(get("brand")),
      marking: (() => { const m = normalizeHeader(get("marking")); return m === "SI" ? true : m === "NO" ? false : null; })(),
      packaging: str(get("packaging")),
      notes: str(get("notes")),
    };
    if (!line.notes) {
      const extra = row.find((c, col) => !headerRowCells[col] && typeof c === "string" && c.trim());
      if (extra) line.notes = str(extra);
    }
    if (!line.name && !line.supplier_ref && !line.client_ref) continue;
    if (line.price != null && line.qty != null && line.total == null) line.total = +(line.price * line.qty).toFixed(2);
    lines.push(line);
  }

  return {
    name,
    kind: isProforma ? "proforma" : lines.length ? "supplier" : "empty",
    headerRow: start + headerIdx + 1,
    mapping,
    generated,
    lines,
  };
}

// ---- embedded photos: sheet -> { [row]: { path, ext } } ----
const attr = (xml, re) => (xml.match(re) || [])[1];
const relsOf = (xml) => {
  const out = {};
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], /\bId="([^"]+)"/);
    const target = attr(m[0], /\bTarget="([^"]+)"/);
    const type = attr(m[0], /\bType="([^"]+)"/) || "";
    if (id) out[id] = { target, type };
  }
  return out;
};
const resolve = (base, target) => {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
};

export async function extractSheetImages(zip) {
  const wb = await zip.file("xl/workbook.xml")?.async("string");
  const wbRels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!wb || !wbRels) return {};
  const rels = relsOf(wbRels);
  const result = {};

  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], /\bname="([^"]*)"/)?.replace(/&amp;/g, "&");
    const rid = attr(m[0], /\br:id="([^"]+)"/);
    if (!name || !rels[rid]) continue;
    const sheetPath = resolve("xl/workbook.xml", rels[rid].target);
    const sheetRelsPath = sheetPath.replace(/([^/]+)$/, "_rels/$1.rels");
    const sheetRels = await zip.file(sheetRelsPath)?.async("string");
    if (!sheetRels) continue;
    const drawingRel = Object.values(relsOf(sheetRels)).find((r) => r.type.endsWith("/drawing"));
    if (!drawingRel) continue;
    const drawingPath = resolve(sheetPath, drawingRel.target);
    const drawing = await zip.file(drawingPath)?.async("string");
    const drawingRels = await zip.file(drawingPath.replace(/([^/]+)$/, "_rels/$1.rels"))?.async("string");
    if (!drawing || !drawingRels) continue;
    const dRels = relsOf(drawingRels);

    const byRow = {};
    for (const a of drawing.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
      const row = attr(a[0], /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
      const embed = attr(a[0], /r:embed="([^"]+)"/);
      if (row == null || !embed || !dRels[embed]) continue;
      const path = resolve(drawingPath, dRels[embed].target);
      byRow[+row + 1] = { path, ext: (path.split(".").pop() || "png").toLowerCase() };
    }
    if (Object.keys(byRow).length) result[name] = byRow;
  }
  return result;
}

export async function parseClientOrderWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const zip = await JSZip.loadAsync(arrayBuffer);
  const images = await extractSheetImages(zip);

  const sheets = wb.SheetNames.map((name) => {
    const s = parseSheet(wb.Sheets[name], name);
    const imgs = images[name] || {};
    s.lines.forEach((l) => { if (imgs[l.row]) l.image = imgs[l.row]; });
    s.imageCount = s.lines.filter((l) => l.image).length;
    return s;
  });

  const readImage = async (path) => zip.file(path)?.async("blob");
  return { sheets, readImage };
}
