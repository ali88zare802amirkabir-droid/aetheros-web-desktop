import type { VFSNode } from '../../core/types';

export const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const fmtB = (b:number)=> b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:b<1073741824?`${(b/1048576).toFixed(1)} MB`:`${(b/1073741824).toFixed(1)} GB`;
export const fmtS = (n:VFSNode)=> n.type==='folder'?'—':fmtB(n.size ?? (n.content?.length ?? 0));
export const fmtD = (t?:number)=> t ? new Date(t).toLocaleString() : '—';
export const kindOf = (n: VFSNode, name: string) => {
  if (n.type === 'folder') return 'Folder';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string,string> = { png:'PNG Image',jpg:'JPEG Image',jpeg:'JPEG Image',gif:'GIF Image',webp:'WebP Image',svg:'SVG Image',mp4:'MPEG-4 Video',webm:'WebM Video',mp3:'MP3 Audio',wav:'WAV Audio',ogg:'OGG Audio',pdf:'PDF Document',md:'Markdown',json:'JSON',txt:'Plain Text',js:'JavaScript',ts:'TypeScript',tsx:'TSX',jsx:'JSX',css:'CSS',html:'HTML',zip:'Archive' };
  return map[ext] || (ext ? `${ext.toUpperCase()} File` : 'File');
};
export const mimeKind = (name: string, node: VFSNode) => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (node.type === 'folder') return 'folder';
  if (['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(ext) || (node.content||'').startsWith('data:image')) return 'image';
  if (['mp4','webm','mov'].includes(ext) || (node.content||'').startsWith('data:video')) return 'video';
  if (['mp3','wav','ogg','m4a'].includes(ext) || (node.content||'').startsWith('data:audio')) return 'audio';
  if (ext === 'pdf' || (node.content||'').startsWith('data:application/pdf')) return 'pdf';
  if (ext === 'md') return 'markdown';
  if (ext === 'json' || (node.content||'').trim().startsWith('{') || (node.content||'').trim().startsWith('[')) return ext==='json' ? 'json' : 'code';
  if (['js','ts','tsx','jsx','css','html','xml','yml','yaml','py','sh'].includes(ext)) return 'code';
  return 'text';
};
export const parseSize = (s: string): number | null => {
  const m = s.trim().match(/^([<>]=?|=)?\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i); if (!m) return null;
  const n = parseFloat(m[2]); const u = (m[3]||'b').toLowerCase();
  const mul = u==='gb'?1073741824:u==='mb'?1048576:u==='kb'?1024:1; return Math.round(n*mul);
};
export interface TokenQuery { kind?: string; tag?: string; name?: string; text?: string; sizeOp?: string; sizeBytes?: number; date?: string; raw: string }
export function parseTokens(q: string): TokenQuery {
  const out: TokenQuery = { raw: q }; const rest: string[] = [];
  const re = /(\w+):(?:"([^"]*)"|(\S+))|(\S+)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    if (m[4]) { rest.push(m[4]); continue; }
    const k = m[1].toLowerCase(); const v = (m[2] ?? m[3] ?? '').trim();
    if (k === 'kind') out.kind = v.toLowerCase();
    else if (k === 'tag') out.tag = v.toLowerCase();
    else if (k === 'name') out.name = v.toLowerCase();
    else if (k === 'date') out.date = v.toLowerCase();
    else if (k === 'size') { const sm = v.match(/^([<>]=?|=)?(.+)$/); if (sm) { out.sizeOp = sm[1]||'='; const b=parseSize(sm[2]); if(b!=null) out.sizeBytes=b; } }
    else rest.push(`${k}:${v}`);
  }
  out.text = rest.join(' ').trim().toLowerCase();
  return out;
}
export function dateMatch(modified: number | undefined, spec?: string): boolean {
  if (!spec) return true; if (!modified) return false;
  const d = new Date(modified), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  if (spec === 'today') return day(d) === day(now);
  if (spec === 'yesterday') return day(d) === day(now) - 86400000;
  if (spec === 'week') return now.getTime() - d.getTime() < 7*86400000;
  if (spec === 'month') return now.getTime() - d.getTime() < 30*86400000;
  return true;
}
export function sizeMatch(bytes: number, op?: string, target?: number): boolean {
  if (target == null) return true; const o = op || '=';
  if (o === '>') return bytes > target; if (o === '>=') return bytes >= target;
  if (o === '<') return bytes < target; if (o === '<=') return bytes <= target;
  return Math.abs(bytes - target) < Math.max(1024, target*0.1);
}
export function nodeSize(n: VFSNode): number { return n.size ?? (n.type === 'file' ? (n.content?.length ?? 0) : 0); }
export function pathParts(p: string): string[] { return p ? p.split('/').filter(Boolean) : []; }
export function parentPath(p: string): string { const parts = pathParts(p); parts.pop(); return parts.join('/'); }
export function joinPath(a: string, b: string): string { return a ? `${a}/${b}` : b; }
export function allPaths(root: VFSNode, base = ''): { path: string; name: string; node: VFSNode }[] {
  const out: { path: string; name: string; node: VFSNode }[] = [];
  const walk = (node: VFSNode, p: string) => {
    for (const [name, child] of Object.entries(node.children ?? {})) {
      const fp = joinPath(p, name);
      out.push({ path: fp, name, node: child });
      if (child.type === 'folder') walk(child, fp);
    }
  };
  walk(root, base); return out;
}
export function highlightText(text: string, q: string): string {
  const safe = esc(text);
  if (!q) return safe;
  const terms = q.split(/\s+/).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if (!terms.length) return safe;
  const re = new RegExp(`(${terms.join('|')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}
