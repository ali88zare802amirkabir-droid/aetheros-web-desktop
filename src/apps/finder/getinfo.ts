import type { VFSNode, VFSInterface } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { esc, fmtB, fmtD, kindOf, nodeSize, parentPath } from './utils';
import { putBlob, resolveBlobUrl } from '../../core/BlobStore';

const TAGS = [['#ff3b30','Red'],['#ff9500','Orange'],['#ffcc00','Yellow'],['#34c759','Green'],['#007aff','Blue'],['#af52de','Purple'],['#8e8e93','Gray']] as const;
let z = 13000;

export function openGetInfo(fullPath: string, node: VFSNode, vfs: VFSInterface, toast: (m:string)=>void) {
  const panel = document.createElement('div');
  panel.className = 'getinfo';
  panel.style.zIndex = String(++z);
  panel.style.left = `${80 + Math.random()*120}px`;
  panel.style.top = `${60 + Math.random()*80}px`;
  const name = fullPath.split('/').pop() || node.name;
  const dot = name.lastIndexOf('.');
  const base = (node.type==='file' && dot>0) ? name.slice(0,dot) : name;
  const ext = (node.type==='file' && dot>0) ? name.slice(dot+1) : '';
  const where = fullPath.includes('/') ? 'Desktop/' + parentPath(fullPath) : 'Desktop';
  const iconSrc = node.customIcon || (node.type==='folder'
    ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234da3ff'><path d='M10 4H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z'/></svg>"
    : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239aa0a6'><path d='M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'/></svg>");

  panel.innerHTML = `
    <div class="gi-head"><span>Get Info</span><button data-gi="close">✕</button></div>
    <div class="gi-body">
      <div class="gi-icon-wrap"><img class="gi-icon" src="${iconSrc}" draggable="true" title="Drop an image to change icon" /><div style="font-size:11px;color:var(--text-muted)">Drop image to set icon</div></div>
      <div class="gi-sec"><label>Name & Extension</label>
        <div class="fm-row"><input data-gi="base" value="${esc(base)}" ${node.locked?'disabled':''} />${node.type==='file'?`<input data-gi="ext" value="${esc(ext)}" style="max-width:90px" ${node.locked?'disabled':''} />`:''}</div>
        <div class="fm-row"><label style="min-width:auto"><input type="checkbox" data-gi="hideext" /> Hide extension</label></div>
      </div>
      <div class="gi-sec gi-grid">
        <div><span class="k">Kind</span><span>${esc(kindOf(node,name))}</span></div>
        <div><span class="k">Size</span><span>${fmtB(nodeSize(node))}</span></div>
        <div><span class="k">Where</span><span>${esc(where)}</span></div>
        <div><span class="k">Created</span><span>${fmtD(node.created ?? node.modified)}</span></div>
        <div><span class="k">Modified</span><span>${fmtD(node.modified)}</span></div>
      </div>
      <div class="gi-sec"><label>Tags</label><div class="tag-row gi-tags">${TAGS.map(([c,n])=>`<span class="tag-dot ${(node.tags||[]).includes(n)?'on':''}" data-tag="${n}" style="background:${c}" title="${n}"></span>`).join('')}</div></div>
      <div class="gi-sec"><label>Comments</label><textarea data-gi="comments" rows="3" style="width:100%;resize:vertical;border:1px solid var(--border);border-radius:8px;padding:6px;background:var(--bg-glass-strong);color:var(--text)">${esc(node.comments||'')}</textarea></div>
      <div class="gi-sec gi-grid">
        <div><span class="k">Permissions</span><select data-gi="perm" style="padding:4px;border:1px solid var(--border);border-radius:6px;background:var(--bg-glass-strong);color:var(--text)"><option ${node.permissions==='rwx'?'selected':''} value="rwx">Read & Write</option><option ${node.permissions==='r--'?'selected':''} value="r--">Read only</option><option ${node.permissions==='---'?'selected':''} value="---">No access (sim)</option></select></div>
        <div><label><input type="checkbox" data-gi="lock" ${node.locked?'checked':''}/> Locked</label></div>
      </div>
    </div>`;
  document.body.appendChild(panel);

  const $g = <T extends HTMLElement>(s:string)=>panel.querySelector(s) as T;
  const saveMeta = () => { vfs.persist(); EventBus.emit('vfsChanged', undefined); };
  // drag panel
  const head = $g('.gi-head') as HTMLElement;
  head.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    panel.style.zIndex = String(++z);
    const sx=e.clientX, sy=e.clientY, sl=parseInt(panel.style.left,10), st=parseInt(panel.style.top,10);
    const mv=(ev:MouseEvent)=>{ panel.style.left=(sl+ev.clientX-sx)+'px'; panel.style.top=(st+ev.clientY-sy)+'px'; };
    const up=()=>{ window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
  });
  panel.addEventListener('mousedown', ()=> panel.style.zIndex = String(++z));
  $g('[data-gi="close"]').onclick = () => panel.remove();

  // name/ext rename
  const applyName = () => {
    const nb = ($g('[data-gi="base"]') as HTMLInputElement).value.trim();
    const ne = node.type==='file' ? (($g('[data-gi="ext"]') as HTMLInputElement)?.value.trim() ?? '') : '';
    const nn = node.type==='file' ? (ne ? `${nb}.${ne}` : nb) : nb;
    if (!nb || nn === name) return;
    try { vfs.renameNode(parentPath(fullPath), name, nn); toast('Renamed'); panel.remove(); }
    catch(e){ toast((e as Error).message); }
  };
  $g('[data-gi="base"]').addEventListener('change', applyName);
  $g('[data-gi="ext"]')?.addEventListener('change', applyName);
  $g('[data-gi="hideext"]').addEventListener('change', (e)=>{ const h=(e.target as HTMLInputElement).checked; const ex=$g('[data-gi="ext"]') as HTMLInputElement|null; if(ex) ex.style.opacity=h?'.35':'1'; });

  // tags
  panel.querySelectorAll<HTMLElement>('[data-tag]').forEach(dot => dot.onclick = () => {
    const t = dot.dataset.tag!; node.tags = node.tags || [];
    if (node.tags.includes(t)) node.tags = node.tags.filter(x=>x!==t); else node.tags.push(t);
    dot.classList.toggle('on'); saveMeta();
  });
  // comments/perm/lock
  $g('[data-gi="comments"]').addEventListener('change', (e)=>{ node.comments = (e.target as HTMLTextAreaElement).value; saveMeta(); });
  $g('[data-gi="perm"]').addEventListener('change', (e)=>{ node.permissions = (e.target as HTMLSelectElement).value; saveMeta(); });
  $g('[data-gi="lock"]').addEventListener('change', (e)=>{ node.locked = (e.target as HTMLInputElement).checked; saveMeta(); panel.remove(); openGetInfo(fullPath, node, vfs, toast); });

  // icon drop
  const img = $g('.gi-icon') as HTMLImageElement;
  const iconWrap = $g('.gi-icon-wrap') as HTMLElement;
  iconWrap.ondragover = e => { e.preventDefault(); iconWrap.classList.add('drag-over'); };
  iconWrap.ondragleave = () => iconWrap.classList.remove('drag-over');
  const applyIcon = async (ref: string) => { const url = ref.startsWith('idb:') ? await resolveBlobUrl(ref) : ref; if (url) img.src = url; };
  void applyIcon(node.customIcon || iconSrc);
  iconWrap.ondrop = e => {
    e.preventDefault(); iconWrap.classList.remove('drag-over');
    const f = e.dataTransfer?.files?.[0]; if (!f || !f.type.startsWith('image/')) { toast('Drop an image file'); return; }
    (async () => { const id = await putBlob(f); node.customIcon = `idb:${id}`; await applyIcon(node.customIcon); saveMeta(); toast('Icon updated'); })();
  };
}
