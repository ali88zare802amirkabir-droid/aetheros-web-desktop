import type { Provider, Result, ProviderContext } from '../types';
import { VFS } from '../../../../core/VFS';
import { icon } from '../../icons';
import { normalizeText } from '../calc';

function walk(node: any, basePath = ''): { path: string; name: string; node: any }[] {
  const out: { path: string; name: string; node: any }[] = [];
  if (!node || node.type !== 'folder') return out;
  const children = node.children || {};
  for (const k of Object.keys(children)) {
    const v: any = children[k];
    const p = basePath ? basePath + '/' + k : k;
    out.push({ path: p, name: k, node: v });
    if (v && v.type === 'folder') {
      out.push(...walk(v, p));
    }
  }
  return out;
}

export const filesProvider: Provider = {
  id: 'files',
  label: 'Files',
  search(query: string, ctx: ProviderContext): Result[] {
    try {
      const items = walk(VFS.root, '');
      const qn = normalizeText(query);
      const results: Result[] = [];
      for (const it of items) {
        const tn = normalizeText(it.name);
        if (tn.includes(qn) || qn === '') {
          results.push({
            id: `file:${it.path}`,
            providerId: 'files',
            providerLabel: 'Files',
            group: 'files',
            title: it.name,
            subtitle: it.path,
            icon: it.node.type === 'folder' ? icon('folder', 16) : icon('file', 16),
            iconType: 'svg',
            data: { type: it.node.type, path: it.path, node: it.node },
            actions: [
              {
                id: 'open',
                label: 'Open',
                run: (res) => {
                  try {
                    // try to open in Finder or appropriate app
                    ctx.openApp?.('finder');
                    ctx.showInFinder?.(res.data.path);
                  } catch (e) {}
                },
              },
              {
                id: 'showinfinder',
                label: 'Show in Finder',
                shortcut: '⌘↵',
                run: (res) => {
                  try { ctx.openApp?.('finder'); ctx.showInFinder?.(res.data.path); } catch (e) {}
                },
              },
              {
                id: 'quicklook',
                label: 'Quick Look',
                shortcut: 'Space',
                run: (res) => {
                  try { ctx.openQuickLook?.([{ key: res.data.path, name: res.data.name, node: res.data.node, path: res.data.path }], res.data.path); } catch (e) {}
                },
              },
            ],
          });
        }
      }
      return results.slice(0, 30);
    } catch (e) {
      return [];
    }
  },
};
