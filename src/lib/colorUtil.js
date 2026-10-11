// Turn whatever the user typed in a "color" field into a swatch colour.
// Accepts: "#C8102E", "rgb(200,16,46)", "200,16,46", CSS names ("pink"), a few Spanish
// names, or free text that contains one of those ("PANTONE 186 C #C8102E").
// Pantone codes alone can't be resolved without a palette: add the hex to see the swatch.

const ES = {
  rojo: "#e11d2e", azul: "#1d4ed8", verde: "#16a34a", amarillo: "#facc15", negro: "#111111", blanco: "#ffffff",
  rosado: "#f9a8d4", rosa: "#f9a8d4", morado: "#7e22ce", violeta: "#7c3aed", naranja: "#f97316", gris: "#9ca3af",
  marron: "#78350f", "marrón": "#78350f", cafe: "#78350f", "café": "#78350f", dorado: "#d4af37", plateado: "#c0c0c0",
  celeste: "#7dd3fc", beige: "#e8d9b5", fucsia: "#d946ef", turquesa: "#14b8a6", crema: "#fff1d0", transparente: null,
};

let ctx;
const cssToHex = (val) => {
  try {
    ctx = ctx || document.createElement("canvas").getContext("2d");
    ctx.fillStyle = "#123456"; ctx.fillStyle = val; const a = ctx.fillStyle;
    ctx.fillStyle = "#654321"; ctx.fillStyle = val; const b = ctx.fillStyle;
    return a === b && a.startsWith("#") ? a : null;
  } catch { return null; }
};

const h2 = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");

export function colorToHex(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const hex = t.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  if (hex) {
    const h = hex[1];
    return "#" + (h.length === 3 ? h.split("").map(c => c + c).join("") : h).toLowerCase();
  }
  const rgb = t.match(/rgb\(?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?/i) || t.match(/^(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})$/);
  if (rgb) return "#" + h2(rgb[1]) + h2(rgb[2]) + h2(rgb[3]);
  const lower = t.toLowerCase();
  if (lower in ES) return ES[lower];
  const first = lower.split(/[\s/,-]+/)[0];
  if (first in ES) return ES[first];
  return cssToHex(lower) || cssToHex(first);
}

// replace the hex inside the text (or append it) when picked from the colour dial
export function withHex(text, hex) {
  const t = String(text || "").trim();
  if (/#([0-9a-f]{6}|[0-9a-f]{3})\b/i.test(t)) return t.replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i, hex.toUpperCase());
  return `${t} ${hex.toUpperCase()}`.trim();
}
