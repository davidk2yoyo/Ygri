import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType,
  UnderlineType, ExternalHyperlink,
} from "docx";

// ── Constants ─────────────────────────────────────────────────────────────────
const FONT       = "Arial";
const BRAND      = "1e3a5f";
const ACCENT     = "2563eb";
const GRAY_MED   = "6b7280";
const GRAY_LIGHT = "f8fafc";
const WHITE      = "FFFFFF";

// A4 content width at 96 dpi with 25mm left+right margins → ~590px
const CONTENT_W  = 590;
const GALLERY_3  = 183; // 3-col gallery image width in px
const GALLERY_2  = 280; // 2-col
const DEFECT_PH  = 85;  // defect photo thumbnail

// ── Unit helpers ──────────────────────────────────────────────────────────────
// spacing/margins in docx use "twips" (1/20 pt). 1mm ≈ 56.69 twips.
const mm   = (n) => Math.round(n * 56.6929);
// font size in half-points (1pt = 2 half-points)
const hp   = (pt) => pt * 2;

// ── Border presets ────────────────────────────────────────────────────────────
const THIN  = { style: BorderStyle.SINGLE, size: 1, color: "e2e8f0" };
const NIL   = { style: BorderStyle.NIL };
const NIL_BORDERS = { top: NIL, bottom: NIL, left: NIL, right: NIL, insideH: NIL, insideV: NIL };
const THIN_BORDERS = {
  top: THIN, bottom: THIN, left: THIN, right: THIN, insideH: THIN, insideV: THIN,
};

// ── Text run helper ───────────────────────────────────────────────────────────
const run = (text, opts = {}) =>
  new TextRun({ text: text || "", font: FONT, size: hp(10), color: "374151", ...opts });

const spacer = (mmAmt = 4) =>
  new Paragraph({ children: [run("")], spacing: { after: mm(mmAmt) } });

// ── Section heading ───────────────────────────────────────────────────────────
const heading = (text) =>
  new Paragraph({
    children: [run((text || "").toUpperCase(), { size: hp(9), bold: true, color: BRAND, characterSpacing: 80 })],
    spacing: { before: mm(5), after: mm(2.5) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND } },
  });

// ── Image fetching ─────────────────────────────────────────────────────────────
async function fetchImg(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const buf  = await blob.arrayBuffer();
    const bmp  = await createImageBitmap(blob);
    const { width, height } = bmp;
    bmp.close();
    return { data: buf, ow: width, oh: height };
  } catch { return null; }
}

// Scale to maxW while keeping aspect ratio
function scaleTo(ow, oh, maxW) {
  if (!ow || !oh) return { w: maxW, h: Math.round(maxW * 0.6) };
  if (ow <= maxW)  return { w: ow, h: oh };
  return { w: maxW, h: Math.round(oh * (maxW / ow)) };
}

// ── HTML → docx paragraph converter ──────────────────────────────────────────
// Walks Tiptap HTML and produces Paragraph[] with TextRuns.
function htmlToParas(html) {
  if (!html || html === "<p></p>") return [spacer(2)];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paras = [];

  function nodeRuns(node, fmt = {}) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      return text ? [run(text, fmt)] : [];
    }
    if (node.nodeType !== 1) return [];
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return [new TextRun({ break: 1 })];

    const f = { ...fmt };
    if (tag === "strong" || tag === "b") f.bold = true;
    if (tag === "em"     || tag === "i") f.italics = true;
    if (tag === "u") f.underline = { type: UnderlineType.SINGLE };
    if (tag === "s") f.strike = true;
    if (tag === "span") {
      const color = node.style?.color;
      if (color) {
        const hex = rgbToHex(color);
        if (hex) f.color = hex;
      }
    }

    const kids = Array.from(node.childNodes).flatMap(c => nodeRuns(c, f));

    if (tag === "a") {
      const href = node.getAttribute("href");
      if (href) {
        return [new ExternalHyperlink({
          link: href,
          children: [run(node.textContent, { color: ACCENT, underline: { type: UnderlineType.SINGLE } })],
        })];
      }
    }
    return kids;
  }

  function processEl(el) {
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;

    if (tag === "p" || tag === "div") {
      const runs = Array.from(el.childNodes).flatMap(c => nodeRuns(c));
      paras.push(new Paragraph({ children: runs.length ? runs : [run("")], spacing: { after: mm(2) } }));
    } else if (tag === "h3") {
      paras.push(new Paragraph({
        children: [run(el.textContent, { size: hp(12), bold: true, color: "111827" })],
        spacing: { before: mm(3), after: mm(2) },
      }));
    } else if (tag === "ul") {
      Array.from(el.querySelectorAll(":scope > li")).forEach(li => {
        const kids = Array.from(li.childNodes).flatMap(c => nodeRuns(c));
        paras.push(new Paragraph({
          children: [run("• ", { bold: true, color: BRAND }), ...kids],
          spacing: { after: mm(1.5) },
          indent: { left: mm(5) },
        }));
      });
    } else if (tag === "ol") {
      Array.from(el.querySelectorAll(":scope > li")).forEach((li, i) => {
        const kids = Array.from(li.childNodes).flatMap(c => nodeRuns(c));
        paras.push(new Paragraph({
          children: [run(`${i + 1}. `, { bold: true, color: BRAND }), ...kids],
          spacing: { after: mm(1.5) },
          indent: { left: mm(5) },
        }));
      });
    }
  }

  Array.from(doc.body.childNodes).forEach(n => { if (n.nodeType === 1) processEl(n); });
  return paras.length ? paras : [spacer(2)];
}

