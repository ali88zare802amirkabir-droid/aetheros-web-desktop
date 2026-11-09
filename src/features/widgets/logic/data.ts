import { VFS } from '../../../core/VFS';

export function formatClockParts(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { time: `${hh}:${mm}` };
}

export function formatDate(d: Date, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(d);
  } catch {
    return d.toDateString();
  }
}

function nodeBytes(node: any): number {
  if (!node) return 0;
  if (node.type === 'file') return (node.content || '').length;
  let s = 0;
  for (const c of Object.values(node.children || {})) s += nodeBytes(c);
  return s;
}

export async function getStorageInfo() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      const usage = e.usage || 0;
      const quota = e.quota || 0;
      return { usage, quota, source: 'storage' as const };
    }
  } catch {}
  // fallback: VFS size
  try {
    const usage = nodeBytes(VFS.root);
    return { usage, quota: 512 * 1024 * 1024, source: 'vfs' as const };
  } catch {
    return { usage: 0, quota: 512 * 1024 * 1024, source: 'fallback' as const };
  }
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function pseudoMetrics(t: number) {
  // smooth pseudo metrics for visual demo; real metrics not available in browser
  const cpu = Math.round(28 + 18 * Math.sin(t / 5000) + 8 * Math.sin(t / 1700));
  const mem = Math.round(46 + 10 * Math.sin(t / 7000 + 1));
  const net = Math.round(22 + 14 * Math.sin(t / 4300 + 2));
  return { cpu: clamp(cpu, 5, 96), mem: clamp(mem, 10, 92), net: clamp(net, 2, 88) };
}

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
