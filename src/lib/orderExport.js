import { colorToHex } from "./colorUtil";
import { lineLabel } from "./orderDiff";

export function orderTotals(lines) {
  let units = 0, value = 0, priced = 0;
  for (const l of lines) {
    const q = Number(l.qty) || 0, p = Number(l.price) || 0;
    units += q;
    if (p > 0) { value += q * p; priced++; }
  }
  return { count: lines.length, units, value, priced };
}

const slug = (s) => String(s || "pedido").replace(/[^\w-]+/g, "_").slice(0, 60);
const num = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function exportOrderExcel({ title, client, lines }) {
  const XLSX = await import("xlsx");
  const t = orderTotals(lines);
  const head = ["#", "Proveedor", "Ref. proveedor", "Nombre", "Color", "Cantidad", "Precio obj.", "Total", "Ref. cliente", "Marca", "Marcación", "Empaque", "Notas"];
  const rows = lines.map((l, i) => [
    i + 1, l.supplier, l.supplier_ref, lineLabel(l) === "(sin nombre)" ? "" : l.name, l.color, Number(l.qty) || 0,
    l.price === "" || l.price == null ? "" : Number(l.price), l.price ? (Number(l.qty) || 0) * Number(l.price) : "",
    l.client_ref, l.brand, l.marking === true ? "SI" : l.marking === false ? "NO" : "", l.packaging, l.notes,
  ]);
  const aoa = [[title || "Pedido"], [client || ""], [], head, ...rows, [], ["", "", "", "TOTAL", "", t.units, "", t.priced ? t.value : ""]];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [5, 18, 16, 36, 18, 10, 12, 12, 16, 16, 11, 18, 34].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `${slug(title)}.xlsx`);
}

const toDataUrl = async (url) => {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch { return null; }
};

export async function exportOrderPdf({ title, client, lines }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 10;
  const t = orderTotals(lines);

  // thumbnails first (a failed image just leaves the cell empty)
  const imgs = {};
  let i = 0;
  const pending = lines.filter(l => l.photo_url);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < pending.length) { const l = pending[i++]; imgs[l._key || l.id] = await toDataUrl(l.photo_url); }
  }));

  const cols = [
    { k: "photo", label: "", w: 16 }, { k: "ref", label: "Ref. prov.", w: 26 }, { k: "name", label: "Producto", w: 62 },
    { k: "qty", label: "Cant.", w: 16, right: true }, { k: "price", label: "Precio", w: 18, right: true }, { k: "total", label: "Total", w: 20, right: true },
    { k: "cref", label: "Ref. cliente", w: 26 }, { k: "mk", label: "Marc.", w: 12 }, { k: "pack", label: "Empaque", w: 28 }, { k: "notes", label: "Notas", w: 53 },
  ];
  let y = M;
  const header = (first) => {
    if (first) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(title || "Pedido", M, y + 5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
      doc.text(`${client || ""}   ·   ${new Date().toLocaleDateString("es-CO")}   ·   ${t.count} productos · ${t.units.toLocaleString()} unidades`, M, y + 11);
      doc.setTextColor(0); y += 17;
    }
    doc.setFillColor(243, 244, 246); doc.rect(M, y, W - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    let x = M;
    cols.forEach(c => { doc.text(c.label, c.right ? x + c.w - 1.5 : x + 1.5, y + 4.7, { align: c.right ? "right" : "left" }); x += c.w; });
    y += 7; doc.setFont("helvetica", "normal");
  };
  header(true);

  for (const l of lines) {
    const img = imgs[l._key || l.id];
    const cells = {
      ref: l.supplier_ref || "", name: [lineLabel(l) === "(sin nombre)" ? "" : l.name, l.color ? `Color: ${l.color}` : "", l.supplier ? l.supplier : ""].filter(Boolean).join("\n"),
      qty: String(Number(l.qty) || 0), price: l.price ? num(l.price) : "", total: l.price ? num((Number(l.qty) || 0) * Number(l.price)) : "",
      cref: l.client_ref || "", mk: l.marking === true ? "SI" : l.marking === false ? "NO" : "", pack: l.packaging || "", notes: l.notes || "",
    };
    doc.setFontSize(8);
    const wrapped = {};
    let lineCount = 1;
    for (const c of cols) {
      if (c.k === "photo") continue;
      wrapped[c.k] = doc.splitTextToSize(cells[c.k] || "", c.w - 3).slice(0, 4);
      lineCount = Math.max(lineCount, wrapped[c.k].length);
    }
    const rh = Math.max(img ? 15 : 0, lineCount * 3.6 + 3);
    if (y + rh > H - M - 12) { doc.addPage(); y = M; header(false); doc.setFontSize(8); }
    let x = M;
    for (const c of cols) {
      if (c.k === "photo") {
        if (img) { try { doc.addImage(img, img.startsWith("data:image/png") ? "PNG" : "JPEG", x + 1, y + 1, 13, 13); } catch { /* skip unreadable image */ } }
      } else {
        wrapped[c.k].forEach((txt, n) => doc.text(txt, c.right ? x + c.w - 1.5 : x + 1.5, y + 4 + n * 3.6, { align: c.right ? "right" : "left" }));
      }
      x += c.w;
    }
    const hex = colorToHex(l.color);
    if (hex) { doc.setFillColor(hex); doc.setDrawColor(180); doc.circle(M + cols[0].w + cols[1].w + cols[2].w - 3, y + 4.5, 1.6, "FD"); }
    doc.setDrawColor(229, 231, 235); doc.line(M, y + rh, W - M, y + rh);
    y += rh;
  }

  if (y + 12 > H - M) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text(`TOTAL: ${t.units.toLocaleString()} unidades`, M + 16 + 26 + 62 + 16, y + 8, { align: "right" });
  if (t.priced) doc.text(`Valor objetivo: ${num(t.value)}`, W - M - 1.5, y + 8, { align: "right" });
  doc.save(`${slug(title)}.pdf`);
}