function rgbToHex(color) {
  if (!color) return null;
  if (color.startsWith("#")) return color.replace("#", "");
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) return [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
  return null;
}

// ── Shared table helpers ──────────────────────────────────────────────────────
const hdrCell = (text, widthPct) => new TableCell({
  width: { size: widthPct, type: WidthType.PERCENTAGE },
  shading: { type: ShadingType.CLEAR, fill: BRAND },
  children: [new Paragraph({ children: [run(text.toUpperCase(), { size: hp(8), bold: true, color: WHITE })], spacing: { after: 0 } })],
});

const hdrCellCenter = (text, widthPct) => new TableCell({
  width: { size: widthPct, type: WidthType.PERCENTAGE },
  shading: { type: ShadingType.CLEAR, fill: BRAND },
  children: [new Paragraph({ children: [run(text.toUpperCase(), { size: hp(8), bold: true, color: WHITE })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })],
});

const bodyCell = (text, opts = {}) => new TableCell({
  shading: { type: ShadingType.CLEAR, fill: opts.bg || WHITE },
  width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  children: [new Paragraph({
    children: [run(text || "", { ...opts.runOpts })],
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { after: 0 },
  })],
});

// ── Block renderers ───────────────────────────────────────────────────────────

function renderHeader(report, logoImg) {
  const children = [];

  if (logoImg) {
    const { w, h } = scaleTo(logoImg.ow, logoImg.oh, 110);
    children.push(new Paragraph({
      children: [new ImageRun({ data: logoImg.data, transformation: { width: w, height: h } })],
      alignment: AlignmentType.RIGHT,
      spacing: { after: mm(1) },
    }));
  }

  children.push(new Paragraph({
    children: [
      run("INTERASIA SAS (HK) TRADE COMPANY", { size: hp(9), bold: true, color: BRAND }),
      run("  ·  Tel: +86 (21) 52997308  ·  www.interasia.com.co", { size: hp(8), color: GRAY_MED }),
    ],
    alignment: AlignmentType.RIGHT,
    spacing: { after: mm(2) },
  }));

  // Blue divider line
  children.push(new Paragraph({
    children: [run("")],
    spacing: { after: mm(4) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: BRAND } },
  }));

  // Report label
  children.push(new Paragraph({
    children: [
      run("INSPECTION REPORT  ·  ", { size: hp(8), color: GRAY_MED }),
      run(report.report_number || "", { size: hp(8), bold: true, color: BRAND }),
    ],
    spacing: { after: mm(1) },
  }));

  // Title
  children.push(new Paragraph({
    children: [run(report.title || report.report_number || "", { size: hp(20), bold: true, color: BRAND })],
    spacing: { after: mm(2) },
  }));

  // Status
  const STATUS_LABELS = {
    draft: "Draft", approved: "Approved",
    approved_with_observations: "Approved with Observations", rejected: "Rejected",
  };
  const STATUS_COLORS = {
    draft: GRAY_MED, approved: "15803d",
    approved_with_observations: "d97706", rejected: "b91c1c",
  };
  const statusLabel = STATUS_LABELS[report.status] || report.status || "";
  if (statusLabel) {
    children.push(new Paragraph({
      children: [run(`● ${statusLabel.toUpperCase()}`, { size: hp(9), bold: true, color: STATUS_COLORS[report.status] || GRAY_MED })],
      spacing: { after: mm(7) },
    }));
  }

  return children;
}

