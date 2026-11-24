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
  { key: "quality", label: "Calidad del producto" },
  { key: "delivery", label: "Cumplimiento de entregas" },
  { key: "communication", label: "Comunicación" },
  { key: "compliance", label: "Cumplimiento / documentación" },
  { key: "price", label: "Precio / competitividad" },
  { key: "packaging", label: "Empaque y etiquetado" },
  { key: "aftersales", label: "Postventa / garantías" },
  { key: "flexibility", label: "Flexibilidad (cambios, muestras)" },
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
  Object.values(row.data || {}).some(v => hasValue(v))));


// ── Structured fields per section ────────────────────────────────────────────
// Types: text, textarea, number, date, yesno, select(options), checks(options), stars(RATING_CRITERIA), table(columns).
// Values live in supplier_profile_sections.data (jsonb): text/number/date → string, yesno → "yes"|"no",
// checks → array, table → array of row objects. The free "Details" text and the files stay on every section.
const YN = { type: "yesno" };
const CERTS = ["ISO 9001", "ISO 14001", "ISO 45001", "BSCI", "SEDEX / SMETA", "WRAP", "CE", "RoHS", "REACH", "FCC", "UL", "FDA", "LFGB", "FSC", "GRS", "OEKO-TEX", "GMP", "HACCP"];
const PACK_TYPES = ["Bolsa plástica (poly bag)", "Caja de cartón individual", "Caja de color (retail)", "Blíster", "Shrink / termoencogible", "Burbuja / espuma", "Sin empaque individual"];
const PAYMENT_TERMS = ["100% anticipado", "30% anticipo / 70% antes de embarcar", "30% anticipo / 70% contra BL", "50% / 50%", "L/C", "Crédito 30 días", "Crédito 60 días", "Otro"];

