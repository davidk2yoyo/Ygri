// Warranty rules: which rule applies to a claimed product and whether it is still covered.
// Shared by the client portal and the staff screens, so both always show the same verdict.

// Rule kinds: 'months' (covered N months from reception), 'hours' (the client must report within N hours of
// receiving), 'defects' (factory defects only, no fixed term - staff decide).
export const KIND_LABEL = { months: "Meses", hours: "Reporte en horas", defects: "Defectos de fábrica" };

const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const matchesProduct = (rule, name) => {
  if (!rule.product_match) return true;
  const n = norm(name);
  return rule.product_match.split(",").map(norm).filter(Boolean).some(k => n.includes(k));
};
const matchesBrand = (rule, brand) => !rule.brand || norm(rule.brand) === norm(brand);

// The most specific rule wins: brand + product > product > brand > general.
export function resolveRule(rules, { brand, product_name }) {
  let best = null, bestScore = -1;
  for (const r of rules || []) {
    if (!matchesBrand(r, brand) || !matchesProduct(r, product_name)) continue;
    const score = (r.product_match ? 2 : 0) + (r.brand ? 1 : 0);
    if (score > bestScore || (score === bestScore && best && (r.sort_order ?? 0) < (best.sort_order ?? 0))) { best = r; bestScore = score; }
  }
  return best;
}

export function ruleLabel(r) {
  if (!r) return "Sin regla";
  if (r.kind === "months") return r.months === 12 ? "1 año" : r.months === 1 ? "1 mes" : `${r.months} meses`;
  if (r.kind === "hours") return `Reporte en ${r.report_hours} h`;
  return "Defectos de fábrica";
}

const toDate = (d) => { if (!d) return null; const x = new Date(`${String(d).slice(0, 10)}T00:00:00`); return isNaN(x) ? null : x; };
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const DAY = 86400000;

// → { state: 'in' | 'out' | 'defects' | 'unknown', label, until (Date|null), rule, note }
export function evaluateItem(item, rules, today = new Date()) {
  const rule = resolveRule(rules, item);
  if (!rule) return { state: "unknown", label: "Sin regla de garantía", rule: null, until: null, note: "No hay una regla para esta marca/producto." };
  const rec = toDate(item.received_at);
  const claimDay = toDate(item.complaint_date) || new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const label = ruleLabel(rule);
  const labelNote = rule.requires_label ? "Es obligatoria la etiqueta de la prenda." : null;

  if (rule.kind === "defects") return { state: "defects", label, rule, until: null, note: ["Aplica solo por defecto de fábrica.", labelNote].filter(Boolean).join(" ") };
  if (!rec) return { state: "unknown", label, rule, until: null, note: "Falta la fecha de recepción para calcular el plazo." };

  if (rule.kind === "hours") {
    const until = new Date(rec.getTime() + Math.max(1, Math.ceil((rule.report_hours || 0) / 24)) * DAY);
    const ok = claimDay <= until;
    return { state: ok ? "in" : "out", label, rule, until, note: ok ? "Reportado dentro del plazo." : `El reporte debía hacerse dentro de ${rule.report_hours} h de recibir el pedido.` };
  }
  const until = addMonths(rec, rule.months || 0);
  const ok = claimDay <= until;
  return { state: ok ? "in" : "out", label, rule, until, note: ok ? null : "El plazo de garantía ya venció." };
}

export const STATE_STYLE = {
  in:      { text: "En garantía",       cls: "bg-green-100 text-green-700" },
  out:     { text: "Fuera de garantía", cls: "bg-red-100 text-red-700" },
  defects: { text: "Defecto de fábrica", cls: "bg-blue-100 text-blue-700" },
  unknown: { text: "Por revisar",       cls: "bg-amber-100 text-amber-700" },
};

export const CLAIM_STATUS = {
  open:          { label: "Recibido",              cls: "bg-blue-100 text-blue-700" },
  sent_supplier: { label: "Enviado al proveedor",  cls: "bg-violet-100 text-violet-700" },
  answered:      { label: "Proveedor respondió",   cls: "bg-amber-100 text-amber-700" },
  resolved:      { label: "Resuelto",              cls: "bg-green-100 text-green-700" },
  rejected:      { label: "Rechazado",             cls: "bg-red-100 text-red-700" },
};
export const RESOLUTION_LABEL = { replace: "Reposición", credit: "Nota de crédito", repair: "Reparación", rejected: "Rechazado" };

