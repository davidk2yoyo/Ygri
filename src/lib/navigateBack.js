// Shared "back to where I came from" logic for pages reached from a
// project's Quotation form (Annex, Packing List, Purchase Order) — those
// links pass state: { from: "/projects", activeTrackId }, since Projects
// has no per-project URL of its own (it's a single-route Kanban board that
// keeps the open project in local component state, not the address bar).
// Without forwarding activeTrackId back through `from`, "back" would land
// on the generic Projects board with no project open — the AI Import bug
// report this fixes ("takes us to project home page but not the project
// we were on"). Falls back to a plain browser back when a page was reached
// some other way (bookmark, direct link) and never got a `from` at all.
export function goBack(navigate, location) {
  const { from, activeTrackId } = location.state || {};
  if (from) navigate(from, activeTrackId ? { state: { activeTrackId } } : undefined);
  else navigate(-1);
}
