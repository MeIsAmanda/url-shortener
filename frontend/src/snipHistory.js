export const HISTORY_KEY = 'sniply.recent-snips.v1';
export const MAX_RECENT_SNIPS = 20;

function validEntry(entry) {
  if (!entry || typeof entry.originalUrl !== 'string' || entry.originalUrl.length > 2048
      || typeof entry.shortUrl !== 'string' || entry.shortUrl.length > 2048
      || !/^https?:\/\//i.test(entry.shortUrl)
      || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))) return false;
  try {
    const url = new URL(entry.shortUrl);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

// Stored data is untrusted: validate its shape before displaying clickable URLs.
export function parseHistory(raw) {
  try {
    if (!raw || raw.length > 200_000) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set();
    return data.filter(entry => {
      if (!validEntry(entry) || seen.has(entry.shortUrl)) return false;
      seen.add(entry.shortUrl);
      return true;
    }).slice(0, MAX_RECENT_SNIPS).map(({ originalUrl, shortUrl, createdAt }) => ({
      originalUrl, shortUrl, createdAt,
    }));
  } catch { return []; }
}

export function loadHistory() {
  try {
    return { items: parseHistory(window.localStorage.getItem(HISTORY_KEY)), issue: null };
  } catch {
    return { items: [], issue: 'read' };
  }
}

export function addToHistory(items, link) {
  const entry = { originalUrl: link.originalUrl, shortUrl: link.shortUrl, createdAt: new Date().toISOString() };
  return [entry, ...items.filter(item => item.shortUrl !== link.shortUrl)].slice(0, MAX_RECENT_SNIPS);
}
