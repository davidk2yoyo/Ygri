// Accent-insensitive, typo-tolerant matching for "search by name" tools.
// Real failure observed in testing: the user asked for client "guía
// cereza", but the row is stored as "Guia Cereza" (no tilde) — plain
// Postgres ILIKE is case-insensitive but NOT accent-insensitive (that
// needs the `unaccent` extension, which this project doesn't have
// enabled), so the DB-side search returned zero rows and the Copilot
// told the user the client didn't exist at all, instead of finding the
// obvious match. Client/supplier tables are small (tens to low hundreds
// of rows) so scoring the full set in memory is cheap and avoids adding
// a DB extension or an npm fuzzy-search dependency for this.

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .toLowerCase()
    .trim();
}

// Levenshtein distance — only ever called on short single words here
// (typo tolerance), never whole names.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function wordsAreClose(qw, cw) {
  if (!qw || !cw) return false;
  if (cw === qw || cw.startsWith(qw) || qw.startsWith(cw)) return true;
  const tolerance = qw.length <= 4 ? 1 : 2; // short words tolerate fewer typos
  return levenshtein(qw, cw) <= tolerance;
}

// Higher is better; 0 means "not a match at all". Tolerant of accents,
// word order, and small typos, so "guía cereza" / "cereza guia" / "gia
// cereza" all find "Guia Cereza".
function scoreMatch(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 90;
  if (c.includes(q)) return 80;

  const qWords = q.split(/\s+/).filter(Boolean);
  const cWords = c.split(/\s+/).filter(Boolean);
  if (!qWords.every((qw) => cWords.some((cw) => wordsAreClose(qw, cw)))) return 0; // every query word must land somewhere

  return qWords.reduce((sum, qw) => sum + (cWords.some((cw) => cw === qw) ? 20 : 10), 0);
}

// items: plain array; key: field to match against when items are objects
// (omit for an array of strings). Returns items sorted best-match-first.
export function fuzzySearch(query, items, { key, limit = 10 } = {}) {
  return items
    .map((item) => ({ item, score: scoreMatch(query, key ? item[key] : item) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