function renderCover(content) {
  const rows = [
    ["Project",          content.project_name,    "Report Type",  content.report_type],
    ["Inspector",        content.inspector_name,   "Visit Date",   content.visit_date],
    ["Client",           content.client_name,      "Supplier",     content.supplier_name],
    ["Supplier Address", content.supplier_address, "Country",      content.country],
    ["PO Number",        content.po_number,        "",             ""],
  ].filter(([, v1, , v2]) => v1 || v2);

  return [
    heading("Cover Information"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: THIN_BORDERS,
      rows: rows.map((row) => new TableRow({
        children: [0, 2].flatMap(ci => [
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "f1f5f9" },
            children: [new Paragraph({ children: [run(row[ci], { size: hp(8), bold: true, color: GRAY_MED })], spacing: { after: 0 } })],
          }),
          new TableCell({
            width: { size: 36, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [run(row[ci + 1] || "", { bold: true, color: "111827" })], spacing: { after: 0 } })],
          }),
        ]),
      })),
    }),
    spacer(7),
  ];
}

function renderText(content) {
  return [
    ...(content.title ? [heading(content.title)] : []),
    ...htmlToParas(content.content || ""),
    spacer(5),
  ];
}

function renderImage(content, imgData) {
  if (!imgData) return [];
  const { w, h } = scaleTo(imgData.ow, imgData.oh, CONTENT_W);
  return [
    new Paragraph({
      children: [new ImageRun({ data: imgData.data, transformation: { width: w, height: h } })],
      alignment: AlignmentType.CENTER,
      spacing: { after: mm(2) },
    }),
    ...(content.caption ? [new Paragraph({
      children: [run(content.caption, { size: hp(8.5), color: GRAY_MED, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: mm(5) },
    })] : [spacer(5)]),
  ];
}

function renderGallery(content, imgMap) {
  const images = (content.images || []).filter(img => img.url);
  if (!images.length) return [];

  const children = content.title ? [heading(content.title)] : [];
  const cols = 3;
  const imgW = GALLERY_3;

  for (let i = 0; i < images.length; i += cols) {
    const rowImgs = images.slice(i, i + cols);
    const cells = rowImgs.map(img => {
      const d = imgMap[img.url];
      const cellChildren = [];
      if (d) {
        const { w, h } = scaleTo(d.ow, d.oh, imgW);
        cellChildren.push(new Paragraph({ children: [new ImageRun({ data: d.data, transformation: { width: w, height: h } })], spacing: { after: mm(1) } }));
      }
      if (img.caption) {
        cellChildren.push(new Paragraph({ children: [run(img.caption, { size: hp(8), color: GRAY_MED })], spacing: { after: mm(2) } }));
      }
      if (!cellChildren.length) cellChildren.push(spacer(2));
      return new TableCell({ borders: NIL_BORDERS, children: cellChildren });
    });

    // Pad to full row
    while (cells.length < cols) {
      cells.push(new TableCell({ borders: NIL_BORDERS, children: [spacer(2)] }));
    }

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NIL_BORDERS,
      rows: [new TableRow({ children: cells })],
    }));
  }

  children.push(spacer(6));
  return children;
}

function renderChecklist(content) {
  const items = (content.items || []).filter(i => i.label);
  const STATUS_ICON  = { ok: "✓", fail: "✗", na: "—" };
  const STATUS_COLOR = { ok: "15803d", fail: "b91c1c", na: GRAY_MED };

  return [
    heading(content.title || "Checklist"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: THIN_BORDERS,
      rows: [
        new TableRow({ tableHeader: true, children: [hdrCell("Item", 55), hdrCellCenter("Status", 13), hdrCell("Comment", 32)] }),
        ...items.map((item, i) => {
          const bg = i % 2 === 0 ? WHITE : GRAY_LIGHT;
          return new TableRow({ children: [
            bodyCell(item.label, { bg }),
            new TableCell({
              width: { size: 13, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: bg },
              children: [new Paragraph({
                children: [run(STATUS_ICON[item.status] || item.status, { bold: true, color: STATUS_COLOR[item.status] || GRAY_MED })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
              })],
            }),
            bodyCell(item.comment || "", { bg, runOpts: { color: GRAY_MED } }),
          ]});
        }),
      ],
    }),
    spacer(7),
  ];
}

function renderTable(content) {
  const headers = content.headers || [];
  const rows    = content.rows    || [];
  if (!headers.length && !rows.length) return [];
  const colPct = headers.length ? Math.floor(100 / headers.length) : 25;

  return [
    ...(content.title ? [heading(content.title)] : []),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: THIN_BORDERS,
      rows: [
        new TableRow({
          tableHeader: true,
          children: headers.map(h => hdrCell(h, colPct)),
        }),
        ...rows.map((row, i) => new TableRow({
          children: (Array.isArray(row) ? row : []).map((cell, j) =>
            bodyCell(cell || "", { bg: i % 2 === 0 ? WHITE : GRAY_LIGHT, width: colPct })
          ),
        })),
      ],
    }),
    spacer(7),
  ];
}