export const SECTION_FIELDS = {
  proveedor: [
    { title: "Empresa", fields: [
      { key: "legal_name", label: "Razón social", type: "text" },
      { key: "trade_name", label: "Nombre comercial", type: "text" },
      { key: "founded", label: "Año de fundación", type: "number" },
      { key: "company_type", label: "Tipo", type: "select", options: ["Fábrica", "Fábrica + comercializadora", "Comercializadora (trading)", "Agente"] },
      { key: "employees", label: "Nº de empleados", type: "number" },
      { key: "factory_area", label: "Área de planta (m²)", type: "number" },
      { key: "website", label: "Sitio web", type: "text" },
    ]},
    { title: "Ubicación", fields: [
      { key: "address", label: "Dirección de la fábrica / oficina", type: "text", wide: true },
      { key: "nearest_port", label: "Puerto más cercano", type: "text" },
    ]},
    { title: "Qué hacen", fields: [
      { key: "main_products", label: "Productos principales", type: "textarea" },
      { key: "markets", label: "Mercados de exportación", type: "text" },
      { key: "capabilities", label: "Capacidades", type: "checks", options: ["OEM", "ODM", "Marca propia", "Diseño / desarrollo", "Moldes propios", "Impresión / personalización"] },
      { key: "years_working", label: "Años trabajando con nosotros", type: "number" },
      { key: "contacts", label: "Contactos visibles al cliente", type: "table", columns: [{ key: "name", label: "Nombre" }, { key: "role", label: "Cargo" }, { key: "email", label: "Email" }, { key: "phone", label: "Teléfono / WeChat" }] },
    ]},
  ],
  cumplimiento: [
    { title: "Certificaciones", fields: [
      { key: "certs", label: "Certificaciones que tiene", type: "checks", options: CERTS },
      { key: "certs_other", label: "Otras certificaciones", type: "text" },
      { key: "cert_table", label: "Detalle de certificados", type: "table", columns: [{ key: "name", label: "Certificado" }, { key: "number", label: "Número" }, { key: "body", label: "Entidad emisora" }, { key: "issued", label: "Emisión", type: "date" }, { key: "expires", label: "Vence", type: "date" }] },
    ]},
    { title: "Auditorías", fields: [
      { key: "audited", label: "Auditoría de fábrica realizada", ...YN },
      { key: "audit_by", label: "Realizada por", type: "text" },
      { key: "audit_date", label: "Fecha", type: "date" },
      { key: "audit_result", label: "Resultado", type: "select", options: ["Aprobada", "Aprobada con observaciones", "Pendiente de correcciones", "No aprobada"] },
      { key: "social_compliance", label: "Cumplimiento social / laboral", type: "textarea" },
      { key: "incidents", label: "Incumplimientos o incidentes conocidos", type: "textarea" },
    ]},
  ],
  empaques: [
    { title: "Empaque individual", fields: [
      { key: "unit_pack", label: "Tipo de empaque individual", type: "checks", options: PACK_TYPES },
      { key: "unit_pack_notes", label: "Detalle (material, medidas)", type: "text", wide: true },
    ]},
    { title: "Caja master", fields: [
      { key: "units_per_carton", label: "Unidades por caja", type: "number" },
      { key: "carton_size", label: "Medidas de caja (cm)", type: "text" },
      { key: "carton_weight", label: "Peso de caja (kg)", type: "number" },
      { key: "carton_material", label: "Material / capas del cartón", type: "text" },
      { key: "cartons_per_pallet", label: "Cajas por pallet", type: "number" },
      { key: "palletized", label: "Embarca en pallets", ...YN },
    ]},
    { title: "Protección y personalización", fields: [
      { key: "protection", label: "Protecciones (esquineros, divisores, espuma…)", type: "text", wide: true },
      { key: "custom_pack", label: "Empaque personalizado disponible", ...YN },
      { key: "custom_pack_cost", label: "Costo / MOQ del empaque personalizado", type: "text" },
      { key: "fumigation", label: "Fumigación / tratamiento de madera (pallets)", ...YN },
    ]},
  ],
  etiquetado: [
    { title: "Productos", fields: [
      { key: "custom_label", label: "Etiqueta personalizada del cliente", ...YN },
      { key: "barcode", label: "Código de barras", type: "select", options: ["EAN-13", "UPC-A", "Code 128", "QR", "Ninguno"] },
      { key: "barcode_by", label: "Quién genera el código", type: "select", options: ["El proveedor", "El cliente lo envía", "Nosotros"] },
      { key: "label_languages", label: "Idiomas de etiqueta", type: "text" },
      { key: "origin_mark", label: "Marcación de país de origen", ...YN },
    ]},
    { title: "Caja y envío", fields: [
      { key: "carton_label", label: "Etiqueta de caja master", type: "textarea" },
      { key: "shipping_mark", label: "Shipping mark", type: "text" },
      { key: "dest_requirements", label: "Requisitos del país destino (advertencias, composición, importador)", type: "textarea" },
      { key: "label_lead_time", label: "Tiempo para cambiar / aprobar etiquetas (días)", type: "number" },
    ]},
  ],
  garantias: [
    { title: "Plazo y cobertura", fields: [
      { key: "months", label: "Garantía (meses)", type: "number" },
      { key: "hours", label: "Garantía (horas de uso)", type: "number" },
      { key: "starts_from", label: "La garantía cuenta desde", type: "select", options: ["Fecha de embarque", "Fecha de llegada / recepción", "Fecha de factura", "Fecha de entrega al cliente final"] },
      { key: "coverage", label: "Qué cubre", type: "textarea" },
      { key: "exclusions", label: "Qué no cubre", type: "textarea" },
    ]},
    { title: "Reclamos", fields: [
      { key: "defect_pct", label: "% de defectos aceptado (AQL)", type: "text" },
      { key: "claim_days", label: "Plazo para reclamar (días)", type: "number" },
      { key: "response_days", label: "Respuesta del proveedor (días)", type: "number" },
      { key: "resolution", label: "Cómo resuelve", type: "checks", options: ["Reposición", "Reembolso", "Nota de crédito", "Descuento en próximo pedido", "Reparación"] },
      { key: "shipping_by", label: "Envío de reposición lo paga", type: "select", options: ["El proveedor", "Compartido", "El cliente"] },
      { key: "evidence", label: "Evidencia requerida", type: "checks", options: ["Fotos", "Video", "Muestra física", "Número de lote", "Factura"] },
    ]},
  ],
  produccion: [
    { title: "Capacidad", fields: [
      { key: "capacity", label: "Capacidad mensual", type: "text" },
      { key: "lines", label: "Nº de líneas de producción", type: "number" },
      { key: "factories", label: "Nº de fábricas", type: "number" },
      { key: "moq", label: "MOQ típico", type: "text" },
      { key: "oem_odm", label: "Producción", type: "checks", options: ["OEM", "ODM", "Producto de catálogo"] },
    ]},
    { title: "Tiempos", fields: [
      { key: "lead_time", label: "Tiempo de producción estándar (días)", type: "number" },
      { key: "sample_time", label: "Tiempo de muestras (días)", type: "number" },
      { key: "rush", label: "Acepta pedidos urgentes", ...YN },
      { key: "peak_season", label: "Temporada alta / cierres (Año Nuevo, etc.)", type: "text" },
    ]},
    { title: "Calidad y embarque", fields: [
      { key: "qc", label: "Control de calidad", type: "checks", options: ["Durante producción", "Inspección final", "Inspección de tercero", "Pruebas de laboratorio", "Muestra pre-embarque"] },
      { key: "aql", label: "AQL usado", type: "text" },
      { key: "loading_port", label: "Puerto de embarque habitual", type: "text" },
      { key: "incoterm", label: "Incoterm habitual", type: "select", options: ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"] },
    ]},
  ],
  calificacion: [
    { title: "Calificación por criterio", fields: [{ key: "_stars", label: "", type: "stars" }] },
    { title: "Evaluación", fields: [
      { key: "recommended", label: "¿Lo recomendamos?", type: "select", options: ["Sí, sin reservas", "Sí, con seguimiento", "Solo para ciertos productos", "No por ahora"] },
      { key: "evaluated_on", label: "Fecha de la evaluación", type: "date" },
      { key: "strengths", label: "Fortalezas", type: "textarea" },
      { key: "weaknesses", label: "Puntos a mejorar", type: "textarea" },
      { key: "history", label: "Historial (entregas a tiempo, reclamos, etc.)", type: "textarea" },
    ]},
  ],
  factura: [
    { title: "Facturación", fields: [
      { key: "invoicing", label: "Facturación", type: "select", options: Object.keys(INVOICING), optionLabels: INVOICING },
      { key: "invoice_type", label: "Tipo de factura", type: "text" },
      { key: "vat", label: "Incluye IVA / VAT", ...YN },
      { key: "vat_pct", label: "% IVA", type: "number" },
      { key: "currency", label: "Moneda de facturación", type: "select", options: ["USD", "CNY", "EUR", "COP", "Otra"] },
      { key: "invoice_by", label: "Quién emite", type: "text" },
      { key: "tax_refund", label: "Devolución de impuestos (tax refund)", ...YN },
    ]},
    { title: "Pago", fields: [
      { key: "payment_terms", label: "Condiciones de pago", type: "select", options: PAYMENT_TERMS },
      { key: "deposit_pct", label: "Anticipo (%)", type: "number" },
      { key: "payment_methods", label: "Métodos de pago", type: "checks", options: ["Transferencia (T/T)", "Alipay", "WeChat Pay", "PayPal", "Carta de crédito"] },
      { key: "no_invoice_conditions", label: "Condiciones si es sin factura", type: "textarea" },
    ]},
  ],
  lista_precios: [
    { title: "Vigencia y condiciones", fields: [
      { key: "valid_from", label: "Vigente desde", type: "date" },
      { key: "valid_until", label: "Vigente hasta", type: "date" },
      { key: "currency", label: "Moneda", type: "select", options: ["USD", "CNY", "EUR", "COP", "Otra"] },
      { key: "incoterm", label: "Incoterm", type: "select", options: ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"] },
      { key: "volume_discounts", label: "Descuentos por volumen", type: "textarea" },
      { key: "price_conditions", label: "Condiciones (validez, variación de materia prima, etc.)", type: "textarea" },
    ]},
    { title: "Precios", fields: [
      { key: "price_table", label: "Lista de precios", type: "table", columns: [{ key: "ref", label: "Referencia" }, { key: "name", label: "Producto" }, { key: "unit", label: "Unidad" }, { key: "moq", label: "MOQ" }, { key: "price", label: "Precio" }, { key: "notes", label: "Notas" }] },
    ]},
  ],
};

export const hasValue = (v) => Array.isArray(v) ? v.some(r => (typeof r === "object" ? Object.values(r).some(x => x !== "" && x != null) : r)) : v !== "" && v != null && v !== false;
