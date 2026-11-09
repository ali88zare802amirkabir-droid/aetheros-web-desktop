import { zip, unzip, strToU8, strFromU8, type Unzipped } from 'fflate';
import type { VFSNode, VFSInterface } from '../../core/types';
import { EventBus } from '../../core/EventBus';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function addNode(files: Record<string, Uint8Array>, base: string, name: string, node: VFSNode) {
  const path = base ? `${base}/${name}` : name;
  if (node.type === 'folder') {
    files[path + '/'] = new Uint8Array(0);
    for (const [cn, child] of Object.entries(node.children ?? {})) addNode(files, path, cn, child);
  } else {
    const c = node.content ?? '';
    if (c.startsWith('data:') && c.includes(';base64,')) {
      const b64 = c.split(',')[1] || '';
      const bin = atob(b64);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      files[path] = u;
    } else {
      files[path] = strToU8(c);
    }
  }
}

export function compressToZip(
  vfs: VFSInterface,
  parentPath: string,
  names: string[],
  prog: { set: (p: number, msg?: string) => void },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const files: Record<string, Uint8Array> = {};
    const parent = vfs.getNode(parentPath);
    names.forEach((n, i) => {
      prog.set((i / Math.max(1, names.length)) * 35, `Preparing ${n}`);
      const node = parent?.children?.[n];
      if (node) addNode(files, '', n, clone(node));
    });
    prog.set(40, 'Compressing…');
    zip(files, { level: 6 }, (err, data) => {
      if (err || !data) { reject(err || new Error('zip failed')); return; }
      prog.set(90, 'Saving…');
      const b64 = btoa(Array.from(data).map(b => String.fromCharCode(b)).join(''));
      const aname = (names.length === 1 ? names[0] : 'Archive') + '.zip';
      const par = vfs.getNode(parentPath);
      if (!par || par.type !== 'folder') { reject(new Error('Invalid destination')); return; }
      let finalName = aname;
      let k = 2;
      while (par.children?.[finalName]) { finalName = aname.replace(/\.zip$/i, ` (${k++}).zip`); }
      if (!par.children) par.children = {};
      par.children[finalName] = { type: 'file', name: finalName, content: `data:application/zip;base64,${b64}`, size: data.byteLength, modified: Date.now(), created: Date.now() };
      vfs.persist();
      EventBus.emit('vfsChanged', undefined);
      prog.set(100, 'Done');
      resolve(finalName);
    });
  });
}

export function extractZip(
  vfs: VFSInterface,
  parentPath: string,
  zipName: string,
  prog: { set: (p: number, msg?: string) => void },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const node = vfs.getNode(parentPath)?.children?.[zipName];
    const c = node?.content || '';
    if (!c.includes('base64,')) { reject(new Error('Invalid zip data')); return; }
    prog.set(10, 'Reading archive…');
    const b64 = c.split(',')[1] || '';
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    prog.set(35, 'Extracting…');
    unzip(u, (err, out: Unzipped | undefined) => {
      if (err || !out) { reject(err || new Error('unzip failed')); return; }
      const par = vfs.getNode(parentPath);
      if (!par || par.type !== 'folder') { reject(new Error('Invalid destination')); return; }
      if (!par.children) par.children = {};
      const entries = Object.entries(out);
      const ensureDir = (root: VFSNode, parts: string[]): VFSNode => {
        let cur = root;
        for (const part of parts) {
          if (!part) continue;
          if (!cur.children) cur.children = {};
          if (!cur.children[part]) cur.children[part] = { type: 'folder', name: part, children: {}, modified: Date.now(), created: Date.now() };
          if (cur.children[part].type !== 'folder') cur.children[part] = { type: 'folder', name: part, children: {}, modified: Date.now(), created: Date.now() };
          cur = cur.children[part];
        }
        return cur;
      };
      let count = 0;
      entries.forEach(([p, data], i) => {
        prog.set(35 + (i / Math.max(1, entries.length)) * 55, p.split('/').pop() || p);
        if (p.endsWith('/')) { ensureDir(par, p.replace(/\/$/, '').split('/')); return; }
        const parts = p.split('/').filter(Boolean);
        const fname = parts.pop()!;
        const dir = ensureDir(par, parts);
        if (!dir.children) dir.children = {};
        let fn = fname; let k = 2; while (dir.children[fn]) { const d = fname.lastIndexOf('.'); const b = d>0?fname.slice(0,d):fname; const e = d>0?fname.slice(d):''; fn = `${b} (extracted${k>2?' '+k:''})${e}`; k++; }
        // heuristic: try text
        let text: string | null = null;
        try { text = strFromU8(data); if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text.slice(0,512))) text = null; } catch { text = null; }
        if (text !== null) {
          dir.children[fn] = { type: 'file', name: fn, content: text, size: data.byteLength, modified: Date.now(), created: Date.now() };
        } else {
          const b64o = btoa(Array.from(data).map(b => String.fromCharCode(b)).join(''));
          dir.children[fn] = { type: 'file', name: fn, content: `data:application/octet-stream;base64,${b64o}`, size: data.byteLength, modified: Date.now(), created: Date.now() };
        }
        count++;
      });
      vfs.persist(); EventBus.emit('vfsChanged', undefined);
      prog.set(100, 'Done');
      resolve(count);
    });
  });
}
