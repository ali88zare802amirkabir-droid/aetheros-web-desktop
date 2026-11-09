import type { AppDefinition, VFSNode, TrashEntry, SmartFolder } from '../core/types';
import { VFS } from '../core/VFS';
import { EventBus } from '../core/EventBus';
import { State } from '../core/State';
import { finderIcon, folderIcon, fileIcon } from '../ui/icons';
import { esc, fmtB, fmtD, fmtS, kindOf, parseTokens, highlightText, allPaths, pathParts, joinPath, type TokenQuery } from './finder/utils';
import { injectHighlightCss } from './finder/highlight';
import { searchTokens, disposeSearch } from './finder/search';
import { openQuickLook, type QLItem } from './finder/quicklook';
import { openGetInfo } from './finder/getinfo';
import { compressToZip, extractZip } from './finder/zip';
import { putBlob, resolveBlobUrl, createBlobUrl, revokeObjectUrl } from '../core/BlobStore';
import { OpenWith } from '../core/OpenWith';
import { WindowManager } from '../core/WindowManager';
import { AppRegistry } from '../core/AppRegistry';

import { createFinderTabState, reviveTab, serializeTab, type FinderTabState, type ViewMode, type SortKey, type Clip, type Cmd } from './finder/state';
import { SettingsStore } from './settings/store';
interface ColFrame { path: string; sel: string | null }

