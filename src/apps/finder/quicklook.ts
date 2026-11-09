import type { VFSNode } from '../../core/types';
import { esc, fmtD, fmtS, kindOf, mimeKind } from './utils';
import { highlightCode, injectHighlightCss } from './highlight';
import { resolveBlobUrl } from '../../core/BlobStore';

export type QLItem = { key: string; name: string; node: VFSNode; path: string };
type Opts = {
  items: QLItem[];
  startKey: string;
  anchorRect?: DOMRect | null;
  onOpen: (item: QLItem) => void;
  onClose: () => void;
  toast: (m: string) => void;
};

async function renderMedia(item: QLItem): Promise<string> {
  const { node, name } = item;
  const k = mimeKind(name, node);
  let c = node.content || '';
  if (c.startsWith('idb:')) {
    const url = await resolveBlobUrl(c);
    if (k === 'image') return url ? `<div class="ql-media"><img src="${url}" alt="${esc(name)}" /></div>` : `<div class="ql-media">${esc('Preview unavailable')}</div>`;
    if (k === 'video') return url ? `<div class="ql-media"><video controls src="${url}"></video></div>` : `<div class="ql-media">${esc('Preview unavailable')}</div>`;
    if (k === 'audio') return url ? `<div class="ql-media ql-audio"><div style="font-size:42px;margin-bottom:12px">♫</div><audio controls src="${url}" style="width:min(520px,80vw)"></audio></div>` : `<div class="ql-media">${esc('Preview unavailable')}</div>`;
    if (k === 'pdf') return url ? `<iframe class="ql-pdf" src="${url}"></iframe>` : `<div class="ql-media">${esc('Preview unavailable')}</div>`;
    return `<div class="ql-media"><div style="text-align:center"><div style="font-size:48px">📦</div><div>${esc(name)}</div><div style="color:var(--text-muted);font-size:12px;margin-top:6px">Binary file stored in IndexedDB</div></div></div>`;
  }
  if (k === 'image') {
    const src = c.startsWith('data:image') ? c : '';
    return src ? `<div class="ql-media"><img src="${src}" alt="${esc(name)}" /></div>` : `<pre class="ql-code">${esc(c || '(no preview)')}</pre>`;
  }
  if (k === 'video') {
    const src = c.startsWith('data:video') ? c : '';
    return src ? `<div class="ql-media"><video controls src="${src}"></video></div>` : `<pre class="ql-code">${esc('(video preview unavailable for this item)')}</pre>`;
  }
  if (k === 'audio') {
    const src = c.startsWith('data:audio') ? c : '';
    return src ? `<div class="ql-media ql-audio"><div style="font-size:42px;margin-bottom:12px">♫</div><audio controls src="${src}" style="width:min(520px,80vw)"></audio></div>` : `<pre class="ql-code">${esc('(audio preview unavailable)')}</pre>`;
  }
  if (k === 'pdf') {
    const src = c.startsWith('data:application/pdf') ? c : '';
    return src ? `<iframe class="ql-pdf" src="${src}"></iframe>` : `<div class="ql-media"><div style="text-align:center"><div style="font-size:48px">📄</div><div>${esc(name)}</div><div style="color:var(--text-muted);font-size:12px;margin-top:6px">PDF preview (embed data if uploaded)</div></div></div>`;
  }
  if (k === 'folder') {
    const n = Object.keys(node.children || {}).length;
    return `<div class="ql-media"><div style="text-align:center"><div style="font-size:56px">📁</div><div style="margin-top:8px;font-weight:600">${esc(name)}</div><div style="color:var(--text-muted);font-size:12px;margin-top:4px">${n} item(s)</div></div></div>`;
  }
  injectHighlightCss();
  if (k === 'markdown') return `<div class="ql-doc"><pre class="ql-code">${highlightCode(c, name)}</pre></div>`;
  if (k === 'json') {
    try { const pretty = JSON.stringify(JSON.parse(c || 'null'), null, 2); return `<pre class="ql-code">${highlightCode(pretty, name)}</pre>`; }
    catch { return `<pre class="ql-code">${highlightCode(c, name)}</pre>`; }
  }
  if (k === 'code') return `<pre class="ql-code">${highlightCode(c || '(empty)', name)}</pre>`;
  return `<pre class="ql-code">${esc(c || '(empty)')}</pre>`;
}

export function openQuickLook(opts: Opts): { close: () => void } {
  let idx = Math.max(0, opts.items.findIndex(i => i.key === opts.startKey));
  const ov = document.createElement('div');
  ov.className = 'ql-overlay ql4';
  ov.innerHTML = `
    <div class="ql-card ql4-card">
      <div class="ql-head">
        <button class="ql-nav" data-nav="-1" title="Previous">‹</button>
        <span class="ql-title"></span>
        <span class="ql-count" style="margin-left:auto;font-size:11px;color:var(--text-muted)"></span>
        <button class="ql-nav" data-nav="1" title="Next">›</button>
      </div>
      <div class="ql-body ql4-body"></div>
      <div class="ql-foot">
        <span class="ql-meta" style="font-size:11px;color:var(--text-muted);flex:1"></span>
        <button class="ql-btn" data-act="open">Open</button>
        <button class="ql-btn" data-act="share">Share</button>
        <button class="ql-btn" data-act="close">Close</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const card = ov.querySelector('.ql4-card') as HTMLElement;
  const title = ov.querySelector('.ql-title') as HTMLElement;
  const count = ov.querySelector('.ql-count') as HTMLElement;
  const body = ov.querySelector('.ql4-body') as HTMLElement;
  const meta = ov.querySelector('.ql-meta') as HTMLElement;

  if (opts.anchorRect) {
    const r = opts.anchorRect;
    card.style.transformOrigin = `${r.left + r.width/2}px ${r.top + r.height/2}px`;
    card.classList.add('ql-enter');
    requestAnimationFrame(() => card.classList.remove('ql-enter'));
  }

  let renderSeq = 0;
  const render = async () => {
    const item = opts.items[idx]; if (!item) return;
    const seq = ++renderSeq;
    title.textContent = item.name;
    count.textContent = opts.items.length > 1 ? `${idx+1} / ${opts.items.length}` : '';
    meta.textContent = `${kindOf(item.node, item.name)} · ${fmtS(item.node)} · ${fmtD(item.node.modified)}`;
    body.innerHTML = `<div class="ql-media" style="color:var(--text-muted)">Loading…</div>`;
    (ov.querySelector('[data-nav="-1"]') as HTMLButtonElement).disabled = idx <= 0;
    (ov.querySelector('[data-nav="1"]') as HTMLButtonElement).disabled = idx >= opts.items.length - 1;
    const html = await renderMedia(item);
    if (seq === renderSeq) body.innerHTML = html;
  };
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); opts.onClose(); };
  const nav = (d: number) => { const n = idx + d; if (n >= 0 && n < opts.items.length) { idx = n; render(); } };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nav(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); nav(-1); }
  };
  ov.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === ov) { close(); return; }
    const navAttr = t.closest<HTMLElement>('[data-nav]')?.dataset.nav;
    if (navAttr) nav(+navAttr);
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'close') close();
    if (act === 'open') { opts.onOpen(opts.items[idx]); close(); }
    if (act === 'share') { navigator.clipboard?.writeText(opts.items[idx].path || opts.items[idx].name).catch(()=>{}); opts.toast('Copied path to clipboard'); }
  });
  document.addEventListener('keydown', onKey, true);
  render();
  return { close };
}
