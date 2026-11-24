// Supplier profile ("hoja de vida"): the sections staff fill in and choose, per client, what to show.
export const PROFILE_SECTIONS = [
  { key: "proveedor",     label: "Proveedor",       icon: "🏭", hint: "Quiénes son: historia, productos principales, capacidad, contactos que quieras mostrar" },
  { key: "cumplimiento",  label: "Cumplimiento",    icon: "✅", hint: "Certificaciones, auditorías, normas que cumple (ISO, BSCI, CE, RoHS…)" },
  { key: "empaques",      label: "Empaques",        icon: "📦", hint: "Cómo empaca: caja individual, master, cartones, protecciones" },
  { key: "etiquetado",    label: "Etiquetado",      icon: "🏷️", hint: "Etiquetas, códigos de barras, marcación y requisitos de etiquetado" },
  { key: "garantias",     label: "Garantías",       icon: "🛡️", hint: "Política de garantía del proveedor: plazos, qué cubre, cómo reclamar" },
  { key: "produccion",    label: "Producción",      icon: "⚙️", hint: "Capacidad, tiempos de producción, MOQ, fábricas" },
  { key: "calificacion",  label: "Calificación",    icon: "⭐", hint: "Nota de 1 a 5 por criterio y comentarios" },
  { key: "factura",       label: "Factura / sin factura", icon: "🧾", hint: "Si emite factura, sin factura o ambos, y sus condiciones" },
  { key: "lista_precios", label: "Lista de precios", icon: "💲", hint: "Listas de precios (solo la ven los usuarios con permiso de precios)" },
];
export const SECTION_BY_KEY = Object.fromEntries(PROFILE_SECTIONS.map(s => [s.key, s]));

export const RATING_CRITERIA = [
  { key: "quality", label: "Calidad" },
  { key: "delivery", label: "Cumplimiento de entregas" },
  { key: "communication", label: "Comunicación" },
  { key: "compliance", label: "Cumplimiento / documentación" },
];

export const INVOICING = {
  factura: "Emite factura",
  no_factura: "No emite factura",
  ambos: "Factura o sin factura (según el pedido)",
};

export const overallRating = (data) => {
  const v = RATING_CRITERIA.map(c => Number(data?.[c.key])).filter(n => n > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export const stars = (n) => n == null ? "" : "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

// Has the staff written anything in this section?
export const sectionFilled = (row) => !!(row && ((row.body || "").trim() || (row.files || []).length ||
  Object.values(row.data || {}).some(v => v)));
