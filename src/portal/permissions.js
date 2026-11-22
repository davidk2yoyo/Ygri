// Portal user permissions. The server (client_portal_get_me / client_portal_can) is the source of
// truth; this file only describes the keys and the role presets staff pick from when creating a user.
// 'prices' is enforced by the database (amounts, payments, quotation Excel, commercial documents);
// the other keys decide which modules show up in the portal.

export const PERMISSIONS = [
  { key: "prices",          label: "Ver precios",               hint: "Montos de cotizaciones, facturas y pagos; documentos comerciales" },
  { key: "ordenes",         label: "Mis Órdenes",               hint: "Avance, producción, packing list y documentos de cada orden" },
  { key: "envios",          label: "Mis Envíos",                hint: "Seguimiento de envíos" },
  { key: "pedidos",         label: "Subir pedido",              hint: "Crear y enviar pedidos" },
  { key: "documentos",      label: "Documentos",                hint: "Carpetas y archivos compartidos" },
  { key: "reportes",        label: "Reportes de inspección",    hint: "Informes de inspección" },
  { key: "asistente",       label: "Asistente de Importación",  hint: "Calculadora de costos de importación" },
  { key: "cotizaciones_ia", label: "Consultar Cotizaciones",    hint: "Asistente de IA (requiere ver precios)" },
];

export const ALL_KEYS = PERMISSIONS.map(p => p.key);
const only = (...on) => Object.fromEntries(ALL_KEYS.map(k => [k, on.includes(k)]));

export const ROLES = {
  admin:     { label: "Administrador", desc: "Todo, incluidos precios",                  perms: only(...ALL_KEYS) },
  comercial: { label: "Comercial",     desc: "Compra y negocia: todo, incluidos precios", perms: only(...ALL_KEYS) },
  bodega:    { label: "Bodega",        desc: "Producción, envíos y documentos, sin precios", perms: only("ordenes", "envios", "documentos", "reportes") },
  disenos:   { label: "Diseños",       desc: "Producción y documentos, sin precios",     perms: only("ordenes", "documentos", "reportes") },
  finanzas:  { label: "Finanzas",      desc: "Precios, órdenes, envíos y documentos",    perms: only("prices", "ordenes", "envios", "documentos") },
  custom:    { label: "Personalizado", desc: "Permisos elegidos uno a uno",              perms: only("ordenes", "documentos") },
};

// The AI chat answers from quotations, so it can't be on without prices.
export function normalizePerms(perms) {
  const p = { ...only(), ...(perms || {}) };
  if (!p.prices) p.cotizaciones_ia = false;
  return p;
}

export const ROLE_LABEL = Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.label]));
