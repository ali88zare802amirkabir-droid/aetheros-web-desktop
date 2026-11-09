import { VFS } from '../core/VFS';
import { EventBus } from '../core/EventBus';
import { SettingsStore } from '../apps/settings/store';
import { State } from '../core/State';
import { WindowManager } from '../core/WindowManager';
import { OpenWith } from '../core/OpenWith';
import type { VFSNode, TrashEntry } from '../core/types';
import { folderIcon, fileIcon } from './icons';

type SysId = 'sys-computer' | 'sys-terminal' | 'sys-settings' | 'sys-trash';
type DesktopItem = {
  key: string;
  name: string;
  kind: 'system' | 'folder' | 'file';
  node?: VFSNode;
  icon: string;
  systemId?: SysId;
};

type Clip = { op: 'copy' | 'cut'; names: string[]; parent: '' } | null;
let clip: Clip = null;
let selected = new Set<string>();
let anchor: string | null = null;
let menu: HTMLElement | null = null;
let marquee: HTMLElement | null = null;
let marqueeStart: { x: number; y: number } | null = null;
let propsEl: HTMLElement | null = null;

const SORT_KEY = 'desktop.sortBy';
function sortBy(): 'name' | 'date' {
  try { return (localStorage.getItem(SORT_KEY) as any) === 'date' ? 'date' : 'name'; } catch { return 'name'; }
}
function setSortBy(v: 'name' | 'date') { try { localStorage.setItem(SORT_KEY, v); } catch {} }

function esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function closeMenu() { menu?.remove(); menu = null; }
function closeProps() { propsEl?.remove(); propsEl = null; }

function trashIconSvg(full: boolean) {
  const accent = full ? '#f59e0b' : '#6366f1';
  const lid = full ? '#fbbf24' : '#a78bfa';
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M20 18h24l-2 32H22z" fill="${accent}"/><rect x="16" y="14" width="32" height="6" rx="2" fill="${lid}"/><rect x="27" y="10" width="10" height="6" rx="2" fill="#8b5cf6"/>${full ? '<path d="M24 26h16M23 32h18" stroke="rgba(255,255,255,.55)" stroke-width="2"/>' : ''}</svg>`);
}

