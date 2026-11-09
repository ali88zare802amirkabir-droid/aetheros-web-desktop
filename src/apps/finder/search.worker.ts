type NodeLite = { path: string; name: string; type: 'file'|'folder'; size: number; modified: number; tags: string[]; content?: string };
type TokenQuery = { kind?: string; tag?: string; name?: string; text?: string; sizeOp?: string; sizeBytes?: number; date?: string };

function dateMatch(modified: number, spec?: string): boolean {
  if (!spec) return true; if (!modified) return false;
  const d = new Date(modified), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  if (spec === 'today') return day(d) === day(now);
  if (spec === 'yesterday') return day(d) === day(now) - 86400000;
  if (spec === 'week') return now.getTime() - d.getTime() < 7*86400000;
  if (spec === 'month') return now.getTime() - d.getTime() < 30*86400000;
  return true;
}
function sizeMatch(bytes: number, op?: string, target?: number): boolean {
  if (target == null) return true; const o = op || '=';
  if (o === '>') return bytes > target; if (o === '>=') return bytes >= target;
  if (o === '<') return bytes < target; if (o === '<=') return bytes <= target;
  return Math.abs(bytes - target) < Math.max(1024, target*0.1);
}
function kindMatch(node: NodeLite, kind?: string): boolean {
  if (!kind) return true; const k = kind.toLowerCase(); const ext = (node.name.split('.').pop()||'').toLowerCase();
  if (k === 'folder' || k === 'folders') return node.type === 'folder';
  if (k === 'file' || k === 'files') return node.type === 'file';
  if (k === 'image' || k === 'images') return ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext);
  if (k === 'video' || k === 'videos') return ['mp4','webm','mov'].includes(ext);
  if (k === 'audio') return ['mp3','wav','ogg','m4a'].includes(ext);
  if (k === 'doc' || k === 'document' || k === 'text') return ['txt','md','pdf','json'].includes(ext);
  if (k === 'code') return ['js','ts','tsx','jsx','css','html','json','py'].includes(ext);
  if (k === 'archive') return node.name.endsWith('.archive.json') || ['zip','tar','gz'].includes(ext);
  return ext === k || node.name.toLowerCase().includes(k);
}

self.onmessage = (e: MessageEvent) => {
  const { id, nodes, q, scopeBase } = e.data as { id: number; nodes: NodeLite[]; q: TokenQuery; scopeBase: string };
  const base = scopeBase ? scopeBase + '/' : '';
  const pool = scopeBase ? nodes.filter(n => n.path === scopeBase || n.path.startsWith(base)) : nodes;
  const matches = pool.filter(n => {
    if (q.kind && !kindMatch(n, q.kind)) return false;
    if (q.tag && !n.tags.some(t => t.toLowerCase() === q.tag!.toLowerCase())) return false;
    if (q.name && !n.name.toLowerCase().includes(q.name)) return false;
    if (q.text && !n.name.toLowerCase().includes(q.text) && !(n.content||'').toLowerCase().includes(q.text)) return false;
    if (!dateMatch(n.modified, q.date)) return false;
    if (!sizeMatch(n.size, q.sizeOp, q.sizeBytes)) return false;
    return true;
  }).map(n => n.path);
  (self as unknown as Worker).postMessage({ id, matches });
};
export {};
