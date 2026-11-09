import type { AppDefinition } from '../core/types';
import { VFS } from '../core/VFS';
import { previewIcon } from '../ui/icons';
import { OpenWith } from '../core/OpenWith';

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VID_EXT = /\.(mp4|webm|ogg|mov|m4v)$/i;
const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function isVideo(name: string, src: string) { return VID_EXT.test(name) || src.startsWith('data:video'); }
function isImage(name: string, src: string) { return IMG_EXT.test(name) || src.startsWith('data:image'); }

export const PreviewApp: AppDefinition = {
  id: 'preview',
  name: 'Preview',
  icon: previewIcon,
  defaultSize: { width: 900, height: 620 },
  render(_win, _vfs, args?: Record<string, unknown>) {
    const root = document.createElement('div');
    root.className = 'preview-app';
    root.innerHTML = `
      <div class="pv-bar">
        <div class="pv-file"><span class="pv-name" data-k="name">Preview</span><span class="pv-meta" data-k="meta"></span></div>
        <div class="pv-tools" data-k="imgtools">
          <button type="button" class="pv-btn" data-a="rotl" title="Rotate left">↺</button>
          <button type="button" class="pv-btn" data-a="rotr" title="Rotate right">↻</button>
          <button type="button" class="pv-btn" data-a="fliph" title="Flip horizontal">⇋</button>
          <button type="button" class="pv-btn" data-a="flipv" title="Flip vertical">⇵</button>
          <span class="pv-sep"></span>
          <label class="pv-adj" title="Brightness"><span>B</span><input type="range" min="0" max="200" value="100" data-adj="brightness"></label>
          <label class="pv-adj" title="Contrast"><span>C</span><input type="range" min="0" max="200" value="100" data-adj="contrast"></label>
          <label class="pv-adj" title="Saturate"><span>S</span><input type="range" min="0" max="200" value="100" data-adj="saturate"></label>
          <select class="pv-filter" data-k="filter" title="Filter">
            <option value="none">None</option>
            <option value="grayscale(1)">Grayscale</option>
            <option value="sepia(.85)">Sepia</option>
            <option value="invert(1)">Invert</option>
            <option value="hue-rotate(90deg)">Hue</option>
            <option value="blur(1.5px)">Soft</option>
          </select>
          <span class="pv-sep"></span>
          <button type="button" class="pv-btn" data-a="reset" title="Reset adjustments">Reset</button>
          <button type="button" class="pv-btn pv-btn-primary" data-a="save" title="Save edits">Save</button>
        </div>
      </div>
      <div class="pv-stage" data-k="stage">
        <div class="pv-empty" data-k="empty">Open an image or video from Photos or Finder.</div>
        <div class="pv-canvas-wrap" data-k="wrap" style="display:none"><img class="pv-img" data-k="img" alt="" /></div>
        <video class="pv-video" data-k="vid" controls playsinline style="display:none"></video>
      </div>
      <div class="pv-toast" data-k="toast"></div>`;

    const nameEl = root.querySelector('[data-k="name"]') as HTMLElement;
    const metaEl = root.querySelector('[data-k="meta"]') as HTMLElement;
    const emptyEl = root.querySelector('[data-k="empty"]') as HTMLElement;
    const wrap = root.querySelector('[data-k="wrap"]') as HTMLElement;
    const img = root.querySelector('[data-k="img"]') as HTMLImageElement;
    const vid = root.querySelector('[data-k="vid"]') as HTMLVideoElement;
    const tools = root.querySelector('[data-k="imgtools"]') as HTMLElement;
    const toast = root.querySelector('[data-k="toast"]') as HTMLElement;
    const filterSel = root.querySelector('[data-k="filter"]') as HTMLSelectElement;

    let path = (args?.path as string) || (args?.file as string) || '';
    let src = '';
    let rot = 0, flipH = 1, flipV = 1;
    let adj = { brightness: 100, contrast: 100, saturate: 100 };
    let extraFilter = 'none';

    const say = (m: string) => { toast.textContent = m; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); };
    const apply = () => {
      const f = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturate}%)${extraFilter !== 'none' ? ' ' + extraFilter : ''}`;
      img.style.filter = f;
      img.style.transform = `rotate(${rot}deg) scale(${flipH}, ${flipV})`;
    };

    const load = () => {
      src = ''; rot = 0; flipH = 1; flipV = 1; adj = { brightness: 100, contrast: 100, saturate: 100 }; extraFilter = 'none';
      filterSel.value = 'none';
      root.querySelectorAll<HTMLInputElement>('[data-adj]').forEach(i => { i.value = '100'; });
      wrap.style.display = 'none'; vid.style.display = 'none'; vid.pause(); vid.removeAttribute('src'); vid.load();
      tools.style.display = 'none'; emptyEl.style.display = '';
      if (!path) { nameEl.textContent = 'Preview'; metaEl.textContent = ''; return; }
      const node = VFS.getNode(path);
      if (!node || node.type !== 'file') { nameEl.textContent = path; metaEl.textContent = 'Not found'; return; }
      src = node.content || '';
      nameEl.textContent = node.name;
      if (isVideo(node.name, src)) {
        emptyEl.style.display = 'none'; vid.style.display = ''; vid.src = src;
        metaEl.textContent = 'Video';
      } else if (isImage(node.name, src) || src) {
        emptyEl.style.display = 'none'; wrap.style.display = ''; img.src = src; tools.style.display = '';
        metaEl.textContent = 'Image · editable';
        apply();
        img.onload = () => { metaEl.textContent = `Image · ${img.naturalWidth}×${img.naturalHeight}`; };
      } else {
        nameEl.textContent = node.name; metaEl.textContent = 'Unsupported format';
      }
    };

    const bakeAndSave = () => {
      if (!img.src || !img.naturalWidth) { say('Nothing to save'); return; }
      const c = document.createElement('canvas');
      const r = ((rot % 360) + 360) % 360;
      const swap = r === 90 || r === 270;
      c.width = swap ? img.naturalHeight : img.naturalWidth;
      c.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) { say('Save failed'); return; }
      ctx.filter = img.style.filter || 'none';
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(flipH, flipV);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const out = c.toDataURL('image/png');
      try { VFS.writeFile(path, out); } catch { try { const n = VFS.getNode(path); if (n) { n.content = out; VFS.persist(); } } catch {} }
      src = out; rot = 0; flipH = 1; flipV = 1; adj = { brightness: 100, contrast: 100, saturate: 100 }; extraFilter = 'none';
      filterSel.value = 'none'; root.querySelectorAll<HTMLInputElement>('[data-adj]').forEach(i => i.value = '100');
      img.src = out; apply(); say('Saved');
    };

    root.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
      if (!a) return;
      if (a.dataset.a === 'rotl') rot -= 90;
      else if (a.dataset.a === 'rotr') rot += 90;
      else if (a.dataset.a === 'fliph') flipH *= -1;
      else if (a.dataset.a === 'flipv') flipV *= -1;
      else if (a.dataset.a === 'reset') { rot = 0; flipH = 1; flipV = 1; adj = { brightness: 100, contrast: 100, saturate: 100 }; extraFilter = 'none'; filterSel.value = 'none'; root.querySelectorAll<HTMLInputElement>('[data-adj]').forEach(i => i.value = '100'); }
      else if (a.dataset.a === 'save') { bakeAndSave(); return; }
      apply();
    });
    root.querySelectorAll<HTMLInputElement>('[data-adj]').forEach((inp) => {
      inp.addEventListener('input', () => { (adj as any)[inp.dataset.adj!] = Number(inp.value); apply(); });
    });
    filterSel.addEventListener('change', () => { extraFilter = filterSel.value; apply(); });

    load();
    return root;
  },
};

OpenWith.register({ appId: 'preview', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'mp4', 'webm', 'ogg', 'mov', 'm4v'], priority: 20 });