function systemItems(): DesktopItem[] {
  const full = (State.state.trash?.length || 0) > 0;
  return [
    { key: 'sys-computer', systemId: 'sys-computer', name: 'This PC', kind: 'system', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="10" width="48" height="34" rx="4" fill="#8b5cf6"/><rect x="14" y="16" width="36" height="22" rx="2" fill="#1a1038"/><rect x="26" y="46" width="12" height="4" fill="#a78bfa"/><rect x="20" y="50" width="24" height="4" rx="2" fill="#8b5cf6"/></svg>') },
    { key: 'sys-terminal', systemId: 'sys-terminal', name: 'Terminal', kind: 'system', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="44" rx="6" fill="#1d1d1f"/><path d="M16 24l8 8-8 8M28 40h14" stroke="#22d3ee" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>') },
    { key: 'sys-settings', systemId: 'sys-settings', name: 'Control Panel', kind: 'system', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="10" fill="#a78bfa"/><path d="M32 14v6M32 44v6M14 32h6M44 32h6M19 19l4 4M41 41l4 4M45 19l-4 4M23 41l-4 4" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/></svg>') },
    { key: 'sys-trash', systemId: 'sys-trash', name: full ? `Recycle Bin (${State.state.trash!.length})` : 'Recycle Bin', kind: 'system', icon: trashIconSvg(full) },
  ];
}

function vfsItems(): DesktopItem[] {
  const children = VFS.root.children ?? {};
  const arr = Object.entries(children).map(([name, node]) => ({
    key: `v:${name}`,
    name,
    kind: node.type,
    node,
    icon: node.type === 'folder' ? folderIcon : fileIcon,
  } as DesktopItem));
  const sb = sortBy();
  arr.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    if (sb === 'date') return (b.node?.modified || 0) - (a.node?.modified || 0);
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  return arr;
}

function allItems() { return [...systemItems(), ...vfsItems()]; }

function openSystem(id?: SysId) {
  if (id === 'sys-computer' || id === 'sys-trash') WindowManager.openApp({ id: 'finder' });
  else if (id === 'sys-terminal') WindowManager.openApp({ id: 'terminal' });
  else if (id === 'sys-settings') WindowManager.openApp({ id: 'settings' });
}

function openVfs(item: DesktopItem) {
  if (!item.node) return;
  if (item.node.type === 'folder') {
    WindowManager.openApp({ id: 'finder', args: { path: item.name } });
    return;
  }
  const handlers = OpenWith.resolve(item.node, item.name);
  const appId = handlers[0] || 'editor';
  try { WindowManager.openApp({ id: appId, args: { path: item.name } }); }
  catch { try { WindowManager.openApp({ id: 'editor', args: { path: item.name } }); } catch {} }
}

function openSelected() {
  for (const k of selected) {
    const it = allItems().find(i => i.key === k);
    if (!it) continue;
    if (it.kind === 'system') openSystem(it.systemId);
    else openVfs(it);
  }
}

function moveToTrash(names: string[]) {
  const items: TrashEntry[] = [];
  for (const n of names) {
    const node = VFS.getNode(n);
    if (!node) continue;
    try {
      VFS.deleteNode('', n);
      items.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, name: n, from: '', deletedAt: Date.now(), node: JSON.parse(JSON.stringify(node)) });
    } catch {}
  }
  if (items.length) State.update({ trash: [...items, ...(State.state.trash || [])] });
}

function selectedVfsNames(): string[] {
  return [...selected].map(k => k.startsWith('v:') ? k.slice(2) : '').filter(Boolean);
}

function doCopy(op: 'copy' | 'cut') {
  const names = selectedVfsNames();
  if (!names.length) return;
  clip = { op, names, parent: '' };
  render();
}
function doPaste() {
  if (!clip) return;
  const names = [...clip.names];
  if (clip.op === 'cut') {
    for (const n of names) { try { VFS.moveNode(clip.parent, n, ''); } catch {} }
    clip = null;
  } else {
    for (const n of names) { try { VFS.copyNode(clip.parent, n, ''); } catch {} }
  }
  render();
}

function renameItem(name: string) {
  const nn = window.prompt('Rename', name);
  if (!nn || nn === name) return;
  try { VFS.renameNode('', name, nn); }
  catch (e) { window.alert((e as Error).message || 'Rename failed'); }
}

function newFolder() {
  let base = 'New Folder', name = base, i = 2;
  while (VFS.getNode(name)) name = `${base} ${i++}`;
  try { VFS.createFolder('', name); selected = new Set([`v:${name}`]); anchor = `v:${name}`; render(); }
  catch (e) { window.alert((e as Error).message || 'Failed'); }
}
function newTextFile() {
  let base = 'New Text File.txt', name = base, i = 2;
  while (VFS.getNode(name)) name = `New Text File ${i++}.txt`;
  try { VFS.createFile('', name, ''); selected = new Set([`v:${name}`]); anchor = `v:${name}`; render(); }
  catch (e) { window.alert((e as Error).message || 'Failed'); }
}

function showProperties(item: DesktopItem) {
  closeProps();
  propsEl = document.createElement('div');
  propsEl.className = 'context-menu desktop-props';
  const lines: [string, string][] = [['Name', item.name], ['Type', item.kind === 'system' ? 'System item' : item.kind]];
  if (item.node) {
    if (item.node.modified) lines.push(['Modified', new Date(item.node.modified).toLocaleString()]);
    if (item.node.type === 'file') lines.push(['Size', `${item.node.size ?? (item.node.content?.length || 0)} bytes`]);
  }
  if (item.systemId === 'sys-trash') lines.push(['Items', String(State.state.trash?.length || 0)]);
  propsEl.innerHTML = `<div class="desktop-props-title">${esc(item.name)}</div>${lines.map(([k,v])=>`<div class="desktop-props-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}<div class="desktop-props-actions"><button data-close="1">Close</button></div>`;
  Object.assign(propsEl.style, { position:'fixed', left:'50%', top:'50%', transform:'translate(-50%,-50%)', minWidth:'280px', zIndex:'9001' });
  propsEl.addEventListener('click', (e)=>{ if ((e.target as HTMLElement).closest('[data-close]')) closeProps(); });
  document.body.appendChild(propsEl);
}

function menuItem(label: string, fn: () => void, opts?: { disabled?: boolean; danger?: boolean }) {
  const it = document.createElement('div');
  it.className = 'context-menu-item' + (opts?.disabled ? ' dis' : '') + (opts?.danger ? ' danger' : '');
  it.textContent = label;
  if (!opts?.disabled) it.addEventListener('click', () => { closeMenu(); fn(); });
  return it;
}
function menuSep() { const s = document.createElement('div'); s.className = 'fm-menu-sep'; return s; }

function showDesktopMenu(x: number, y: number) {
  closeMenu(); closeProps();
  menu = document.createElement('div');
  menu.className = 'context-menu desktop-menu';
  menu.style.left = `${x}px`; menu.style.top = `${y}px`;
  const sb = sortBy();
  menu.append(
    menuItem('New Folder', newFolder),
    menuItem('New Text File', newTextFile),
    menuSep(),
    menuItem(clip ? `Paste${clip.op==='cut'?' (Move)':''}` : 'Paste', doPaste, { disabled: !clip }),
    menuSep(),
    menuItem(`Sort by Name${sb==='name'?' ✓':''}`, () => { setSortBy('name'); render(); }),
    menuItem(`Sort by Date${sb==='date'?' ✓':''}`, () => { setSortBy('date'); render(); }),
    menuSep(),
    menuItem('Open in Finder', () => WindowManager.openApp({ id: 'finder' })),
    menuItem('Refresh', render),
    menuItem('Settings', () => WindowManager.openApp({ id: 'settings' })),
  );
  document.body.appendChild(menu);
}

function showItemMenu(x: number, y: number, item: DesktopItem) {
  closeMenu(); closeProps();
  if (!selected.has(item.key)) { selected = new Set([item.key]); anchor = item.key; render(); }
  menu = document.createElement('div');
  menu.className = 'context-menu desktop-menu';
  menu.style.left = `${x}px`; menu.style.top = `${y}px`;
  const vNames = selectedVfsNames();
  const onlyOneVfs = vNames.length === 1;
  const isVfs = item.kind !== 'system';

  if (item.systemId === 'sys-trash') {
    menu.append(
      menuItem('Open', () => WindowManager.openApp({ id: 'finder' })),
      menuItem('Empty Recycle Bin', () => { State.update({ trash: [] }); render(); }, { disabled: !(State.state.trash?.length) }),
      menuSep(),
      menuItem('Properties', () => showProperties(item)),
    );
  } else {
    menu.append(menuItem('Open', openSelected));
    if (item.kind === 'file' && onlyOneVfs) {
      const handlers = OpenWith.resolve(item.node!, item.name).filter(id => id !== 'editor');
      if (handlers.length) menu.append(menuItem(`Open With (${handlers[0]})`, () => WindowManager.openApp({ id: handlers[0], args: { path: item.name } })));
    }
    menu.append(menuSep());
    menu.append(
      menuItem('Cut', () => doCopy('cut'), { disabled: !isVfs && vNames.length === 0 }),
      menuItem('Copy', () => doCopy('copy'), { disabled: !isVfs && vNames.length === 0 }),
    );
    if (isVfs) {
      menu.append(menuSep());
      menu.append(
        menuItem('Rename', () => renameItem(item.name), { disabled: !onlyOneVfs }),
        menuItem('Delete', () => { moveToTrash(vNames.length ? vNames : [item.name]); selected.clear(); render(); }, { danger: true }),
      );
    }
    menu.append(menuSep(), menuItem('Properties', () => showProperties(item)));
  }
  document.body.appendChild(menu);
  // keep in viewport
  const r = menu.getBoundingClientRect();
  if (r.right > innerWidth) menu.style.left = `${Math.max(4, innerWidth - r.width - 4)}px`;
  if (r.bottom > innerHeight) menu.style.top = `${Math.max(4, innerHeight - r.height - 4)}px`;
}

function render(): void {
  const desk = document.getElementById('desktop');
  if (!desk) return;
  desk.querySelectorAll('.desktop-icon,.desktop-marquee').forEach(n => n.remove());
  desk.setAttribute('role', 'application');
  desk.setAttribute('aria-label', 'Desktop');
  desk.tabIndex = 0;
  closeMenu();

  const items = allItems();
  // prune selection
  const valid = new Set(items.map(i => i.key));
  selected = new Set([...selected].filter(k => valid.has(k)));

  const iconSize = Math.max(40, Math.min(96, +(SettingsStore.get('desktop.iconSize') as number) || 64));
  const pos = (SettingsStore.get('desktop.iconPosition') as string) === 'right' ? 'right' : 'left';
  const gapY = Math.max(92, iconSize + 34);
  const colW = Math.max(88, iconSize + 28);
  const pad = 14;
  const top0 = 14;
  const maxH = Math.max(200, desk.clientHeight - 20);
  const perCol = Math.max(1, Math.floor((maxH - top0) / gapY));

  items.forEach((item, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const el = document.createElement('div');
    el.className = 'desktop-icon' + (selected.has(item.key) ? ' selected' : '') + (item.kind === 'system' ? ' desktop-system' : '') + (clip?.op === 'cut' && item.kind !== 'system' && clip.names.includes(item.name) ? ' is-cut' : '');
    el.dataset.key = item.key;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', item.name);
    el.style.top = `${top0 + row * gapY}px`;
    if (pos === 'left') { el.style.left = `${pad + col * colW}px`; el.style.right = 'auto'; }
    else { el.style.right = `${pad + col * colW}px`; el.style.left = 'auto'; }
    el.innerHTML = `<span class="desktop-icon-img"><img src="${item.icon}" alt="" style="width:${iconSize}px;height:${iconSize}px"></span><span class="desktop-icon-label">${esc(item.name)}</span>`;
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const multi = e.ctrlKey || e.metaKey;
      const range = e.shiftKey && anchor;
      if (range) {
        const keys = allItems().map(it => it.key);
        const a = keys.indexOf(anchor!); const b = keys.indexOf(item.key);
        if (a >= 0 && b >= 0) {
          const [s,e2] = a < b ? [a,b] : [b,a];
          selected = new Set(keys.slice(s,e2+1));
        }
      } else if (multi) {
        if (selected.has(item.key)) selected.delete(item.key); else selected.add(item.key);
        anchor = item.key;
      } else {
        if (!selected.has(item.key)) selected = new Set([item.key]);
        anchor = item.key;
      }
      render();
    });
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (item.kind === 'system') openSystem(item.systemId);
      else openVfs(item);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      showItemMenu(e.clientX, e.clientY, item);
    });
    desk.appendChild(el);
  });
}

