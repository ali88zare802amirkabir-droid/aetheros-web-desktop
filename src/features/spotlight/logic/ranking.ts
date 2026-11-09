import type { Result } from './types';
import { scoreMatch } from './calc';
import { getHistoryScore } from './history';

export function rankResults(results: Result[], query: string, ctx: any = {}): Result[] {
  const scored = results.map((r) => {
    let s = 0;
    s += scoreMatch(r.title, query);
    if (r.subtitle) s += Math.floor(scoreMatch(r.subtitle, query) * 0.5);
    // recent/frequent
    s += getHistoryScore(r.id);
    if (ctx.recentAppIds && ctx.recentAppIds.includes(r.id)) s += 50;
    if (ctx.frequent && ctx.frequent[r.id]) s += Math.min(30, ctx.frequent[r.id] * 3);
    r.score = s;
    return r;
  });
  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  // group and limit to 5 per group
  const groups = new Map<string, Result[]>();
  for (const r of scored) {
    if (!groups.has(r.group)) groups.set(r.group, []);
    const arr = groups.get(r.group)!;
    if (arr.length < 5) arr.push(r);
  }
  // build order: put top result separately conceptually by just returning all grouped with top first overall
  const out: Result[] = [];
  // take top overall first maybe
  if (scored[0] && scored[0].score && scored[0].score > 0) {
    // include top as is (it will appear in its group)
  }
  for (const arr of groups.values()) {
    out.push(...arr);
  }
  // ensure top overall is near front - resort by score across groups but grouped headers handled in view
  out.sort((a, b) => (b.score || 0) - (a.score || 0));
  // limit total groups in view? but just return ranked
  return out.slice(0, 40);
}