const TAGS = [['#ff3b30','Red'],['#ff9500','Orange'],['#ffcc00','Yellow'],['#34c759','Green'],['#007aff','Blue'],['#af52de','Purple'],['#8e8e93','Gray']] as const;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function toast(msg: string) {
  let host = document.querySelector('.toast-host') as HTMLElement | null;
  if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; host.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

export const FinderApp: AppDefinition = {
  id: 'finder', name: 'Finder', icon: finderIcon, defaultSize: { width: 1040, height: 620 },
  render(win, _vfs, args?: Record<string, unknown>) {
    const TABS_KEY = 'finder_tabs_v1';
    const initTabArg = args?.finderTab as any;
    const loadTabs = () => { try { const r = localStorage.getItem(TABS_KEY); if(!r) return null; const d=JSON.parse(r); if(!Array.isArray(d?.tabs)||!d.tabs.length) return null; return { tabs: d.tabs.map(reviveTab), active: Math.min(Math.max(0,d.active|0), d.tabs.length-1), closed: Array.isArray(d.closed)?d.closed.map(reviveTab):[] }; } catch { return null; } };
    const snap = loadTabs();
    let tabs: FinderTabState[] = initTabArg ? [reviveTab(initTabArg)] : (snap?.tabs ?? [createFinderTabState('')]);
    let tabIdx = initTabArg ? 0 : (snap?.active ?? 0);
    let tab: FinderTabState = tabs[tabIdx] ?? tabs[0];
    let closedTabs: FinderTabState[] = initTabArg ? [] : (snap?.closed ?? []);
    if (initTabArg) tabIdx = 0;
    let clip: Clip | null = null;
    const undoStack: Cmd[] = []; const redoStack: Cmd[] = [];
    const persistTabs = () => { try { localStorage.setItem(TABS_KEY, JSON.stringify({ tabs: tabs.map(serializeTab), active: tabIdx, closed: closedTabs.slice(-10).map(serializeTab) })); } catch {} };
    const syncUiFromTab = () => { search.value = tab.filter || ''; scopeBtn.textContent = tab.searchScope==='here'?'This Folder':'All'; renderTokenPills(); };
    const renderTabs = () => {
      tabsBar.innerHTML = tabs.map((t,i)=>`<div class="fm-tab ${i===tabIdx?'active':''}" role="tab" aria-selected="${i===tabIdx}" draggable="true" data-ti="${i}"><span title="${esc(t.path?'Desktop/'+t.path:'Desktop')}">${esc(t.path?(t.path.split('/').pop()||'Desktop'):'Desktop')}</span><button data-tc="${i}" aria-label="Close tab">×</button></div>`).join('') + '<button class="fm-tab-add" data-ta="1" title="New Tab (⌘T)">+</button>';
      tabsBar.querySelectorAll<HTMLElement>('.fm-tab[data-ti]').forEach(el=>{
        el.onclick=(e)=>{ if((e.target as HTMLElement).closest('[data-tc]')) return; switchTab(+el.dataset.ti!); };
        el.ondragstart=e=>{ e.dataTransfer?.setData('text/fm-tab', el.dataset.ti!); el.classList.add('dragging'); };
        el.ondragend=(e)=>{ el.classList.remove('dragging'); const r=tabsBar.getBoundingClientRect(); if(e.clientY < r.top-20 || e.clientY > r.bottom+40 || e.clientX < r.left-40 || e.clientX > r.right+40){ const ti=+el.dataset.ti!; if(ti>=0 && tabs[ti]){ EventBus.emit('openApp', {id:'finder', newInstance:true} as any); } } };
        el.ondragover=e=>{ e.preventDefault(); };
        el.ondrop=e=>{ e.preventDefault(); const from=+(e.dataTransfer?.getData('text/fm-tab')??-1); const to=+el.dataset.ti!; if(from>=0&&from!==to){ const [m]=tabs.splice(from,1); tabs.splice(to,0,m); tabIdx=tabs.indexOf(tab); renderTabs(); persistTabs(); } };
      });
      tabsBar.querySelectorAll<HTMLElement>('[data-tc]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); closeTab(+b.dataset.tc!, true); });
      tabsBar.querySelector<HTMLElement>('[data-ta]')!.onclick=()=>newTab();
    };
    const switchTab = (i:number) => { if(i<0||i>=tabs.length||i===tabIdx) return; main.querySelectorAll<HTMLImageElement>('img[data-blob-url]').forEach(revokeThumb); tab.scrollTop=main.scrollTop; tabIdx=i; tab=tabs[i]; syncUiFromTab(); renderTabs(); render(); };
    const newTab = (p?: string) => { tab.scrollTop=main.scrollTop; const nt=createFinderTabState(p ?? tab.path); tabs.push(nt); tabIdx=tabs.length-1; tab=nt; syncUiFromTab(); renderTabs(); render(); persistTabs(); };
    const closeTab = (i:number, closeWindowIfLast=false) => { if(tabs.length<=1){ if(closeWindowIfLast){ persistTabs(); EventBus.emit('windowClosed', { windowId: win.id }); return; } closedTabs.push(tabs[0]); tabs=[createFinderTabState('')]; tabIdx=0; tab=tabs[0]; } else { closedTabs.push(tabs[i]); tabs.splice(i,1); if(tabIdx>=tabs.length) tabIdx=tabs.length-1; if(tabIdx===i||tabIdx>i) tabIdx=Math.max(0,tabIdx-(tabIdx>i?1:0)); tab=tabs[tabs.indexOf(tab)>=0?tabIdx:tabIdx] ?? tabs[tabIdx]; tab=tabs[tabIdx]; } if(closedTabs.length>12) closedTabs=closedTabs.slice(-12); syncUiFromTab(); renderTabs(); render(); persistTabs(); };
    const reopenTab = () => { const t=closedTabs.pop(); if(!t){toast('No recently closed tab'); return;} tabs.push(t); tabIdx=tabs.length-1; tab=t; syncUiFromTab(); renderTabs(); render(); persistTabs(); };

    const root = document.createElement('div'); root.className = 'fm'; root.tabIndex = 0;
    root.innerHTML = `
            <div class="fm-tabs" role="tablist" aria-label="Finder tabs"></div>
            <div class="fm-toolbar">
        <div class="fm-nav">
          <button data-a="back" title="Back (⌘[)">‹</button><button data-a="fwd" title="Forward (⌘])">›</button><button data-a="up" title="Enclosing Folder (⌘↑)">↑</button>
        </div>
        <div class="fm-crumbs"></div>
        <div class="fm-tools">
          <div class="fm-search-wrap">
            <div class="fm-tokens"></div>
            <input class="fm-search" placeholder="Search (kind: tag: size: date: name:)" />
            <div class="fm-suggest"></div>
          </div>
          <button class="fm-scope" data-a="scope" title="Scope">This Folder</button>
          <button data-a="save-smart" title="Save Smart Folder">★</button>
          <input class="fm-size" type="range" min="0" max="2" value="1" title="Icon size" />
          <button data-a="new-folder" title="New Folder">＋📁</button>
          <button data-a="new-file" title="New File">＋📄</button>
          <span class="fm-seg">
            <button data-v="icons" title="Icons">▦</button><button data-v="list" title="List">☰</button><button data-v="columns" title="Columns">▥</button><button data-v="gallery" title="Gallery">🖼</button>
          </span>
          <button data-a="upload" title="Upload">⤴</button><button data-a="preview" title="Preview">◫</button>
        </div>
      </div>
      <div class="fm-body">
        <aside class="fm-sidebar"></aside>
        <main class="fm-main"></main>
        <aside class="fm-preview"></aside>
      </div>
      <div class="fm-status"></div>`;
    const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
    const tabsBar=$('.fm-tabs'), crumbs=$('.fm-crumbs'), sidebar=$('.fm-sidebar'), main=$('.fm-main'), preview=$('.fm-preview'), status=$('.fm-status'), search=$('.fm-search') as HTMLInputElement, sizeR=$('.fm-size') as HTMLInputElement;
    const tokensEl=$('.fm-tokens'), suggestEl=$('.fm-suggest'), scopeBtn=$('.fm-scope');
    let searchPathMap = new Map<string, string>();
    let qlCtrl: { close: () => void } | null = null;
    const thumbCache = new Map<string, string>();
    const revokeThumb = (img: HTMLImageElement) => { if (img.dataset.blobUrl) { revokeObjectUrl(img.dataset.blobUrl); delete img.dataset.blobUrl; } };
    const thumbIO = ('IntersectionObserver' in window) ? new IntersectionObserver((ents)=>{ ents.forEach(en=>{ const img=en.target as HTMLImageElement; if(en.isIntersecting){ const ref=img.dataset.thumb; if(ref && !img.dataset.blobUrl){ img.dataset.thumbLoading='1'; createBlobUrl(ref).then(u=>{ if(u && img.isConnected && img.dataset.thumb===ref){ revokeThumb(img); img.src=u; img.dataset.blobUrl=u; } }).catch(()=>{}).finally(()=>{ delete img.dataset.thumbLoading; }); } } else { if(img.dataset.blobUrl){ revokeThumb(img); img.src = img.dataset.fallback || ''; } } }); }, {root: main, rootMargin:'120px'}) : null;
    const bindThumb = (img: HTMLImageElement, node: VFSNode, fallback: string) => { img.dataset.fallback = fallback; if(node.customIcon){ if(node.customIcon.startsWith('idb:')){ revokeThumb(img); img.src=fallback; img.dataset.thumb=node.customIcon; thumbIO?.observe(img);} else { delete img.dataset.thumb; revokeThumb(img); img.src=node.customIcon; } } else { delete img.dataset.thumb; revokeThumb(img); img.src=fallback; } };

    const tokenKeys = (q: TokenQuery) => { const out: {k:string,v:string}[]=[]; if(q.kind) out.push({k:'kind',v:q.kind}); if(q.tag) out.push({k:'tag',v:q.tag}); if(q.name) out.push({k:'name',v:q.name}); if(q.date) out.push({k:'date',v:q.date}); if(q.sizeBytes!=null) out.push({k:'size',v:(q.sizeOp||'>')+fmtB(q.sizeBytes)}); return out; };
    const renderTokenPills = () => { const tks=tokenKeys(tab.tokenQ); tokensEl.innerHTML = tks.map(t=>`<span class="fm-pill" data-tk="${t.k}">${t.k}:${esc(t.v)}<button data-rm="${t.k}">×</button></span>`).join(''); };
    const suggestions = ['kind:image','kind:folder','kind:code','kind:document','kind:video','kind:audio','tag:red','tag:blue','tag:green','size:>1MB','size:<100KB','date:today','date:week','date:month','name:""'];
    const showSuggest = (val: string) => { const v=val.toLowerCase(); const list = suggestions.filter(s=>s.toLowerCase().includes(v||'kind:')).slice(0,8); suggestEl.innerHTML = list.map(s=>`<div data-sug="${esc(s)}">${esc(s)}</div>`).join(''); suggestEl.classList.toggle('open', !!list.length && document.activeElement===search); };
    const runSearch = async (fromSmart?: string) => {
      tab.filter = search.value.trim(); tab.tokenQ = parseTokens(tab.filter);
      if (!tab.filter) { tab.searchResultPaths = null; searchPathMap.clear(); if (!fromSmart) tab.activeSmartId = null; renderTokenPills(); suggestEl.classList.remove('open'); renderMain(); renderStatus(); return; }
      renderTokenPills();
      const scopeBase = tab.searchScope === 'here' ? (inTrash() ? '' : tab.path) : '';
      try {
        const res = await searchTokens(VFS.root, tab.filter, scopeBase); tab.tokenQ = res.q; tab.searchResultPaths = new Set(res.paths);
        searchPathMap.clear();
        allPaths(VFS.root).forEach(({path:p,name,node})=>{ if(tab.searchResultPaths!.has(p)) searchPathMap.set(p, p); });
      } catch { tab.searchResultPaths = null; }
      renderMain(); renderStatus();
    };

    const isSearchMode = () => !!(tab.searchResultPaths && tab.filter);
    const inTrash = () => tab.path === '__trash__';
    const nodeAt = (p=tab.path) => VFS.getNode(p) ?? VFS.root;
    const fp = (p: string, name?: string) => (p ? p + '/' : '') + (name ?? '');
    const disp = (p: string) => tab.activeSmartId ? `Smart Folder` : (p === '__trash__' ? 'Trash' : (p ? `Desktop/${p}` : 'Desktop'));
    const itemName = (key: string) => inTrash() ? key.split('|')[0] : (isSearchMode() ? (key.split('/').pop() || key) : key);
    const itemFullPath = (p: string, key: string) => inTrash() ? `Trash/${key.split('|')[0]}` : (isSearchMode() ? key : fp(p,key));
    const itemParent = (p: string, key: string) => isSearchMode() ? key.split('/').slice(0,-1).join('/') : p;
    const pushUndo = (cmd: Cmd) => { undoStack.push(cmd); redoStack.length = 0; };
    const trashList = (): [string, VFSNode][] => {
      let list = (State.state.trash ?? []).map(t => [t.name + '|' + t.id, { ...t.node, name: t.name }] as [string, VFSNode]);
      if (tab.filter && inTrash()) { const f = tab.filter.toLowerCase(); list = list.filter(([n]) => n.toLowerCase().includes(f)); }
      list.sort(([an,a],[bn,b]) => an.localeCompare(bn, undefined, {numeric:true,sensitivity:'base'}));
      return list;
    };
    const showHidden = () => !!SettingsStore.get('finder.showHidden');
    const showExt = () => SettingsStore.get('finder.showExtensions') !== false;
    const isHidden = (name: string) => name.startsWith('.');
    const displayLabel = (name: string, node?: VFSNode) => {
      if (showExt() || node?.type === 'folder') return name;
      const dot = name.lastIndexOf('.');
      return dot > 0 ? name.slice(0, dot) : name;
    };
    const listFor = (p: string): [string, VFSNode][] => {
      if (p === '__trash__') return trashList();
      if (isSearchMode() && tab.searchResultPaths) {
        const entries = allPaths(VFS.root).filter(e => tab.searchResultPaths!.has(e.path));
        const inScope = tab.searchScope === 'here' && p && !tab.activeSmartId ? entries.filter(e => e.path === p || e.path.startsWith(p + '/')) : entries;
        let list: [string, VFSNode][] = inScope.map(e => [e.path, e.node]);
        if (!showHidden()) list = list.filter(([k]) => !isHidden(itemName(k)));
        list.sort(([ap,a],[bp,b]) => {
          if (a.type!==b.type) return a.type==='folder'?-1:1;
          const an = itemName(ap), bn = itemName(bp);
          let v=0; if (tab.sortKey==='name') v=an.localeCompare(bn, undefined, {numeric:true,sensitivity:'base'});
          else if (tab.sortKey==='type') v=((an.split('.').pop()||'').localeCompare(bn.split('.').pop()||''));
          else if (tab.sortKey==='modified') v=(a.modified??0)-(b.modified??0); else v=(a.size??(a.content?.length??0))-(b.size??(b.content?.length??0));
          return tab.asc?v:-v;
        }); return list;
      }
      let list = Object.entries(nodeAt(p).children ?? {});
      if (!showHidden()) list = list.filter(([n]) => !isHidden(n));
      if (tab.filter && p===tab.path && !tab.tokenQ.kind && !tab.tokenQ.tag) { const f = tab.filter.toLowerCase(); list = list.filter(([n])=>n.toLowerCase().includes(f)); }
      list.sort(([an,a],[bn,b]) => {
        if (a.type!==b.type) return a.type==='folder'?-1:1;
        let v=0; if (tab.sortKey==='name') v=an.localeCompare(bn, undefined, {numeric:true,sensitivity:'base'});
        else if (tab.sortKey==='type') v=((an.split('.').pop()||'').localeCompare(bn.split('.').pop()||''));
        else if (tab.sortKey==='modified') v=(a.modified??0)-(b.modified??0); else v=(a.size??(a.content?.length??0))-(b.size??(b.content?.length??0));
        return tab.asc?v:-v;
      }); return list;
    };
    const moveToTrash = (p: string, names: string[]) => {
      const items: TrashEntry[] = [];
      for (const n of names) {
        const node = nodeAt(p).children?.[n]; if (!node) continue;
        try { VFS.deleteNode(p, n); items.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name: n, from: p, deletedAt: Date.now(), node: clone(node) }); } catch {}
      }
      State.update({ trash: [...items, ...(State.state.trash ?? [])] });
      return items;
    };
    const restoreFromTrash = (id: string) => {
      const t = (State.state.trash ?? []).find(x => x.id === id); if (!t) return;
      let dest = t.from; if (!VFS.getNode(dest)) dest = '';
      const parent = VFS.getNode(dest); if (parent?.type !== 'folder') return;
      let name = t.name; if (parent.children?.[name]) name = `${t.name} (restored)`;
      if (!parent.children) parent.children = {};
      parent.children[name] = clone(t.node); parent.children[name].name = name; VFS.persist(); EventBus.emit('vfsChanged', undefined);
      State.update({ trash: (State.state.trash ?? []).filter(x => x.id !== id) });
      toast(`Restored "${name}"`);
    };
    const openSmartFolder = (id: string) => {
      const sf = (State.state.smartFolders ?? []).find(s=>s.id===id); if(!sf) return;
      tab.activeSmartId = id; tab.searchScope = sf.scope; search.value = sf.query; tab.filter = sf.query; tab.tokenQ = parseTokens(sf.query);
      renderTokenPills(); runSearch('smart');
    };
    const navigate = (p: string, push=true) => {
      tab.activeSmartId = null; tab.searchResultPaths = null; searchPathMap.clear(); search.value=''; tab.filter=''; tab.tokenQ={raw:''}; renderTokenPills(); suggestEl.classList.remove('open');
      tab.path = p.replace(/^\/+|\/+$/g,''); tab.selected.clear(); tab.anchor=null; tab.renaming=null; tab.galleryIdx=0;
      if (push) { tab.history = tab.history.slice(0,tab.histIdx+1); tab.history.push(tab.path); tab.histIdx=tab.history.length-1; }
      render();
    };

    let sidebarReady = false;
    function ensureDefaults() {
      if (sidebarReady) return;
      let changed = false;
      ['Pictures','Music','Videos'].forEach(p => { if (!VFS.getNode(p)) { try { VFS.createFolder('', p); changed = true; } catch {} } });
      sidebarReady = true;
      if (changed) return; // vfsChanged will trigger re-render
    }
    function renderSidebar() {
      ensureDefaults();
      const favs: [string,string,string][] = [['','Recents',''],['','Desktop',''],['','Documents','Documents'],['','Downloads','Downloads'],['','Pictures','Pictures'],['','Music','Music'],['','Videos','Videos']];
      const locs: [string,string,string][] = [['💻','Desktop',''],['🗑️','Trash','__trash__']];
      const smarts = State.state.smartFolders ?? [];
      sidebar.innerHTML = `<div class="fm-side-head">Favorites</div>${favs.map(([,l,p])=>`<div class="fm-side-item ${!tab.activeSmartId&&tab.path===p?'active':''}" data-p="${p}" data-drop="1"><img src="${folderIcon}"><span>${esc(l)}</span></div>`).join('')}
        <div class="fm-side-head">Locations</div>${locs.map(([ic,l,p])=>`<div class="fm-side-item ${!tab.activeSmartId&&tab.path===p?'active':''}" data-p="${p}" data-drop="${p!=='__trash__'}"><span>${ic}</span><span>${esc(l)}</span></div>`).join('')}
        <div class="fm-side-head">Smart Folders</div>${smarts.length ? smarts.map(sf=>`<div class="fm-side-item ${tab.activeSmartId===sf.id?'active':''}" data-smart="${sf.id}"><span class="fm-smart-ico"></span><span>${esc(sf.name)}</span></div>`).join('') : `<div class="fm-side-item dis" style="opacity:.5;font-size:11px">No smart folders</div>`}
        <div class="fm-side-head">Tags</div><div class="tag-row">${TAGS.map(([c,n])=>`<span class="tag-dot" title="${n}" data-tag="${n}" style="background:${c}"></span>`).join('')}</div>`;
      sidebar.querySelectorAll<HTMLElement>('.fm-side-item[data-p]').forEach(el=>{
        el.onclick=()=>{ const p=el.dataset.p??''; if(p==='__trash__'){ navigate('__trash__'); return;} if(p && !VFS.getNode(p)) try{VFS.createFolder('',p);}catch{} navigate(p); };
        el.ondragover=e=>{ if(el.dataset.drop==='true'||el.dataset.drop==='1'){ e.preventDefault(); el.classList.add('drag-over'); }};
        el.ondragleave=()=>el.classList.remove('drag-over');
        el.ondrop=e=>{ e.preventDefault(); el.classList.remove('drag-over'); const p=el.dataset.p??''; if(p!=='__trash__') { if(p && !VFS.getNode(p)) try{VFS.createFolder('',p);}catch{} handleDrop(p, e); } };
      });
      sidebar.querySelectorAll<HTMLElement>('.fm-side-item[data-smart]').forEach(el=>{
        el.onclick=()=>openSmartFolder(el.dataset.smart!);
        el.oncontextmenu=(e)=>{ e.preventDefault(); if(confirm('Remove this Smart Folder?')){ State.update({ smartFolders: (State.state.smartFolders??[]).filter(s=>s.id!==el.dataset.smart) }); if(tab.activeSmartId===el.dataset.smart) navigate(tab.path); else renderSidebar(); } };
      });
      sidebar.querySelectorAll<HTMLElement>('.tag-dot').forEach(d=>d.onclick=()=>{ tab.searchScope='all'; search.value=`tag:${d.dataset.tag}`; runSearch(); });
    }

    function renderCrumbs() {
      const parts = tab.path?tab.path.split('/'):[]; const segs=[{n:'Desktop',p:''}, ...parts.map((n,i)=>({n,p:parts.slice(0,i+1).join('/')}))];
      crumbs.innerHTML = segs.map((s,i)=>`<span class="fm-crumb" data-p="${s.p}">${esc(s.n)}</span>${i<segs.length-1?'<span class="fm-sep">â€º</span>':''}`).join('');
      crumbs.querySelectorAll<HTMLElement>('.fm-crumb').forEach(el=>{
        el.onclick=()=>navigate(el.dataset.p||'');
        el.ondragover=e=>{e.preventDefault(); el.classList.add('drag-over');}; el.ondragleave=()=>el.classList.remove('drag-over');
        el.ondrop=e=>{e.preventDefault(); el.classList.remove('drag-over'); handleDrop(el.dataset.p||'', e);};
      });
    }

    function nodeFor(p: string, name: string): VFSNode | null {
      if (p === '__trash__') { const id = name.split('|').pop(); return (State.state.trash ?? []).find(t => t.id === id)?.node ?? null; }
      if (isSearchMode()) return VFS.getNode(name);
      return nodeAt(p).children?.[name] ?? null;
    }
    function renderMain() {
      main.dataset.size = tab.iconSize; sizeR.value = tab.iconSize==='sm'?'0':tab.iconSize==='lg'?'2':'1';
      const forceList = inTrash() || isSearchMode();
      if (forceList && (tab.view==='columns' || tab.view==='gallery')) { /* fall through to list */ }
      else if (!forceList && tab.view==='columns') { renderColumns(); return; }
      else if (!forceList && tab.view==='gallery') { renderGallery(); return; }
      preview.style.display = tab.showPreview?'':'none';
      const list = listFor(tab.path); const effView = (forceList && (tab.view==='columns'||tab.view==='gallery')) ? 'list' : tab.view;
      main.className = `fm-main ${effView}`; main.innerHTML='';
      let head: HTMLElement | null = null;
      if (effView==='list') {
        head=document.createElement('div'); head.className='fm-list-head'; head.setAttribute('role','row');
        (['name','type','modified','size'] as SortKey[]).forEach(k=>{ const c=document.createElement('div'); c.className='fm-col '+k; c.setAttribute('role','columnheader'); c.textContent=k[0].toUpperCase()+k.slice(1)+(tab.sortKey===k?(tab.asc?' ▲':' ▼'):''); c.onclick=()=>{ if(tab.sortKey===k) tab.asc=!tab.asc; else {tab.sortKey=k; tab.asc=true;} renderMain(); }; head!.appendChild(c); });
        main.appendChild(head);
      }
      if (!list.length) { const e=document.createElement('div'); e.className='fm-empty-state'; e.innerHTML='<div class="ico">📂</div><div>'+(tab.filter?'No matches':'This folder is empty')+'</div>'+(tab.filter?'<div style="font-size:12px">Try a different search or scope</div>':'')+'</div>'; main.appendChild(e); bindMainDnD(main,tab.path); return; }
      // Phase 5: virtualization for large folders
      const VIRT = effView === 'list' && list.length > 180;
      if (VIRT) {
        const rowH = 28;
        const spacer = document.createElement('div'); spacer.style.position='relative'; spacer.style.width='100%';
        spacer.style.height = (list.length * rowH) + 'px';
        const viewport = document.createElement('div'); viewport.style.position='absolute'; viewport.style.left='0'; viewport.style.right='0'; viewport.style.top='0';
        spacer.appendChild(viewport); main.appendChild(spacer);
        const draw = () => {
          const scrollTop = main.scrollTop - (head ? head.offsetHeight : 0);
          const vh = main.clientHeight || 400;
          const start = Math.max(0, Math.floor(scrollTop / rowH) - 8);
          const end = Math.min(list.length, Math.ceil((scrollTop + vh) / rowH) + 8);
          viewport.style.transform = `translateY(${start*rowH}px)`;
          viewport.innerHTML = '';
          for (let i=start;i<end;i++) { const [name,node]=list[i]; const it=makeItem(name,node,tab.path,list); it.style.height=rowH+'px'; viewport.appendChild(it); }
        };
        main.onscroll = () => draw();
        draw();
      } else if (effView === 'icons' && list.length > 240) {
        const itemW = tab.iconSize==='sm'?84:tab.iconSize==='lg'?120:104; const itemH = tab.iconSize==='sm'?86:tab.iconSize==='lg'?120:104;
        const spacer = document.createElement('div'); spacer.style.position='relative'; spacer.style.width='100%'; main.appendChild(spacer);
        const viewport = document.createElement('div'); viewport.style.position='absolute'; viewport.style.left='0'; viewport.style.right='0'; viewport.style.top='0'; spacer.appendChild(viewport);
        const draw = () => {
          const w = main.clientWidth || 600; const cols = Math.max(1, Math.floor(w / itemW));
          const rows = Math.ceil(list.length / cols); spacer.style.height = (rows * itemH) + 'px';
          const st = main.scrollTop; const vh = main.clientHeight || 400;
          const r0 = Math.max(0, Math.floor(st/itemH)-2); const r1 = Math.min(rows, Math.ceil((st+vh)/itemH)+2);
          viewport.style.transform = `translateY(${r0*itemH}px)`; viewport.innerHTML='';
          for(let r=r0;r<r1;r++) for(let c=0;c<cols;c++){ const i=r*cols+c; if(i>=list.length) break; const [name,node]=list[i]; const it=makeItem(name,node,tab.path,list); it.style.position='absolute'; it.style.left=(c*itemW)+'px'; it.style.top=((r-r0)*itemH)+'px'; it.style.width=itemW+'px'; it.style.height=itemH+'px'; viewport.appendChild(it); }
        };
        main.onscroll = () => draw(); requestAnimationFrame(draw); (main as any)._vgridRO?.disconnect?.(); const ro = new ResizeObserver(()=>draw()); ro.observe(main); (main as any)._vgridRO = ro;
      } else {
        list.forEach(([name,node])=> main.appendChild(makeItem(name,node,tab.path,list)));
      }
      if (!((effView==='list' && list.length>180) || (effView==='icons' && list.length>240))) { (main as any)._vgridRO?.disconnect?.(); (main as any)._vgridRO=null; main.onscroll=null; }
      bindMainDnD(main, tab.path);
      const ak = tab.anchor || (tab.selected.size===1 ? [...tab.selected][0] : null);
      if(ak){ const ae = main.querySelector<HTMLElement>('[data-name="'+CSS.escape(ak)+'"]'); if(ae?.id) main.setAttribute('aria-activedescendant', ae.id); else main.removeAttribute('aria-activedescendant'); } else main.removeAttribute('aria-activedescendant');
    }

    function columnStack(): {p:string, sel:string|null}[] {
      const parts = tab.path ? tab.path.split('/') : [];
      const stack: {p:string, sel:string|null}[] = [{p:'', sel: parts[0] ?? (tab.selected.size===1 ? [...tab.selected][0] : null)}];
      let cur = '';
      for (let i=0;i<parts.length;i++) { cur = cur ? `${cur}/${parts[i]}` : parts[i]; stack.push({p:cur, sel: parts[i+1] ?? (i===parts.length-1 && tab.selected.size===1 ? [...tab.selected][0] : null)}); }
      return stack;
    }

    function renderColumns() {
      preview.style.display = 'none';
      main.className = 'fm-main cols'; main.innerHTML = '';
      const stack = columnStack();
      stack.forEach((frame, idx) => {
        const pane = document.createElement('div'); pane.className = 'fm-colpane'; pane.dataset.p = frame.p;
        listFor(frame.p).forEach(([name,node]) => {
          const full = fp(frame.p,name);
          const isSel = frame.sel === name || (idx === stack.length-1 && tab.selected.has(name));
          const el = document.createElement('div'); el.className = `fm-item ${isSel?'sel':''}`; el.draggable = true; el.dataset.name = name;
          el.innerHTML = `<img src="${node.type==='folder'?folderIcon:fileIcon}"><span class="fm-name">${esc(name)}</span>${node.type==='folder'?'<span class="arrow">â€º</span>':''}`;
          el.onclick = (e) => {
            e.stopPropagation();
            tab.selected = new Set([name]); tab.anchor = name;
            if (node.type === 'folder') { navigate(full); } else { render(); }
          };
          el.ondblclick = () => openItem(name,node,full);
          el.oncontextmenu = (e) => { e.preventDefault(); tab.selected = new Set([name]); tab.anchor=name; render(); showCtx(e.clientX,e.clientY,name,node,frame.p); };
          bindItemDrag(el,name,frame.p);
          if (node.type === 'folder') {
            el.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('drag-over'); };
            el.ondragleave = () => el.classList.remove('drag-over');
            el.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('drag-over'); handleDrop(full, e); };
          }
          pane.appendChild(el);
        });
        bindMainDnD(pane, frame.p);
        main.appendChild(pane);
      });
      // preview pane
      const last = stack[stack.length-1];
      const selName = tab.selected.size===1 ? [...tab.selected][0] : last.sel;
      const node = selName ? nodeAt(last.p).children?.[selName] : null;
      const pp = document.createElement('div'); pp.className = 'fm-colpane fm-col-preview';
      pp.innerHTML = node && selName ? `<div style="padding:12px">${previewInner(selName, node, fp(last.p, selName))}</div>` : `<div class="fm-p-empty">Select an item to preview</div>`;
      main.appendChild(pp);
      const panes = main.querySelectorAll('.fm-colpane');
      panes[panes.length-1]?.scrollIntoView({block:'nearest', inline:'end'});
    }

    function renderGallery() {
      preview.style.display = 'none';
      const list = listFor(tab.path);
      main.className = 'fm-main gallery'; main.innerHTML = '';
      if (!list.length) { main.innerHTML = '<div class="fm-empty-state"><div class="ico">📂</div><div>This folder is empty</div></div>'; bindMainDnD(main, tab.path); return; }
      if (!tab.selected.size || !list.find(([n])=>tab.selected.has(n))) { tab.selected = new Set([list[0][0]]); tab.anchor = list[0][0]; }
      const curName = [...tab.selected][0];
      const curNode = nodeAt(tab.path).children?.[curName] ?? list[0][1];
      const stage = document.createElement('div'); stage.className = 'fm-g-stage';
      stage.innerHTML = `<div class="fm-g-preview">${curNode.type==='file' ? `<pre>${esc((curNode.content||'').slice(0,8000)) || '(empty file)'}</pre>` : `<div class="fm-g-folder"><img src="${folderIcon}"><div>${Object.keys(curNode.children??{}).length} items</div></div>`}</div><div class="fm-g-meta">${previewInner(curName, curNode, fp(tab.path,curName))}</div>`;
      const stripWrap = document.createElement('div'); stripWrap.className = 'fm-g-strip'; stripWrap.style.position='relative'; stripWrap.style.overflow='auto';
      const inner = document.createElement('div'); inner.style.position='relative'; inner.style.height='100%'; inner.style.minHeight='86px';
      stripWrap.appendChild(inner);
      const thumbW = 96;
      const drawStrip = () => {
        const vw = stripWrap.clientWidth || 600; const sl = stripWrap.scrollLeft;
        inner.style.width = (list.length * thumbW) + 'px';
        if (list.length <= 120) {
          inner.innerHTML = '';
          list.forEach(([name,node]) => { const t = makeGalleryThumb(name,node,list); t.style.position='absolute'; t.style.left=(list.findIndex(x=>x[0]===name)*thumbW)+'px'; inner.appendChild(t); });
          return;
        }
        const start = Math.max(0, Math.floor(sl/thumbW)-4); const end = Math.min(list.length, Math.ceil((sl+vw)/thumbW)+4);
        inner.innerHTML = '';
        for(let i=start;i<end;i++){ const [name,node]=list[i]; const t=makeGalleryThumb(name,node,list); t.style.position='absolute'; t.style.left=(i*thumbW)+'px'; t.style.top='4px'; inner.appendChild(t); }
      };
      const makeGalleryThumb = (name:string,node:VFSNode,l:[string,VFSNode][]) => {
        const t = document.createElement('div'); t.className = `fm-g-thumb ${tab.selected.has(name)?'sel':''}`; t.draggable = true; t.dataset.name = name; t.style.width='88px';
        t.innerHTML = `<img src="${folderIcon}"><span>${esc(name)}</span>`;
        const im=t.querySelector('img'); if(im) bindThumb(im as HTMLImageElement,node,node.type==='folder'?folderIcon:fileIcon);
        t.onclick = (e) => { e.stopPropagation(); tab.selected = new Set([name]); tab.anchor=name; renderMain(); renderStatus(); };
        t.ondblclick = () => openItem(name,node,fp(tab.path,name));
        t.oncontextmenu = (e) => { e.preventDefault(); tab.selected=new Set([name]); tab.anchor=name; render(); showCtx(e.clientX,e.clientY,name,node,tab.path); };
        bindItemDrag(t,name,tab.path);
        return t;
      };
      stripWrap.onscroll = () => drawStrip();
      main.append(stage, stripWrap);
      bindMainDnD(main, tab.path);
      requestAnimationFrame(()=>{ drawStrip(); const si=list.findIndex(([n])=>n===curName); if(si>=0) stripWrap.scrollLeft=Math.max(0, si*thumbW - stripWrap.clientWidth/2); });
    }

    // External file upload DnD (Phase 3)
    let dragDepth = 0;
    const dropOv = document.createElement('div'); dropOv.className = 'fm-drop-overlay'; dropOv.style.display='none'; dropOv.textContent='Drop files to upload'; root.style.position='relative'; root.appendChild(dropOv);
    root.addEventListener('dragenter', (e) => { if (inTrash() || !e.dataTransfer?.types.includes('Files') || e.dataTransfer.types.includes('text/fm')) return; e.preventDefault(); dragDepth++; dropOv.style.display='flex'; });
    root.addEventListener('dragover', (e) => { if (dropOv.style.display!=='none') { e.preventDefault(); e.dataTransfer!.dropEffect='copy'; } });
    root.addEventListener('dragleave', () => { if (dragDepth>0) dragDepth--; if (dragDepth<=0){ dragDepth=0; dropOv.style.display='none'; } });
    root.addEventListener('drop', (e) => { if (dropOv.style.display!=='none') { e.preventDefault(); dragDepth=0; dropOv.style.display='none'; handleUpload(e.dataTransfer?.files ?? null, tab.path); } });

    function makeItem(key:string,node:VFSNode,p:string,list:[string,VFSNode][]) {
      const el=document.createElement('div');
      const isCut = clip?.op==='cut' && (clip.parent===p ? clip.names.includes(key) : clip.names.includes(key));
      el.className=`fm-item ${tab.selected.has(key)?'sel':''} ${isCut?'cut':''}`;
      const optId = 'fmopt-' + btoa(unescape(encodeURIComponent(key))).replace(/[^a-zA-Z0-9]/g,'').slice(0,24);
      el.id = optId; el.draggable=!inTrash() && !isSearchMode(); el.dataset.name=key; el.setAttribute('role','option'); el.setAttribute('aria-selected', String(tab.selected.has(key)));
      const isActive = tab.anchor === key || (tab.selected.size===1 && tab.selected.has(key));
      el.tabIndex = isActive ? 0 : -1;
      const forceList = inTrash() || isSearchMode();
      const eff = (forceList && (tab.view==='columns'||tab.view==='gallery')) ? 'list' : tab.view;
      const dname = itemName(key);
      const dlabel = displayLabel(dname, node);
      const ico = node.customIcon || (node.type==='folder'?folderIcon:fileIcon);
      const sub = isSearchMode() ? `<span style="color:var(--text-muted);font-size:10px;margin-left:6px">${esc(itemParent(p,key)?'Desktop/'+itemParent(p,key):'')}</span>` : '';
      if (eff==='icons') el.innerHTML=`<img src="${ico}"><span class="fm-name"></span>`;
      else el.innerHTML=`<div class="fm-col name"><img src="${ico}"><span class="fm-name"></span>${sub}</div><div class="fm-col type">${esc(kindOf(node,dname))}</div><div class="fm-col modified">${fmtD(node.modified)}</div><div class="fm-col size">${fmtS(node)}</div>`;
      const nameHost = el.querySelector('.fm-name') as HTMLElement;
      if (!inTrash() && !isSearchMode() && tab.renaming===key) {
        const inp=document.createElement('input'); inp.className='fm-rename'; inp.value=dname; inp.draggable=false;
        inp.onclick=e=>e.stopPropagation(); inp.ondblclick=e=>e.stopPropagation();
        const commit=()=>{ const nn=inp.value.trim(); if(nn&&nn!==dname){ try{ VFS.renameNode(p,dname,nn); pushUndo({label:`Rename to ${nn}`, redo:()=>VFS.renameNode(p,dname,nn), undo:()=>VFS.renameNode(p,nn,dname)}); tab.selected.delete(key); tab.selected.add(nn);}catch(err){toast((err as Error).message);} } tab.renaming=null; render(); };
        inp.onblur=commit; inp.onkeydown=e=>{ if(e.key==='Enter') inp.blur(); if(e.key==='Escape'){tab.renaming=null; render();} };
        nameHost.replaceWith(inp); setTimeout(()=>{inp.focus(); const d=dname.lastIndexOf('.'); inp.setSelectionRange(0,d>0?d:dname.length);},0);
      } else {
        const hq = (tab.tokenQ.text || tab.tokenQ.name || (isSearchMode() ? tab.filter : '')) || '';
        nameHost.innerHTML = hq ? highlightText(dlabel, hq) : esc(dlabel);
      }
      const im = el.querySelector('img'); if(im) bindThumb(im as HTMLImageElement, node, node.type==='folder'?folderIcon:fileIcon);
      el.onclick=e=>{ e.stopPropagation(); if(tab.renaming) return; if(e.shiftKey&&tab.anchor){ const names=list.map(x=>x[0]); const a=names.indexOf(tab.anchor),b=names.indexOf(key); if(a>=0&&b>=0){const [lo,hi]=[Math.min(a,b),Math.max(a,b)]; tab.selected=new Set(names.slice(lo,hi+1));} } else if(e.metaKey||e.ctrlKey){ tab.selected.has(key)?tab.selected.delete(key):tab.selected.add(key); tab.anchor=key; } else { tab.selected=new Set([key]); tab.anchor=key; } renderMain(); renderPreview(); renderStatus(); };
      el.ondblclick=()=>{ if(inTrash()) restoreFromTrash(key.split('|').pop()!); else openItem(key,node,itemFullPath(p,key)); };
      el.oncontextmenu=e=>{ e.preventDefault(); e.stopPropagation(); if(!tab.selected.has(key)){tab.selected=new Set([key]); tab.anchor=key;} renderMain(); renderPreview(); renderStatus(); showCtx(e.clientX,e.clientY,key,node,p); };
      if (!inTrash() && !isSearchMode()) bindItemDrag(el,dname,p);
      if (!inTrash() && node.type==='folder') {
        let springT: number | undefined;
        el.ondragover=e=>{ if(isSearchMode()) return; e.preventDefault(); el.classList.add('drag-over','spring'); if(!springT) springT = window.setTimeout(()=>{ el.classList.remove('spring'); navigate(fp(p,dname)); }, 650); };
        el.ondragleave=()=>{ el.classList.remove('drag-over','spring'); if(springT){ clearTimeout(springT); springT=undefined; } };
        el.ondrop=e=>{ if(isSearchMode()) return; e.preventDefault(); e.stopPropagation(); if(springT){ clearTimeout(springT); springT=undefined; } el.classList.remove('drag-over','spring'); handleDrop(fp(p,dname), e); };
      }
      return el;
    }

    function bindItemDrag(el:HTMLElement,name:string,p:string){
      el.ondragstart=e=>{ if(tab.renaming){e.preventDefault();return;} if(!tab.selected.has(name)) tab.selected=new Set([name]); e.dataTransfer?.setData('text/fm', JSON.stringify({parent:p,names:[...tab.selected]})); e.dataTransfer!.effectAllowed='copyMove';
        if(tab.selected.size>1 && e.dataTransfer){ const g=document.createElement('div'); g.style.cssText='position:fixed;top:-999px;padding:6px 10px;border-radius:999px;background:var(--accent);color:#fff;font:600 12px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.2)'; g.textContent=tab.selected.size+' items'; document.body.appendChild(g); e.dataTransfer.setDragImage(g, 10, 10); setTimeout(()=>g.remove(),0); }
      };
    }
    function bindMainDnD(el:HTMLElement,p:string){
      el.ondragover=e=>{ if(e.target===el){ e.preventDefault(); el.classList.add('drag-over'); }};
      el.ondragleave=e=>{ if(e.target===el) el.classList.remove('drag-over'); };
      el.ondrop=e=>{ if(e.target===el){ e.preventDefault(); el.classList.remove('drag-over'); handleDrop(p,e); }};
      if(el===main){
        el.setAttribute('role','listbox'); el.setAttribute('aria-label','File list');
        el.oncontextmenu=e=>{ if(e.target===el){e.preventDefault(); showBgCtx(e.clientX,e.clientY,p);} };
        el.onmousedown=e=>{
          if(e.button!==0 || (e.target as HTMLElement).closest('.fm-item,.fm-list-head,.fm-col-head,input,button')) return;
          e.preventDefault();
          const sr=el.getBoundingClientRect(); const sx=e.clientX-sr.left+el.scrollLeft, sy=e.clientY-sr.top+el.scrollTop;
          const rb=document.createElement('div'); rb.className='fm-rubber'; el.appendChild(rb);
          const keep = e.shiftKey||e.metaKey||e.ctrlKey; const startSel = new Set(keep ? tab.selected : []);
          const move=(ev:MouseEvent)=>{ const cx=ev.clientX-sr.left+el.scrollLeft, cy=ev.clientY-sr.top+el.scrollTop; const x=Math.min(sx,cx), y=Math.min(sy,cy), w=Math.abs(cx-sx), h=Math.abs(cy-sy); Object.assign(rb.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'}); const items=Array.from(el.querySelectorAll<HTMLElement>('.fm-item[data-name]')); const next=new Set(startSel); items.forEach(it=>{ const ir=it.getBoundingClientRect(); const ix=ir.left-sr.left+el.scrollLeft, iy=ir.top-sr.top+el.scrollTop; const hit=!(ix+ir.width<x||ix>x+w||iy+ir.height<y||iy>y+h); const nm=it.dataset.name!; if(hit) next.add(nm); else if(!keep) next.delete(nm); }); tab.selected=next; items.forEach(it=>it.classList.toggle('sel', tab.selected.has(it.dataset.name||''))); renderPreview(); renderStatus(); };
          const up=()=>{ const had=rb.style.width&&rb.style.width!=='0px'; rb.remove(); window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); if(!had && !keep){ tab.selected.clear(); tab.anchor=null; tab.renaming=null; renderMain(); renderPreview(); renderStatus(); } };
          window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
        };
      }
    }
    function handleDrop(dest:string,e:DragEvent){
      const raw=e.dataTransfer?.getData('text/fm'); if(!raw) return; try{ const d=JSON.parse(raw) as {parent:string,names:string[]}; const copy=e.altKey; const moves:{from:string,name:string,to:string,snap:VFSNode|null}[]=[];
        for(const n of d.names){ if(d.parent===dest) continue; const snap=clone(nodeAt(d.parent).children?.[n]??null); try{ copy?VFS.copyNode(d.parent,n,dest):VFS.moveNode(d.parent,n,dest); if(!copy) moves.push({from:d.parent,name:n,to:dest,snap}); }catch(err){toast((err as Error).message);} }
        if(!copy && moves.length){ const ms=[...moves]; pushUndo({label:`Move ${ms.length} item(s)`, redo:()=>ms.forEach(m=>VFS.moveNode(m.from,m.name,m.to)), undo:()=>{ ms.slice().reverse().forEach(m=>{ try{VFS.moveNode(m.to,m.name,m.from);}catch{ if(m.snap){ const par=nodeAt(m.from); if(par.children && !par.children[m.name]){ par.children[m.name]=clone(m.snap); VFS.persist(); EventBus.emit('vfsChanged',undefined);} } } }); }}); toast(`Moved ${ms.length} item(s)`); }
        else if(copy) toast(`Copied ${d.names.length} item(s)`);
        tab.selected.clear(); render();
      }catch{}
    }

    function showAdvancedQL(startKey?: string) {
      const list = listFor(tab.path);
      const items: QLItem[] = list.map(([k,n])=>({ key:k, name:itemName(k), node:n, path:itemFullPath(tab.path,k) }));
      const key = startKey || (tab.selected.size===1 ? [...tab.selected][0] : items[0]?.key);
      if (!items.length || !key) return;
      let anchorRect: DOMRect | null = null;
      const el = main.querySelector<HTMLElement>(`[data-name="${CSS.escape(key)}"]`);
      if (el) anchorRect = el.getBoundingClientRect();
      qlCtrl?.close();
      qlCtrl = openQuickLook({ items, startKey: key, anchorRect, onOpen: (it)=> { if(it.node.type==='folder'){ navigate(it.path); } }, onClose: ()=>{ qlCtrl=null; }, toast });
    }
    function openItem(key:string,node:VFSNode,full:string){ if(node.type==='folder') { navigate(itemFullPath(tab.path,key)); return; } const name = itemName(key); const apps = OpenWith.resolve(node, name); if (apps.length) { const appId = apps[0]; try { WindowManager.openApp({ id: appId, newInstance: false, args: { path: itemFullPath(tab.path,key) } }); return; } catch (e) {} } showAdvancedQL(key); }
    function previewInner(name:string,node:VFSNode,full:string){ const ico = node.customIcon || (node.type==='folder'?folderIcon:fileIcon); return `<div class="fm-p-head"><img src="${ico}"><div class="fm-p-name">${esc(name)}</div><div class="fm-p-kind">${kindOf(node,name)}</div></div>
      <div class="fm-p-meta"><div><b>Size</b><span>${fmtS(node)}</span></div><div><b>Modified</b><span>${fmtD(node.modified)}</span></div><div><b>Path</b><span>${esc(full ? 'Desktop/'+full : 'Desktop')}</span></div></div>
      <div class="fm-p-content">${node.type==='file'?`<pre>${esc((node.content||'').slice(0,5000))||'(empty)'}</pre>`:`${Object.keys(node.children??{}).length} items`}</div>`; }
    function renderPreview(){ preview.style.display = tab.showPreview ? '' : 'none'; if(!tab.showPreview) return; if(tab.selected.size!==1){ preview.innerHTML=`<div class="fm-p-empty">${tab.selected.size>1?tab.selected.size+' items tab.selected':'No selection'}</div>`; return; } const key=[...tab.selected][0]; const name = inTrash() ? key.split('|')[0] : key; const node=nodeFor(tab.path,key); if(node) preview.innerHTML=previewInner(name,node,inTrash()?`Trash/${name}`:fp(tab.path,name)); }
    function renderStatus(){ const total=listFor(tab.path).length, sel=tab.selected.size; status.textContent=`${total} item${total!==1?'s':''}${sel?` Â· ${sel} tab.selected`:''}${clip?` Â· ${clip.op==='cut'?'Cut':'Copied'} ${clip.names.length}`:''} Â· ${undoStack.length} undo`; ($('[data-a="back"]') as HTMLButtonElement).disabled=tab.histIdx<=0; ($('[data-a="fwd"]') as HTMLButtonElement).disabled=tab.histIdx>=tab.history.length-1; ($('[data-a="up"]') as HTMLButtonElement).disabled=!tab.path; root.querySelectorAll<HTMLElement>('[data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===tab.view)); sizeR.style.display = tab.view==='icons' ? '' : 'none'; }

    function render(){ renderTabs(); renderSidebar(); renderCrumbs(); renderMain(); if(tab.view!=='columns') renderPreview(); else { preview.style.display='none'; } renderStatus(); }

    function doNewFolder(){ if(inTrash()) return; const n=prompt('New folder name:','untitled folder'); if(!n) return; try{ VFS.createFolder(tab.path,n); pushUndo({label:`New folder ${n}`, redo:()=>{try{VFS.createFolder(tab.path,n);}catch{}}, undo:()=>{try{VFS.deleteNode(tab.path,n);}catch{}}}); tab.selected=new Set([n]); }catch(e){toast((e as Error).message);} render(); }
    function doNewFile(){ if(inTrash()) return; const n=prompt('New file name:','untitled.txt'); if(!n) return; try{ VFS.createFile(tab.path,n,''); pushUndo({label:`New file ${n}`, redo:()=>{try{VFS.createFile(tab.path,n,'');}catch{}}, undo:()=>{try{VFS.deleteNode(tab.path,n);}catch{}}}); tab.selected=new Set([n]); }catch(e){toast((e as Error).message);} render(); }
    function doDelete(){
      if (inTrash()) {
        const ids = [...tab.selected].map(k => k.split('|').pop()!).filter(Boolean);
        if (!ids.length || !confirm(`Delete ${ids.length} item(s) permanently?`)) return;
        State.update({ trash: (State.state.trash ?? []).filter(t => !ids.includes(t.id)) });
        tab.selected.clear(); toast('Deleted permanently'); render(); return;
      }
      const keys=[...tab.selected]; if(!keys.length) return;
      const items: TrashEntry[] = [];
      for (const k of keys) {
        const parentP = itemParent(tab.path, k); const nm = itemName(k);
        const node = nodeAt(parentP).children?.[nm]; if(!node) continue;
        try { VFS.deleteNode(parentP, nm); items.push({ id:`${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name:nm, from:parentP, deletedAt:Date.now(), node: clone(node) }); } catch {}
      }
      State.update({ trash: [...items, ...(State.state.trash ?? [])] });
      if (items.length) pushUndo({label:`Move to Trash (${items.length})`, redo:()=>{ items.forEach(it=>{ try{VFS.deleteNode(it.from,it.name);}catch{} }); State.update({trash:[...items.filter(it=>!(State.state.trash??[]).find(t=>t.id===it.id)), ...(State.state.trash??[])]}); }, undo:()=>{ items.forEach(it=>{ const par=nodeAt(it.from)||VFS.root; if(!par.children) par.children={}; if(!par.children[it.name]){ par.children[it.name]=clone(it.node); VFS.persist(); EventBus.emit('vfsChanged',undefined);} State.update({trash:(State.state.trash??[]).filter(t=>t.id!==it.id)}); }); }});
      tab.selected.clear(); toast(`Moved ${items.length} item(s) to Trash`); render();
    }
    function doRestore(){ if(!inTrash()) return; const ids=[...tab.selected].map(k=>k.split('|').pop()!).filter(Boolean); ids.forEach(restoreFromTrash); tab.selected.clear(); render(); }
    function doEmptyTrash(){ if(!confirm('Empty Trash permanently?')) return; State.update({trash:[]}); tab.selected.clear(); toast('Trash emptied'); render(); }
    function doCopy(op:'copy'|'cut'){ if(inTrash()||!tab.selected.size) return; if(isSearchMode() && op==='cut'){ toast('Cut not available in search results'); return; } const names = [...tab.selected].map(k=> isSearchMode() ? k : k); clip={op,parent: isSearchMode() ? '' : tab.path, names}; toast(`${op==='cut'?'Cut':'Copied'} ${tab.selected.size}`); renderStatus(); }
    function doPaste(){ if(inTrash()||!clip) return; const c={...clip}; if(c.op==='cut'){ c.names.forEach(n=>{try{VFS.moveNode(c.parent,n,tab.path);}catch(e){toast((e as Error).message);}}); pushUndo({label:`Paste (move)`, redo:()=>c.names.forEach(n=>{try{VFS.moveNode(c.parent,n,tab.path);}catch{}}), undo:()=>{ c.names.forEach(n=>{try{VFS.moveNode(tab.path,n,c.parent);}catch{}}); }}); clip=null; } else { c.names.forEach(n=>{ try{ if(isSearchMode() || n.includes('/')){ const nm=n.split('/').pop()||n; const par=n.split('/').slice(0,-1).join('/'); VFS.copyNode(par,nm,tab.path); } else VFS.copyNode(c.parent,n,tab.path); }catch(e){toast((e as Error).message);} }); } tab.selected.clear(); render(); }
    function doDuplicate(){ if(inTrash()) return; [...tab.selected].forEach(n=>{try{VFS.copyNode(tab.path,n,tab.path);}catch(e){toast((e as Error).message);}}); toast('Duplicated'); render(); }
    function downloadBlob(name: string, content: string, type='application/octet-stream') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type})); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    }
    function doDownload() {
      if (inTrash() || tab.selected.size !== 1) { toast('Select one file to download'); return; }
      const key = [...tab.selected][0]; const node = nodeFor(tab.path, key);
      if (!node || node.type !== 'file') { toast('Only files can be downloaded (folders: use Compress)'); return; }
      downloadBlob(itemName(key), node.content ?? '', 'text/plain;charset=utf-8');
    }
    async function doCompress() {
      if (inTrash() || !tab.selected.size) return;
      if (isSearchMode()) { toast('Open a folder to compress items'); return; }
      const names = [...tab.selected].map(k=> itemName(k));
      const prog = progressUI('Compressing (ZIP)');
      try { const aname = await compressToZip(VFS, tab.path, names, prog); toast(`Compressed → ${aname}`); }
      catch(e){ prog.fail((e as Error).message); }
      render();
    }
    async function doExtract() {
      if (inTrash() || tab.selected.size !== 1) return;
      const key = [...tab.selected][0]; const name = itemName(key);
      if (!/\.zip$/i.test(name)) { toast('Select a .zip file'); return; }
      const prog = progressUI('Extracting ZIP');
      try { const n = await extractZip(VFS, isSearchMode()?itemParent(tab.path,key):tab.path, name, prog); toast(`Extracted ${n} item(s)`); }
      catch(e){ prog.fail((e as Error).message); }
      render();
    }
    function doUndo(){ const c=undoStack.pop(); if(!c){toast('Nothing to undo');return;} c.undo(); redoStack.push(c); toast('Undo: '+c.label); render(); }
    function doRedo(){ const c=redoStack.pop(); if(!c){toast('Nothing to redo');return;} c.redo(); undoStack.push(c); toast('Redo: '+c.label); render(); }

    function progressUI(title:string){
      const el=document.createElement('div'); el.className='fm-progress'; el.innerHTML=`<div style="font-size:12px;font-weight:600">${esc(title)}</div><div class="fm-sub" style="font-size:11px;color:var(--text-muted);margin-top:2px"></div><div class="bar"><div class="fill"></div></div>`;
      document.body.appendChild(el);
      const fill=el.querySelector('.fill') as HTMLElement, sub=el.querySelector('.fm-sub') as HTMLElement;
      return { set:(p:number,msg?:string)=>{ fill.style.width=Math.max(0,Math.min(100,p))+'%'; if(msg) sub.textContent=msg; }, done:(msg='Done')=>{ fill.style.width='100%'; sub.textContent=msg; setTimeout(()=>el.remove(), 900); }, fail:(msg:string)=>{ sub.textContent=msg; setTimeout(()=>el.remove(), 1800); } };
    }
    function doBatchRename(){
      if (inTrash() || isSearchMode() || tab.selected.size < 1) { toast('Select items in a folder to rename'); return; }
      const names = [...tab.selected];
      closeQL();
      const ov = document.createElement('div'); ov.className='qlCtrl-overlay';
      ov.innerHTML = `<div class="qlCtrl-card fm-modal"><div class="qlCtrl-head"><span>Batch Rename (${names.length})</span><span style="cursor:pointer" data-x>✕</span></div><div class="qlCtrl-body"><div class="fm-row"><label>Mode</label><select id="br-mode"><option value="replace">Replace Text</option><option value="prefix">Add Prefix</option><option value="suffix">Add Suffix</option><option value="seq">Sequence</option></select></div><div class="fm-row" id="br-r1"><label>Find</label><input id="br-find" placeholder="text to find" /></div><div class="fm-row" id="br-r2"><label>Replace</label><input id="br-repl" placeholder="replacement" /></div><div class="fm-row" id="br-r3" style="display:none"><label>Start at</label><input id="br-start" type="number" value="1" /></div><div class="fm-batch-list" id="br-list"></div><div class="fm-actions"><button data-x>Cancel</button><button class="primary" id="br-apply">Rename</button></div></div></div>`;
      const $b = <T extends HTMLElement>(s:string)=>ov.querySelector(s) as T;
      const mode = $b('#br-mode') as HTMLSelectElement, find = $b('#br-find') as HTMLInputElement, repl = $b('#br-repl') as HTMLInputElement, start = $b('#br-start') as HTMLInputElement, list = $b('#br-list');
      const compute = () => { const m = mode.value; $b('#br-r1').style.display = m==='replace'?'':'none'; $b('#br-r2').style.display = (m==='replace'||m==='prefix'||m==='suffix'||m==='seq')?'':'none'; $b('#br-r3').style.display = m==='seq'?'':'none'; const f=find.value, r=repl.value, s=parseInt(start.value||'1',10); ($b('#br-r1').querySelector('label') as HTMLElement).textContent = m==='replace'?'Find':m==='prefix'?'Prefix':m==='suffix'?'Suffix':'Base name'; ($b('#br-r2').querySelector('label') as HTMLElement).textContent = m==='replace'?'Replace with':m==='seq'?'Format':'Text'; return names.map((n,i)=>{ const dot=n.lastIndexOf('.'); const base=dot>0?n.slice(0,dot):n; const ext=dot>0?n.slice(dot):''; if(m==='replace') return f ? n.split(f).join(r) : n; if(m==='prefix') return (f||'') + n; if(m==='suffix') return base + (f||'') + ext; return (r||base) + ' ' + (s+i) + ext; }); };
      const refresh = () => { const nn=compute(); list.innerHTML = names.map((n,i)=>`<div><span>${esc(n)}</span><span class="arrow">→</span><span>${esc(nn[i])}</span></div>`).join(''); };
      [mode,find,repl,start].forEach(el=>el.addEventListener('input', refresh)); mode.addEventListener('change', refresh);
      ov.onclick=e=>{ if(e.target===ov || (e.target as HTMLElement).dataset.x!==undefined) ov.remove(); };
      $b('#br-apply').onclick=()=>{ const nn=compute(); const par=nodeAt(tab.path); if(!par.children){ov.remove();return;} const set=new Set(Object.keys(par.children)); for(let i=0;i<names.length;i++){ if(names[i]===nn[i]||!nn[i]) continue; if(set.has(nn[i]) && nn[i]!==names[i]){ toast(`Name conflict: ${nn[i]}`); return; } } names.forEach((n,i)=>{ if(nn[i]&&nn[i]!==n) try{ VFS.renameNode(tab.path,n,nn[i]); }catch{} }); ov.remove(); tab.selected.clear(); toast(`Renamed ${names.length} items`); render(); };
      document.body.appendChild(ov); refresh();
    }
    async function handleUpload(files: FileList | null, destPath = tab.path) {
      if (!files || !files.length || inTrash()) return;
      const list = Array.from(files); const prog = progressUI(`Uploading ${list.length} item(s)`);
      for (let i=0;i<list.length;i++) { const f = list[i]; prog.set(((i)/list.length)*100, f.name); try {
        const isText = /^(text\/|application\/(json|javascript|xml)|image\/svg)/.test(f.type) || /\.(txt|md|json|js|ts|tsx|css|html|svg|csv|log)$/i.test(f.name);
        let content: string;
        if (isText && f.size < 512*1024) content = await f.text();
        else { const id = await putBlob(f); content = `idb:${id}`; }
        const parent = VFS.getNode(destPath); let name = f.name; if(parent?.children?.[name]) { const dot=name.lastIndexOf('.'); const b=dot>0?name.slice(0,dot):name; const ex=dot>0?name.slice(dot):''; let k=2; while(parent?.children?.[`${b} (${k})${ex}`]) k++; name=`${b} (${k})${ex}`; }
        VFS.createFile(destPath, name, content);
        const n = VFS.getNode(destPath)?.children?.[name]; if(n){ n.size = f.size; VFS.persist(); }
      } catch {} }
      prog.done('Upload complete'); render();
    }
    function showQuickLook(name:string,node:VFSNode){ // Phase 4: delegate to advanced QL
      const key = isSearchMode() ? (allPaths(VFS.root).find(e=>e.node===node && e.name===name)?.path || name) : name;
      if(!tab.selected.size) tab.selected = new Set([key]);
      showAdvancedQL(tab.selected.has(key)?key:undefined);
    }
    function closeQL(){ qlCtrl?.close(); qlCtrl=null; }
    function openGoToFolder(){
      closeQL();
      const ov=document.createElement('div'); ov.className='qlCtrl-overlay';
      const all=allPaths(VFS.root).filter(e=>e.node.type==='folder').map(e=>e.path);
      ov.innerHTML=`<div class="qlCtrl-card fm-modal" style="width:min(520px,92vw)"><div class="qlCtrl-head"><span>Go to Folder</span><span style="cursor:pointer" data-x>✕</span></div><div class="qlCtrl-body"><div class="fm-row" style="position:relative"><input id="gtf" placeholder="Desktop/Documents/..." style="width:100%" /><div class="fm-suggest open" id="gtf-s" style="position:static;margin-top:6px;max-height:180px"></div></div><div class="fm-actions"><button data-x>Cancel</button><button class="primary" id="gtf-go">Go</button></div></div></div>`;
      const inp=ov.querySelector('#gtf') as HTMLInputElement, sug=ov.querySelector('#gtf-s') as HTMLElement;
      const renderSug=()=>{ const v=inp.value.toLowerCase(); sug.innerHTML=['',...all].filter(p=>p.toLowerCase().includes(v)).slice(0,12).map(p=>`<div data-p="${esc(p)}">${esc(p? 'Desktop/'+p:'Desktop')}</div>`).join(''); };
      sug.onclick=e=>{ const p=(e.target as HTMLElement).closest<HTMLElement>('[data-p]')?.dataset.p; if(p!=null){ inp.value=p; renderSug(); } };
      inp.oninput=renderSug; inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); (ov.querySelector('#gtf-go') as HTMLElement).click(); } if(e.key==='Escape') ov.remove(); };
      ov.onclick=e=>{ if(e.target===ov||(e.target as HTMLElement).dataset.x!==undefined) ov.remove(); };
      (ov.querySelector('#gtf-go') as HTMLElement).onclick=()=>{ const p=inp.value.replace(/^Desktop\/?/,'').replace(/^\/+|\/+$/g,''); if(p && !VFS.getNode(p)){ toast('Folder not found'); return; } ov.remove(); navigate(p); };
      document.body.appendChild(ov); renderSug(); inp.focus();
    }


    let ctx:HTMLElement|null=null; const closeCtx=()=>{ctx?.remove();ctx=null;};
    function menu(x:number,y:number,items:[string,()=>void,boolean?][], tagNode?: VFSNode){ closeCtx(); ctx=document.createElement('div'); ctx.className='context-menu'; items.forEach(([l,fn,dis])=>{ if(l==='---'){const s=document.createElement('div');s.className='fm-menu-sep';ctx!.appendChild(s);return;} if(l==='__tags__'){const lab=document.createElement('div'); lab.className='context-menu-item dis'; lab.textContent='Tags'; ctx!.appendChild(lab); const r=document.createElement('div');r.className='tag-row';TAGS.forEach(([c,n])=>{const d=document.createElement('span');d.className='tag-dot'+(tagNode?.tags?.includes(n)?' on':'');d.style.background=c;d.title=n;d.onclick=()=>{ if(tagNode){ tagNode.tags=tagNode.tags||[]; if(tagNode.tags.includes(n)) tagNode.tags=tagNode.tags.filter(t=>t!==n); else tagNode.tags.push(n); VFS.persist(); EventBus.emit('vfsChanged',undefined); } closeCtx(); };r.appendChild(d);});ctx!.appendChild(r);return;} const i=document.createElement('div'); i.className='context-menu-item'+(dis?' dis':''); i.textContent=l; if(!dis) i.onclick=()=>{closeCtx();fn();}; ctx!.appendChild(i); }); document.body.appendChild(ctx); const r=ctx.getBoundingClientRect(); ctx.style.left=Math.min(x,innerWidth-r.width-4)+'px'; ctx.style.top=Math.max(4,Math.min(y,innerHeight-r.height-4))+'px'; setTimeout(()=>document.addEventListener('mousedown',closeCtx,{once:true}),0); }
    function showCtx(x:number,y:number,key:string,node:VFSNode,p:string){
      const name = itemName(key);
      if (inTrash()) { menu(x,y,[['Quick Look',()=>showAdvancedQL(key)],['Get Info (sim)',()=>toast('Trash item: restore first')],['---',()=>{}],['Restore',doRestore],['Delete Permanently',doDelete]]); return; }
      const isZip = /\.zip$/i.test(name);
      const full = itemFullPath(p,key);
      const items: any[] = [['Open',()=>openItem(key,node,full)],['Quick Look',()=>showAdvancedQL(key)],['---',()=>{}]];
      if (node.type !== 'folder') {
        try { const apps = OpenWith.resolve(node, itemName(key)); apps.forEach(aid => { const app = AppRegistry.get(aid); items.push([`Open with ${app?.name || aid}`, () => { try { WindowManager.openApp({ id: aid, newInstance: false, args: { path: full } }); } catch (e) { openItem(key,node,full); } }]); }); } catch(e) {}
      }
      items.push(['---',()=>{}],['Rename',()=>{ if(isSearchMode()){toast('Rename in original folder'); return;} tab.renaming=key;renderMain();}],['Batch Rename…',doBatchRename, tab.selected.size<1 || isSearchMode()],['Duplicate',doDuplicate, isSearchMode()],['---',()=>{}],['Copy',()=>doCopy('copy')],['Cut',()=>doCopy('cut'), isSearchMode()],['---',()=>{}],['Download',doDownload, !(tab.selected.size===1 && node.type==='file')],['Compress (ZIP)',()=>void doCompress(), !tab.selected.size],['Extract',()=>void doExtract(), !(tab.selected.size===1 && isZip)],['---',()=>{}],['__tags__',()=>{}],['---',()=>{}],['Get Info (⌘I)',()=>openGetInfo(full,node,VFS,toast)],['Move to Trash',doDelete]);
      menu(x,y,items as any, node);
    }
    function showBgCtx(x:number,y:number,p:string){
      if (p==='__trash__') { menu(x,y,[['Empty Trash',doEmptyTrash, !(State.state.trash??[]).length],['---',()=>{}],['Select All',()=>{tab.selected=new Set(listFor(p).map(x=>x[0]));renderMain();renderStatus();}]]); return; }
      menu(x,y,[['New Folder',doNewFolder],['New File',doNewFile],['Upload Files…',()=>{ const inp=document.createElement('input'); inp.type='file'; inp.multiple=true; inp.onchange=()=>handleUpload(inp.files,p); inp.click(); }],['---',()=>{}],['Paste',doPaste,!clip],['---',()=>{}],['Select All',()=>{tab.selected=new Set(listFor(p).map(x=>x[0]));renderMain();renderStatus();}],['Sort by Name',()=>{tab.sortKey='name';renderMain();}],['Sort by Date',()=>{tab.sortKey='modified';renderMain();}],['Sort by Size',()=>{tab.sortKey='size';renderMain();}]]);
    }

    root.addEventListener('click',e=>{ const t=e.target as HTMLElement; const a=t.closest<HTMLElement>('[data-a]')?.dataset.a; const v=t.closest<HTMLElement>('[data-v]')?.dataset.v; if(a==='back'&&tab.histIdx>0){tab.histIdx--;navigate(tab.history[tab.histIdx],false);} if(a==='fwd'&&tab.histIdx<tab.history.length-1){tab.histIdx++;navigate(tab.history[tab.histIdx],false);} if(a==='up'&&tab.path) navigate(tab.path.split('/').slice(0,-1).join('/')); if(a==='new-folder') doNewFolder(); if(a==='new-file') doNewFile(); if(a==='preview'){tab.showPreview=!tab.showPreview;render();} if(a==='upload'){ const inp=document.createElement('input'); inp.type='file'; inp.multiple=true; inp.onchange=()=>handleUpload(inp.files, tab.path); inp.click(); } if(a==='scope'){ tab.searchScope = tab.searchScope==='here'?'all':'here'; scopeBtn.textContent = tab.searchScope==='here'?'This Folder':'All'; if(tab.filter) runSearch(); } if(a==='save-smart'){ if(!tab.filter){toast('Enter a search to save');} else { const name=prompt('Smart Folder name:', tab.tokenQ.kind?`kind:${tab.tokenQ.kind}`:tab.filter) || tab.filter; const sf:SmartFolder={id:`sf_${Date.now()}`, name, query:tab.filter, scope:tab.searchScope}; State.update({ smartFolders:[...(State.state.smartFolders??[]), sf] }); toast('Smart Folder saved'); renderSidebar(); } } if(v){tab.view=v as ViewMode; render();} });
    search.oninput=()=>{ showSuggest(search.value); clearTimeout((search as any)._t); (search as any)._t = setTimeout(runSearch, 180); };
    search.onfocus=()=>showSuggest(search.value);
    search.onblur=()=>setTimeout(()=>suggestEl.classList.remove('open'), 150);
    suggestEl.addEventListener('mousedown', (e)=>{ const sug=(e.target as HTMLElement).closest<HTMLElement>('[data-sug]')?.dataset.sug; if(sug){ search.value = sug.endsWith('""')? sug.slice(0,-1) : (sug+' '); search.focus(); runSearch(); showSuggest(search.value); } });
    tokensEl.addEventListener('click', (e)=>{ const rm=(e.target as HTMLElement).closest<HTMLElement>('[data-rm]')?.dataset.rm; if(!rm) return; const parts=search.value.split(/\s+/).filter(p=>!p.toLowerCase().startsWith(rm+':')); search.value=parts.join(' '); runSearch(); });
    sizeR.oninput=()=>{ tab.iconSize=sizeR.value==='0'?'sm':sizeR.value==='2'?'lg':'md'; renderMain(); };
    root.addEventListener('keydown',e=>{ if(tab.renaming) return; const mod=e.metaKey||e.ctrlKey; if(mod&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?doRedo():doUndo(); } else if(mod&&e.key==='a'){e.preventDefault(); tab.selected=new Set(listFor(tab.path).map(x=>x[0])); renderMain(); renderStatus();} else if(mod&&e.key==='c') doCopy('copy'); else if(mod&&e.key==='x') doCopy('cut'); else if(mod&&e.key==='v') doPaste(); else if(mod&&e.key==='d'){e.preventDefault(); doDuplicate();} else if(mod&&e.key==='f'){e.preventDefault(); search.focus();} else if(mod&&e.key==='['){e.preventDefault(); if(tab.histIdx>0){tab.histIdx--;navigate(tab.history[tab.histIdx],false);} } else if(mod&&e.key===']'){e.preventDefault(); if(tab.histIdx<tab.history.length-1){tab.histIdx++;navigate(tab.history[tab.histIdx],false);} } else if(mod&&e.key==='ArrowUp'){e.preventDefault(); if(tab.path) navigate(tab.path.split('/').slice(0,-1).join('/'));} else if(mod&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault(); doNewFolder();} else if(mod&&['1','2','3','4'].includes(e.key)){e.preventDefault(); tab.view=(['icons','list','columns','gallery'] as ViewMode[])[+e.key-1]; render();} else if(e.key==='ArrowRight'&&tab.view==='gallery'){e.preventDefault(); const l=listFor(tab.path); const i=l.findIndex(([n])=>tab.selected.has(n)); if(i>=0&&i<l.length-1){tab.selected=new Set([l[i+1][0]]); renderMain(); renderStatus();}} else if(!isSearchMode() && tab.view==='icons' && (e.key==='ArrowRight'||e.key==='ArrowLeft'||e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault(); const l=listFor(tab.path); if(!l.length) return; const itemW=tab.iconSize==='sm'?84:tab.iconSize==='lg'?120:104; const cols=Math.max(1,Math.floor((main.clientWidth||600)/itemW)); const cur=tab.anchor&&l.findIndex(([n])=>n===tab.anchor)>=0?l.findIndex(([n])=>n===tab.anchor):(l.findIndex(([n])=>tab.selected.has(n))>=0?l.findIndex(([n])=>tab.selected.has(n)):0); let ni=cur; if(e.key==='ArrowRight') ni=Math.min(l.length-1,cur+1); if(e.key==='ArrowLeft') ni=Math.max(0,cur-1); if(e.key==='ArrowDown') ni=Math.min(l.length-1,cur+cols); if(e.key==='ArrowUp') ni=Math.max(0,cur-cols); if(e.shiftKey && tab.anchor){ const ai=l.findIndex(([n])=>n===tab.anchor); const lo=Math.min(ai,ni), hi=Math.max(ai,ni); tab.selected=new Set(l.slice(lo,hi+1).map(x=>x[0])); } else { tab.selected=new Set([l[ni][0]]); tab.anchor=l[ni][0]; } renderMain(); renderStatus(); main.querySelector<HTMLElement>('[data-name="'+CSS.escape(l[ni][0])+'"]')?.scrollIntoView({block:'nearest'});} else if(tab.view==='list' && (e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault(); const l=listFor(tab.path); if(!l.length) return; const cur=tab.anchor&&l.findIndex(([n])=>n===tab.anchor)>=0?l.findIndex(([n])=>n===tab.anchor):0; const ni=e.key==='ArrowDown'?Math.min(l.length-1,cur+1):Math.max(0,cur-1); if(e.shiftKey && tab.anchor){ const ai=l.findIndex(([n])=>n===tab.anchor); const lo=Math.min(ai,ni), hi=Math.max(ai,ni); tab.selected=new Set(l.slice(lo,hi+1).map(x=>x[0])); } else { tab.selected=new Set([l[ni][0]]); tab.anchor=l[ni][0]; } renderMain(); renderStatus();} else if((e.key==='Home'||e.key==='End') && !e.ctrlKey){ const l=listFor(tab.path); if(l.length){ e.preventDefault(); const ni=e.key==='Home'?0:l.length-1; tab.selected=new Set([l[ni][0]]); tab.anchor=l[ni][0]; renderMain(); renderStatus(); } } else if(e.key==='ArrowLeft'&&tab.view==='gallery'){e.preventDefault(); const l=listFor(tab.path); const i=l.findIndex(([n])=>tab.selected.has(n)); if(i>0){tab.selected=new Set([l[i-1][0]]); renderMain(); renderStatus();}} else if(e.key===' '&&!e.repeat&&tab.selected.size===1){ e.preventDefault(); const k=[...tab.selected][0]; const n=inTrash()?k.split('|')[0]:k; const node=nodeFor(tab.path,k); if(node) showQuickLook(n,node);} else if(e.key==='Delete'||e.key==='Backspace'){ if(tab.selected.size){e.preventDefault(); doDelete();}} else if(!inTrash()&&e.key==='F2'&&tab.selected.size===1){ tab.renaming=[...tab.selected][0]; renderMain(); } else if(e.key==='Enter'&&tab.selected.size===1){ const k=[...tab.selected][0]; if(inTrash()) restoreFromTrash(k.split('|').pop()!); else { const node=nodeFor(tab.path,k); if(node) openItem(k,node,fp(tab.path,k)); } } else if(e.key==='Escape'){ if(qlCtrl) closeQL(); else {tab.selected.clear(); closeCtx(); render();} } else if(e.key.length===1&&!mod&&!e.ctrlKey&&!e.altKey){ const ch=e.key.toLowerCase(); const hit=listFor(tab.path).find(([n])=> (inTrash()?n.split('|')[0]:n).toLowerCase().startsWith(ch)); if(hit){tab.selected=new Set([hit[0]]); tab.anchor=hit[0]; render();} } });

    const renderLive = () => {
      if (!root.isConnected) return;
      tab.scrollTop = main.scrollTop;
      const keepSel = new Set(tab.selected);
      render();
      tab.selected = keepSel;
      requestAnimationFrame(() => { main.scrollTop = tab.scrollTop || 0; });
    };
    SettingsStore.subscribe('finder.showHidden', renderLive);
    SettingsStore.subscribe('finder.showExtensions', renderLive);
    SettingsStore.subscribe('finder.iconSize', (v) => { if (v==='sm'||v==='md'||v==='lg') { tab.iconSize = v; renderLive(); } });

    const onVfs=()=>{ if(root.isConnected) render(); else EventBus.off('vfsChanged',onVfs); };
    EventBus.on('vfsChanged', onVfs);
    render(); setTimeout(()=>root.focus(),0);
    return root;
  },
};
