// Shared supplier name matching — originally built for the AI quotation
// importer (fixed for false positives in a later pass: a single shared
// generic word like "power" used to cross the match threshold on its own).
// Suppliers have no unique constraint on name, so this can't be a simple
// ilike/equality lookup like resolveOrCreateCatalogItem's item_number match —
// it scores shared *meaningful* words instead.
const STOPWORDS = new Set([
  "technology","technologies","tech","group","co","ltd","limited","company",
  "international","trading","industrial","china","chinese","manufacture",
  "manufacturer","manufacturing","development","enterprise","enterprises",
  "science","scientific","precision","solutions","services","service",
  "products","product","import","export","supply","supplier","trade",
  "corporation","corp","incorporated","inc","holding","holdings",
  "beijing","shanghai","guangzhou","shenzhen","hangzhou","ningbo",
  "zhejiang","jiangsu","guangdong","shandong","hebei","hunan",
  "electronic","electronics","electrical","equipment","machinery",
  "instrument","instruments","control","automation","system","systems",
]);

// Finds the best match for `name` among `suppliers` ({id, name, ...}), or null
// if nothing is confident enough. Requires at least 2 distinct shared
// meaningful words AND that they cover at least half of `name`'s own
// meaningful words, so two unrelated suppliers sharing one generic word never
// link.
export function matchSupplierByName(name, suppliers) {
  if (!name) return null;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const meaningful = (words) => words.filter(w => w.length > 3 && !STOPWORDS.has(w));
  const nameWords = new Set(meaningful(normalize(name).split(/\s+/)));
  if (nameWords.size === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const sup of suppliers) {
    const supWords = new Set(meaningful(normalize(sup.name || "").split(/\s+/)));
    let score = 0;
    for (const word of nameWords) if (supWords.has(word)) score++;
    if (score > bestScore) { bestScore = score; best = sup; }
  }
  return bestScore >= 2 && bestScore / nameWords.size >= 0.5 ? best : null;
}