export const fmtDay = (d) => d ? new Date(d instanceof Date ? d : `${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ── Preset: "Tiempos de garantía por marca" (MAN-GRT-001 v2, 01/03/2025) ──────────────────────────
const brands = (kind, names, extra = {}) => names.map(brand => ({ brand, kind, ...extra }));
export const WARRANTY_PRESET = [
  // Generalidades (any brand) – the most specific keyword wins
  { product_match: "interactivo", kind: "months", months: 12, notes: "Juguetes interactivos" },
  { product_match: "bateria,pila", kind: "months", months: 12, notes: "Juguetes con batería (pilas)" },
  { product_match: "torso silicona liquida", kind: "months", months: 12, notes: "Torsos de silicona líquida" },
  { product_match: "tpr", kind: "months", months: 3, notes: "Torsos de TPR" },
  { product_match: "desechable,funda,anillo", kind: "months", months: 1, notes: "Juguetes de un solo uso (anillos, fundas)" },
  { product_match: "suplemento,comestible,cosmetic,condon,bienestar sexual", kind: "hours", report_hours: 48, notes: "Alteraciones de olor, sabor o color: reportar dentro de 48 h de recibir" },
  { product_match: "maltratad", kind: "hours", report_hours: 48, notes: "Mercancía maltratada: reportar dentro de 48 h de recibir" },
  { product_match: "lenceria", kind: "defects", requires_label: true, notes: "Lencería por defecto de fábrica; la etiqueta es obligatoria" },
  // 1 año
  ...brands("months", ["ADRIEN LASTIC", "AIXIASIA", "ALIVE", "AMAKII", "AMZING TOYS", "APHRODISIA", "BESEXY", "BIG TEAZETOYS", "BLACK POWER", "CHISA",
    "DIBE", "ELFO", "F*CKING MACHINE", "FEELZ TOYS", "FEMINTIMATE", "FUN TOWN", "FUNNY STEEL", "GUIA CEREZA", "KIIRO", "KISSME LOVE", "LELO", "LOVENSE",
    "LOVESEXME", "LOVETOY", "LOVINGWORLD", "LUV PUMP", "MAGIC MOTION", "MAGIC SEX", "MONSTER PUB", "PORNHUB", "REALOV", "RIANNES", "ROMP", "SATISFYER",
    "SECRET PLAY", "SENSUAL DEZIRE", "SEX GLASS", "S-HANDE", "SILEXD", "SVAKOM", "SWEET SECRET", "WE VIBE", "WOMANIZER", "ZALO"], { months: 12 }),
  // 6 meses
  { brand: "SLUT", kind: "months", months: 6, notes: "Bondage" },
  // 3 meses (juegos de mesa)
  ...brands("months", ["ACTIVEX GAMES", "EROTIC GAMES", "TEASE & PLEASE", "PLACER Y PIEL"], { months: 3, notes: "Juegos de mesa" }),
  // 1 mes
  { brand: "BLACK POWER", product_match: "funda,anillo", kind: "months", months: 1, notes: "Fundas y anillos" },
  { brand: "CHISA", product_match: "anillo", kind: "months", months: 1, notes: "Anillo vibrador" },
  { brand: "SEN INTIMO", product_match: "anillo", kind: "months", months: 1, notes: "Anillo vibrador" },
  // Solo defectos de fábrica
  ...brands("defects", ["CEREZA LINGERIE", "CRUISING", "DMK", "DNGEON", "FENBAO", "HENTAI FANTASY", "MALE+BASIC", "MOB ERoticWear", "POCKET PLEASURE", "SEN INTIMO",
    "SENSUAL LOVE", "MAXIFEMDX", "X BULL", "UNIQ", "GUMMIES VIKING", "VITALIS", "FEMME BASICS", "PODER MAX", "REVITEX", "MAPALE", "MYSIZE", "SENS", "POWESEX", "Q VOLTA G"]),
];