const COND_LABEL = {
  good: "Good", regular: "Regular", defects: "Defects Found", not_suitable: "Not Suitable",
};
const COND_COLOR = {
  good: "15803d", regular: "d97706", defects: "b91c1c", not_suitable: "7c3aed",
};

function renderDefects(content, imgMap) {
  const items = (content.items || []).filter(d => d.item_name || d.comment);
  if (!items.length) return [];

  const hasPhotos = items.some(d => d.photo_url && imgMap[d.photo_url]);
  const photoPct  = 12;

  const hdrCells = [
    ...(hasPhotos ? [hdrCell("Photo", photoPct)] : []),
    hdrCell("Item",      hasPhotos ? 26 : 30),
    hdrCell("Condition", 17),
    hdrCellCenter("Qty", 9),
    hdrCell("Comment",   hasPhotos ? 36 : 44),
  ];

  const tableRows = [new TableRow({ tableHeader: true, children: hdrCells })];

  items.forEach((d, i) => {
    const condKey   = d.condition || d.severity || "good";
    const condLabel = COND_LABEL[condKey] || condKey;
    const condColor = COND_COLOR[condKey] || GRAY_MED;
    const bg        = i % 2 === 0 ? WHITE : GRAY_LIGHT;

    const cells = [];

    if (hasPhotos) {
      const imgD = d.photo_url ? imgMap[d.photo_url] : null;
      if (imgD) {
        const { w, h } = scaleTo(imgD.ow, imgD.oh, DEFECT_PH);
        cells.push(new TableCell({
          width: { size: photoPct, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: bg },
          children: [new Paragraph({ children: [new ImageRun({ data: imgD.data, transformation: { width: w, height: h } })], spacing: { after: 0 } })],
        }));
      } else {
        cells.push(new TableCell({
          width: { size: photoPct, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: bg },
          children: [spacer(1)],
        }));
      }
    }

    cells.push(
      bodyCell(d.item_name || d.type || "", { bg, width: hasPhotos ? 26 : 30, runOpts: { bold: true } }),
      bodyCell(condLabel, { bg, width: 17, runOpts: { bold: true, color: condColor } }),
      new TableCell({
        width: { size: 9, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: bg },
        children: [new Paragraph({ children: [run(String(d.qty_inspected || ""))], alignment: AlignmentType.CENTER, spacing: { after: 0 } })],
      }),
      bodyCell(d.comment || "", { bg, width: hasPhotos ? 36 : 44, runOpts: { color: GRAY_MED } }),
    );

    tableRows.push(new TableRow({ children: cells }));
  });

  return [
    heading(content.title || "Defects Log"),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: THIN_BORDERS, rows: tableRows }),
    spacer(7),
  ];
}

function renderScoring(content) {
  const cats   = content.categories || [];
  const scored = cats.filter(c => c.score !== null && c.score !== undefined && c.score !== "");
  const avg    = scored.length
    ? (scored.reduce((s, c) => s + Number(c.score), 0) / scored.length).toFixed(1)
    : null;

  return [
    heading(content.title || "Quality Scoring"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: THIN_BORDERS,
      rows: [
        new TableRow({ tableHeader: true, children: [hdrCell("Category", 55), hdrCellCenter("Score /10", 12), hdrCell("Notes", 33)] }),
        ...cats.map((cat, i) => {
          const bg = i % 2 === 0 ? WHITE : GRAY_LIGHT;
          return new TableRow({ children: [
            bodyCell(cat.label, { bg }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: bg },
              children: [new Paragraph({ children: [run(cat.score !== null && cat.score !== "" ? String(cat.score) : "—", { bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })],
            }),
            bodyCell(cat.notes || "", { bg, runOpts: { color: GRAY_MED } }),
          ]});
        }),
        ...(avg !== null ? [new TableRow({ children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BRAND }, children: [new Paragraph({ children: [run("OVERALL AVERAGE", { bold: true, color: WHITE, size: hp(9) })], spacing: { after: 0 } })] }),
          new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BRAND }, children: [new Paragraph({ children: [run(avg, { bold: true, color: WHITE, size: hp(12) })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })] }),
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BRAND }, children: [spacer(1)] }),
        ]})] : []),
      ],
    }),
    spacer(7),
  ];
}

