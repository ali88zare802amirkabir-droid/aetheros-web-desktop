import type { ShellContext } from './types';

export function complete(input: string, ctx: ShellContext, commandNames: string[]): { options: string[]; prefix: string } {
  const parts = input.split(/\s+/);
  const last = parts[parts.length - 1] || '';
  if (parts.length <= 1) {
    const opts = commandNames.filter((c) => c.startsWith(last));
    return { options: opts, prefix: last };
  }
  // path completion
  let dirPath = ctx.cwd;
  let base = last;
  if (last.includes('/')) {
    const idx = last.lastIndexOf('/');
    const d = last.slice(0, idx);
    base = last.slice(idx + 1);
    dirPath = resolvePath(ctx.cwd, d || '/');
  }
  const node = ctx.vfs.getNode(dirPath);
  if (!node || node.type !== 'folder') return { options: [], prefix: last };
  const children = Object.keys(node.children || {});
  const opts = children.filter((n) => n.startsWith(base)).map((n) => {
    const child = node.children![n];
    const full = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) + n : n;
    return child?.type === 'folder' ? full + '/' : full;
  });
  return { options: opts, prefix: last };
}

export function resolvePath(cwd: string, p: string): string {
  if (!p) return cwd;
  let parts: string[];
  if (p.startsWith('/')) parts = [];
  else parts = cwd ? cwd.split('/').filter(Boolean) : [];
  const add = p.split('/').filter(Boolean);
  for (const seg of add) {
    if (seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.join('/');
}

export function parentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

export function baseName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}
