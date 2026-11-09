import type { AppDefinition } from '../core/types';
import { VFS } from '../core/VFS';
import { WindowManager } from '../core/WindowManager';
import { photosIcon } from '../ui/icons';

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
function isImageName(name: string) { return IMG_EXT.test(name); }

type Item = { name: string; path: string; src: string; modified: number };

function walk(folderPath: string, node: any, out: Item[]) {
  if (!node || node.type !== 'folder' || !node.children) return;
  for (const child of Object.values(node.children) as any[]) {
    const p = folderPath ? `${folderPath}/${child.name}` : child.name;
    if (child.type === 'folder') walk(p, child, out);
    else if (child.type === 'file' && (isImageName(child.name) || (typeof child.content === 'string' && child.content.startsWith('data:image')))) {
      out.push({ name: child.name, path: p, src: child.content || '', modified: child.modified || 0 });
    }
  }
}

function collect(): Item[] {
  const out: Item[] = [];
  try { walk('', VFS.root, out); } catch {}
  return out.sort((a, b) => b.modified - a.modified);
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export const PhotosApp: AppDefinition = {
  id: 'photos',
  name: 'Photos',
  icon: photosIcon,
  defaultSize: { width: 860, height: 560 },
  render() {
    const root = document.createElement('div');
    root.className = 'photos-app';
    root.innerHTML = `
      <div class="photos-bar">
        <div class="photos-title"><span class="photos-title-main">Library</span><span class="photos-count" data-k="count"></span></div>
        <div class="photos-actions">
          <label class="photos-btn" title="Import photos">
            <input type="file" accept="image/*" multiple data-k="import" hidden />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
            <span>Import</span>
          </label>
          <button type="button" class="photos-btn" data-a="refresh" title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
          </button>
        </div>
      </div>
      <div class="photos-grid" data-k="grid"></div>
      <div class="photos-empty" data-k="empty" style="display:none">
        <div class="photos-empty-art" aria-hidden="true"></div>
        <div class="photos-empty-title">No Photos Yet</div>
        <div class="photos-empty-sub">Capture with Camera or import images to build your library.</div>
      </div>`;

    const grid = root.querySelector('[data-k="grid"]') as HTMLElement;
    const count = root.querySelector('[data-k="count"]') as HTMLElement;
    const empty = root.querySelector('[data-k="empty"]') as HTMLElement;
    const imp = root.querySelector('[data-k="import"]') as HTMLInputElement;

    const render = () => {
      const items = collect();
      count.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
      if (!items.length) { grid.innerHTML = ''; grid.style.display = 'none'; empty.style.display = ''; return; }
      empty.style.display = 'none'; grid.style.display = '';
      grid.innerHTML = items.map((it, i) => `
        <button type="button" class="photos-tile" data-i="${i}" data-path="${esc(it.path)}" title="${esc(it.name)}">
          <span class="photos-thumb" style="background-image:url('${it.src.replace(/'/g, "\\'")}')"></span>
          <span class="photos-meta"><span class="photos-name">${esc(it.name)}</span></span>
        </button>`).join('');
      grid.querySelectorAll('[data-path]').forEach((el) => {
        el.addEventListener('click', () => {
          const p = (el as HTMLElement).dataset.path;
          if (p) WindowManager.openApp({ id: 'preview', args: { path: p } } as any);
        });
      });
    };

    root.querySelector('[data-a="refresh"]')?.addEventListener('click', render);
    imp.addEventListener('change', async () => {
      const files = Array.from(imp.files || []);
      if (!files.length) return;
      try { VFS.getNode('Pictures') || VFS.createFolder('', 'Pictures'); } catch {}
      for (const f of files) {
        const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); }).catch(() => '');
        if (!data) continue;
        const name = f.name.replace(/[\\/:*?"<>|]/g, '_');
        try { VFS.createFile('Pictures', name, data); } catch { try { VFS.writeFile(`Pictures/${name}`, data); } catch {} }
      }
      imp.value = '';
      render();
    });

    render();
    return root;
  },
};