const CL = {
  en: { title: "Conclusion", summary: "Summary", positives: "Key Positives", risks: "Risks & Issues", recommendations: "Recommendations", action: "Action" },
  es: { title: "Conclusión", summary: "Resumen", positives: "Aspectos Positivos", risks: "Riesgos", recommendations: "Recomendaciones", action: "Acción" },
};
const AL = {
  en: { proceed: "Proceed", proceed_observations: "Proceed with Observations", hold: "On Hold", reject: "Rejected" },
  es: { proceed: "Proceder", proceed_observations: "Proceder con Observaciones", hold: "En Espera", reject: "Rechazado" },
};
const ACTION_COLORS = { proceed: "15803d", proceed_observations: "d97706", hold: GRAY_MED, reject: "b91c1c" };

function renderConclusion(content, language = "en") {
  const cl = CL[language] || CL.en;
  const al = AL[language] || AL.en;
  const sections = [
    ["summary",         cl.summary],
    ["positives",       cl.positives],
    ["risks",           cl.risks],
    ["recommendations", cl.recommendations],
  ].filter(([key]) => content[key]);

  const children = [heading(cl.title)];

  for (const [key, label] of sections) {
    children.push(
      new Paragraph({ children: [run(label.toUpperCase(), { size: hp(8), bold: true, color: GRAY_MED })], spacing: { before: mm(3), after: mm(1) } }),
      ...htmlToParas(content[key] || ""),
    );
  }

  const actionLabel = al[content.action] || content.action || "";
  if (actionLabel) {
    children.push(
      spacer(2),
      new Paragraph({
        children: [
          run(`${cl.action.toUpperCase()}: `, { size: hp(9), bold: true, color: GRAY_MED }),
          run(`  ${actionLabel.toUpperCase()}  `, { size: hp(9), bold: true, color: ACTION_COLORS[content.action] || GRAY_MED }),
        ],
      }),
    );
  }

  children.push(spacer(7));
  return children;
}

function renderDiagram(content) {
  return [
    ...(content.title ? [heading(content.title)] : []),
    new Paragraph({
      children: [run("[ Diagram — available in the online version of this report ]", { color: GRAY_MED, italics: true })],
      spacing: { after: mm(7) },
    }),
  ];
}

function renderVideo(content) {
  return [
    new Paragraph({
      children: [
        run("▶ Video", { bold: true, color: BRAND }),
        ...(content.caption ? [run(` — ${content.caption}`, { color: GRAY_MED })] : []),
        run("  "),
        new ExternalHyperlink({ link: content.url, children: [run(content.url, { color: ACCENT, underline: { type: UnderlineType.SINGLE } })] }),
      ],
      spacing: { after: mm(6) },
    }),
  ];
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function buildDocx({ report, blocks }) {
  const language = report.language || "en";

  // Collect all image URLs
  const logoUrl = `${window.location.origin}/images/interasia-logo.png`;
  const urls = new Set([logoUrl]);
  blocks.forEach(b => {
    const c = b.content || {};
    if (b.type === "image"   && c.url)      urls.add(c.url);
    if (b.type === "gallery") (c.images || []).forEach(img => { if (img.url) urls.add(img.url); });
    if (b.type === "defects") (c.items  || []).forEach(d   => { if (d.photo_url) urls.add(d.photo_url); });
  });

  // Fetch all images in parallel
  const imgMap = {};
  await Promise.all([...urls].map(async url => {
    const img = await fetchImg(url);
    if (img) imgMap[url] = img;
  }));

  // Build document children
  const children = [...renderHeader(report, imgMap[logoUrl])];

  for (const block of blocks) {
    const c = block.content || {};
    switch (block.type) {
      case "cover":      children.push(...renderCover(c));                         break;
      case "text":       children.push(...renderText(c));                          break;
      case "image":      children.push(...renderImage(c, imgMap[c.url]));          break;
      case "gallery":    children.push(...renderGallery(c, imgMap));               break;
      case "checklist":  children.push(...renderChecklist(c));                     break;
      case "table":      children.push(...renderTable(c));                         break;
      case "defects":    children.push(...renderDefects(c, imgMap));               break;
      case "scoring":    children.push(...renderScoring(c));                       break;
      case "conclusion": children.push(...renderConclusion(c, language));          break;
      case "diagram":    children.push(...renderDiagram(c));                       break;
      case "video":      if (c.url) children.push(...renderVideo(c));              break;
    }
  }

  return new Document({
    creator: "Ygri CRM — Interasia",
    description: `Inspection Report ${report.report_number}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: hp(10), color: "374151" } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: mm(20), bottom: mm(20), left: mm(25), right: mm(25) },
        },
      },
      children,
    }],
  });
}
