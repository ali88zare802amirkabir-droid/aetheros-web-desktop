function tokenize(s: string): string[] {
  return s.replace(/\s+/g, '').split('');
}

export function normalizeText(s: string): string {
  if (!s) return '';
  let t = s.toLowerCase();
  // normalize persian/arabic
  t = t.replace(/[يى]/g, 'ی').replace(/[كﻙ]/g, 'ک').replace(/‌/g, ' ').replace(/\s+/g, ' ').trim();
  // normalize digits
  const fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const en = ['0','1','2','3','4','5','6','7','8','9'];
  for (let i = 0; i < fa.length; i++) t = t.split(fa[i]).join(en[i]);
  return t;
}

export function scoreMatch(text: string, query: string): number {
  const t = normalizeText(text);
  const q = normalizeText(query);
  if (!q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800;
  // start of word
  const words = t.split(/[^a-z0-9\u0600-\u06FF]+/);
  for (const w of words) {
    if (w.startsWith(q)) return 600;
  }
  // subsequence
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 400;
  // simple fuzzy contains
  if (t.includes(q)) return 200;
  return 0;
}
