const KEY = 'spotlight_history_v1';

interface HistEntry {
  id: string;
  count: number;
  last: number;
}

function load(): HistEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save(list: HistEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function addToHistory(id: string) {
  const list = load();
  const idx = list.findIndex((e) => e.id === id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx].count++;
    list[idx].last = now;
  } else {
    list.push({ id, count: 1, last: now });
  }
  // keep small
  list.sort((a, b) => b.last - a.last);
  save(list.slice(0, 100));
}

export function getHistoryScore(id: string): number {
  const list = load();
  const e = list.find((x) => x.id === id);
  if (!e) return 0;
  const age = Date.now() - e.last;
  const decay = Math.max(0, 1 - age / (7 * 24 * 3600 * 1000));
  return e.count * 10 * decay;
}
