// Customer attention: conversations (consultas técnicas, fichas, diseños, preguntas, comentarios) with a client.
export const CASE_KIND = {
  technical: { label: "Consulta técnica",  icon: "🔧", cls: "bg-blue-100 text-blue-700" },
  datasheet: { label: "Ficha técnica",     icon: "📄", cls: "bg-cyan-100 text-cyan-700" },
  design:    { label: "Diseño / aprobación", icon: "🎨", cls: "bg-violet-100 text-violet-700" },
  question:  { label: "Pregunta",          icon: "❓", cls: "bg-amber-100 text-amber-700" },
  comment:   { label: "Comentario",        icon: "💬", cls: "bg-gray-100 text-gray-700" },
};
export const CASE_STATUS = {
  open:     { label: "Esperando respuesta de Ygri", short: "Por responder",   cls: "bg-red-100 text-red-700" },
  answered: { label: "Esperando al cliente",        short: "Respondido",      cls: "bg-green-100 text-green-700" },
  closed:   { label: "Cerrado",                     short: "Cerrado",         cls: "bg-gray-100 text-gray-600" },
};
export const CHANNEL = { portal: "Portal", phone: "Teléfono", whatsapp: "WhatsApp", email: "Email", meeting: "Reunión" };
export const APPROVAL = {
  pending: { label: "Pendiente de aprobación", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Aprobado", cls: "bg-green-100 text-green-700" },
  changes: { label: "Pidió cambios", cls: "bg-red-100 text-red-700" },
};

export const fmtDateTime = (d) => d ? new Date(d).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

// "3 h", "2 d" — how long the client waited for the first answer
export function waitLabel(from, to) {
  if (!from || !to) return null;
  const mins = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
  if (mins < 60) return `${mins} min`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} d`;
}