function onDeskMouseDown(e: MouseEvent) {
  const desk = document.getElementById('desktop');
  if (!desk || e.target !== desk || e.button !== 0) return;
  closeMenu(); closeProps();
  if (!e.ctrlKey && !e.metaKey) selected.clear();
  anchor = null; render();
  const rect = desk.getBoundingClientRect();
  marqueeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  marquee = document.createElement('div');
  marquee.className = 'desktop-marquee';
  desk.appendChild(marquee);
  const onMove = (ev: MouseEvent) => {
    if (!marqueeStart || !marquee) return;
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const l = Math.min(x, marqueeStart.x), t = Math.min(y, marqueeStart.y);
    const w = Math.abs(x - marqueeStart.x), h = Math.abs(y - marqueeStart.y);
    Object.assign(marquee.style, { left:`${l}px`, top:`${t}px`, width:`${w}px`, height:`${h}px` });
    const mr = { left: rect.left + l, top: rect.top + t, right: rect.left + l + w, bottom: rect.top + t + h };
    const hits = new Set<string>();
    desk.querySelectorAll<HTMLElement>('.desktop-icon').forEach(el => {
      const r = el.getBoundingClientRect();
      const inter = !(r.right < mr.left || r.left > mr.right || r.bottom < mr.top || r.top > mr.bottom);
      if (inter && el.dataset.key) hits.add(el.dataset.key);
    });
    selected = hits;
    desk.querySelectorAll<HTMLElement>('.desktop-icon').forEach(el => el.classList.toggle('selected', !!el.dataset.key && selected.has(el.dataset.key)));
  };
  const onUp = () => {
    marquee?.remove(); marquee = null; marqueeStart = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function onKey(e: KeyboardEvent) {
  const desk = document.getElementById('desktop');
  if (!desk) return;
  const active = document.activeElement as HTMLElement | null;
  const inDesktop = active === desk || (!!active && desk.contains(active));
  const inField = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as any).isContentEditable);
  if (inField) return;
  if (!inDesktop && !selected.size) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selected = new Set(allItems().map(i => i.key)); render(); return; }
  if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); doCopy('copy'); return; }
  if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); doCopy('cut'); return; }
  if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); doPaste(); return; }
  if (e.key === 'Escape') { selected.clear(); closeMenu(); closeProps(); render(); return; }
  if (e.key === 'F2') { const n = selectedVfsNames(); if (n.length === 1) renameItem(n[0]); return; }
  if (e.key === 'Enter') { if (selected.size) openSelected(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const n = selectedVfsNames(); if (n.length) { moveToTrash(n); selected.clear(); render(); }
  }
}

export const Desktop = {
  init(): void {
    render();
    const desk = document.getElementById('desktop')!;
    desk.addEventListener('mousedown', onDeskMouseDown);
    desk.addEventListener('contextmenu', (e) => { if (e.target === desk) { e.preventDefault(); showDesktopMenu(e.clientX, e.clientY); } });
    document.addEventListener('click', (e) => { if (!menu?.contains(e.target as Node)) closeMenu(); });
    document.addEventListener('keydown', onKey);
    EventBus.on('vfsChanged', render);
    EventBus.on('windowClosed', render); // trash changes may reflect via state patterns; safe
    window.addEventListener('storage', (e) => { if (e.key === 'webos_state') render(); });
    SettingsStore.subscribe('desktop.iconSize', render);
    SettingsStore.subscribe('desktop.iconPosition', render);
    window.addEventListener('resize', render);
  },
};