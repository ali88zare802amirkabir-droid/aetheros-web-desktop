import { AppRegistry } from '../core/AppRegistry';
import { EventBus } from '../core/EventBus';
import { State } from '../core/State';
import { WindowManager } from '../core/WindowManager';
import { SettingsStore } from '../apps/settings/store';

let hideTimer: number | null = null;
let revealZone: HTMLElement | null = null;
let previewEl: HTMLElement | null = null;
let previewTimer: number | null = null;
let previewAppId: string | null = null;
let trayIv: number | null = null;

const PIN_KEY = 'dock.unpinned.v1';
function getUnpinned(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || '[]')); } catch { return new Set(); } }
function setUnpinned(s: Set<string>) { try { localStorage.setItem(PIN_KEY, JSON.stringify([...s])); } catch {} }
function isPinned(id: string) { return !getUnpinned().has(id); }
function togglePin(id: string) { const s = getUnpinned(); if (s.has(id)) s.delete(id); else s.add(id); setUnpinned(s); render(); }

function getDock() { return document.getElementById('dock') as HTMLElement | null; }
function esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function ensureRevealZone() {
  if (!revealZone) {
    revealZone = document.createElement('div');
    revealZone.className = 'dock-reveal-zone';
    document.body.appendChild(revealZone);
  }
  const pos = SettingsStore.get('dock.position') as string || document.documentElement.dataset.dockPos || 'bottom';
  revealZone.dataset.position = pos;
  return revealZone;
}

function applySettings() {
  const dock = getDock(); if (!dock) return;
  const pos = SettingsStore.get('dock.position') as string || 'bottom';
  const mag = !!SettingsStore.get('dock.magnification');
  const autoHide = !!SettingsStore.get('dock.autoHide');
  dock.dataset.position = pos;
  document.documentElement.dataset.dockPos = pos;
  dock.classList.toggle('mag', mag);
  dock.classList.toggle('autohide', autoHide);
  if (!autoHide) dock.classList.add('reveal'); else dock.classList.remove('reveal');
  ensureRevealZone().style.display = autoHide ? 'block' : 'none';
  WindowManager.constrainWindows();
}

function wireAutoHide() {
  const dock = getDock(); if (!dock) return;
  const zone = ensureRevealZone();
  const reveal = () => { if (!SettingsStore.get('dock.autoHide')) return; if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; } dock.classList.add('reveal'); };
  const scheduleHide = () => { if (!SettingsStore.get('dock.autoHide')) return; if (hideTimer) window.clearTimeout(hideTimer); hideTimer = window.setTimeout(() => dock.classList.remove('reveal'), 350) as unknown as number; };
  dock.addEventListener('mouseenter', reveal);
  dock.addEventListener('mouseleave', scheduleHide);
  zone.addEventListener('mouseenter', reveal);
  zone.addEventListener('mouseleave', scheduleHide);
}

function hidePreview() {
  if (previewTimer) { window.clearTimeout(previewTimer); previewTimer = null; }
  previewAppId = null;
  previewEl?.classList.remove('show');
}

function showPreview(anchor: HTMLElement, appId: string) {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    const wins = State.state.windows.filter(w => w.appId === appId);
    const app = AppRegistry.get(appId);
    if (!wins.length || !app) { hidePreview(); return; }
    if (!previewEl) {
      previewEl = document.createElement('div');
      previewEl.className = 'dock-preview';
      previewEl.addEventListener('mouseleave', hidePreview);
      previewEl.addEventListener('mouseenter', () => { if (previewTimer) window.clearTimeout(previewTimer); });
      document.body.appendChild(previewEl);
    }
    previewAppId = appId;
    previewEl.innerHTML = `
      <div class="dock-preview-head"><img src="${esc(app.icon)}" alt="" /><span>${esc(app.name)}</span><span class="dock-preview-count">${wins.length}</span></div>
      <div class="dock-preview-list">${wins.map(w => `
        <button type="button" class="dock-preview-item${w.id === State.state.activeWindowId ? ' is-active' : ''}${w.isMinimized ? ' is-min' : ''}" data-win="${esc(w.id)}">
          <span class="dock-preview-dot"></span>
          <span class="dock-preview-title">${esc(w.title || app.name)}</span>
          <span class="dock-preview-state">${w.isMinimized ? 'Minimized' : (w.id === State.state.activeWindowId ? 'Active' : 'Open')}</span>
        </button>`).join('')}</div>`;
    previewEl.querySelectorAll('[data-win]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.win!;
        hidePreview();
        WindowManager.restoreWindow(id);
        WindowManager.focusWindow(id);
      });
    });
    const r = anchor.getBoundingClientRect();
    const pos = SettingsStore.get('dock.position') as string || 'bottom';
    previewEl.classList.add('show');
    const pw = Math.min(320, previewEl.offsetWidth || 280);
    if (pos === 'left') {
      previewEl.style.left = `${r.right + 10}px`;
      previewEl.style.top = `${Math.max(8, Math.min(window.innerHeight - 160, r.top + r.height / 2 - 60))}px`;
      previewEl.style.bottom = 'auto'; previewEl.style.right = 'auto';
    } else if (pos === 'right') {
      previewEl.style.left = 'auto'; previewEl.style.right = `${window.innerWidth - r.left + 10}px`;
      previewEl.style.top = `${Math.max(8, Math.min(window.innerHeight - 160, r.top + r.height / 2 - 60))}px`; previewEl.style.bottom = 'auto';
    } else {
      const left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left + r.width / 2 - pw / 2));
      previewEl.style.left = `${left}px`; previewEl.style.right = 'auto';
      previewEl.style.top = 'auto'; previewEl.style.bottom = `${window.innerHeight - r.top + 10}px`;
    }
  }, 380) as unknown as number;
}

function appState(appId: string) {
  const wins = State.state.windows.filter(w => w.appId === appId);
  const focused = State.state.focusedAppId === appId;
  return { wins, running: wins.length > 0, focused, count: wins.length, anyMin: wins.some(w => w.isMinimized) };
}

function removeMenus() { document.querySelectorAll('.context-menu, .win-jumplist').forEach(m => m.remove()); }
function mountMenu(m: HTMLElement, x: number, y: number, fromBottom = false) {
  document.body.appendChild(m);
  const pad = 8;
  const w = m.offsetWidth || 240;
  const h = m.offsetHeight || 120;
  m.style.left = Math.max(pad, Math.min(x, window.innerWidth - w - pad)) + 'px';
  if (fromBottom) m.style.top = Math.max(pad, window.innerHeight - 64 - h) + 'px';
  else m.style.top = Math.max(pad, Math.min(y, window.innerHeight - h - pad)) + 'px';
  window.setTimeout(() => document.addEventListener('mousedown', (ev) => { if (!(ev.target as HTMLElement).closest('.context-menu,.win-jumplist')) m.remove(); }, { once: true }), 0);
  window.setTimeout(() => document.addEventListener('contextmenu', (ev) => { if (!(ev.target as HTMLElement).closest('.context-menu,.win-jumplist')) m.remove(); }, { once: true }), 0);
}

const pinSvg = (pinned: boolean) => pinned
  ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182a.5.5 0 1 1-.707-.707l3.182-3.182L2.404 7.233a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg>`
  : `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="opacity:.72"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182a.5.5 0 1 1-.707-.707l3.182-3.182L2.404 7.233a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146zm.364 1.768-3.533 3.533a.5.5 0 0 1-.496.12 4.923 4.923 0 0 0-1.036-.19c-.54-.036-1.028.06-1.338.29L7.06 9.515a.5.5 0 0 1 0 .707l-3.182 3.182 3.182-3.182a.5.5 0 0 1 .707 0l3.272 3.273c.23-.31.327-.798.29-1.338a4.922 4.922 0 0 0-.19-1.036.5.5 0 0 1 .12-.496l3.533-3.533-4.408-4.408z"/></svg>`;

function showAppJumpList(x: number, y: number, app: { id: string; name: string; icon: string }) {
  removeMenus();
  const wins = State.state.windows.filter(w => w.appId === app.id);
  const pinned = isPinned(app.id);
  const pos = SettingsStore.get('dock.position') as string || 'bottom';
  const m = document.createElement('div');
  m.className = 'context-menu win11-menu dock-ctx win-jumplist';
  m.setAttribute('role', 'menu');
  m.innerHTML = `
    <div class="win-jl-header" data-act="open-main" role="menuitem" tabindex="0">
      <img class="win-jl-appicon" src="${esc(app.icon)}" alt="" />
      <span class="win-jl-appname">${esc(app.name)}</span>
      <button type="button" class="win-jl-pin${pinned ? ' is-pinned' : ''}" data-act="pin" title="${pinned ? 'Unpin from taskbar' : 'Pin to taskbar'}" aria-label="${pinned ? 'Unpin from taskbar' : 'Pin to taskbar'}">${pinSvg(pinned)}</button>
    </div>
    ${wins.length ? `<div class="win-jl-sep"></div><div class="win-jl-group" aria-label="Open windows">${wins.map(w => `
      <div class="win-jl-item" data-win="${esc(w.id)}" role="menuitem" tabindex="0">
        <span class="win-jl-wdot${w.id === State.state.activeWindowId ? ' is-active' : ''}${w.isMinimized ? ' is-min' : ''}" aria-hidden="true"></span>
        <span class="win-jl-wtitle">${esc(w.title || app.name)}</span>
        <button type="button" class="win-jl-close" data-close="${esc(w.id)}" title="Close window" aria-label="Close window"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1l8 8M9 1 1 9"/></svg></button>
      </div>`).join('')}</div>` : ''}
    <div class="win-jl-sep"></div>
    <div class="win-jl-actions" role="group">
      ${!wins.length ? `<button type="button" class="win-jl-action" data-act="open" role="menuitem"><span class="win-jl-aicon"></span><span>${esc(app.name)}</span></button>` : ''}
      <button type="button" class="win-jl-action" data-act="new" role="menuitem"><span class="win-jl-aicon"></span><span>New window</span></button>
      ${wins.length ? `<button type="button" class="win-jl-action" data-act="closeall" role="menuitem"><span class="win-jl-aicon"></span><span>${wins.length > 1 ? 'Close all windows' : 'Close window'}</span></button>` : ''}
      <button type="button" class="win-jl-action" data-act="pintext" role="menuitem"><span class="win-jl-aicon win-jl-aicon-pin">${pinSvg(pinned)}</span><span>${pinned ? 'Unpin from taskbar' : 'Pin to taskbar'}</span></button>
    </div>`;
  m.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const closeBtn = t.closest('[data-close]') as HTMLElement | null;
    if (closeBtn?.dataset.close) { e.stopPropagation(); WindowManager.closeWindow(closeBtn.dataset.close); m.remove(); return; }
    const winItem = t.closest('[data-win]') as HTMLElement | null;
    if (winItem?.dataset.win) { m.remove(); WindowManager.restoreWindow(winItem.dataset.win); WindowManager.focusWindow(winItem.dataset.win); return; }
    const act = (t.closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (!act) return;
    m.remove();
    if (act === 'open' || act === 'open-main') EventBus.emit('openApp', app.id);
    if (act === 'new') EventBus.emit('openApp', { id: app.id, newInstance: true } as any);
    if (act === 'closeall') [...wins].forEach(w => WindowManager.closeWindow(w.id));
    if (act === 'pin' || act === 'pintext') togglePin(app.id);
  });
  mountMenu(m, x, y, pos === 'bottom');
}

function showTaskbarMenu(x: number, y: number) {
  removeMenus();
  const pos = SettingsStore.get('dock.position') as string || 'bottom';
  const m = document.createElement('div');
  m.className = 'context-menu win11-menu dock-ctx win-taskbar-menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = `
    <div class="win-jl-actions" role="group">
      <button type="button" class="win-jl-action" data-act="settings" role="menuitem">
        <span class="win-jl-aicon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6Z"/></svg></span>
        <span>Taskbar settings</span>
      </button>
      <div class="win-jl-sep"></div>
      <button type="button" class="win-jl-action" data-act="desktop" role="menuitem">
        <span class="win-jl-aicon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="12" height="9" rx="1"/><path d="M8 12v2M5 14h6"/></svg></span>
        <span>Show the desktop</span>
      </button>
    </div>`;
  m.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!act?.dataset.act) return;
    m.remove();
    if (act.dataset.act === 'settings') WindowManager.openApp({ id: 'settings' } as any);
    if (act.dataset.act === 'desktop') State.state.windows.forEach(w => { if (!w.isMinimized) WindowManager.minimizeWindow(w.id); });
  });
  mountMenu(m, x, y, pos === 'bottom');
}

function render(): void {
  hidePreview();
  if (trayIv) { window.clearInterval(trayIv); trayIv = null; }
  const dock = getDock()!;
  dock.innerHTML = '';
  const nexus = document.createElement('div');
  nexus.className = 'dock-icon dock-nexus';
  nexus.setAttribute('aria-label', 'Nexus');
  nexus.title = 'Nexus';
  nexus.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3z"/><path d="M12 8v8M8 12h8" opacity=".55"/></svg><div class="dock-label">Nexus</div>`;
  nexus.addEventListener('click', () => document.dispatchEvent(new CustomEvent('nexus:toggle')));
  nexus.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); hidePreview(); showTaskbarMenu(e.clientX, e.clientY); });
  dock.appendChild(nexus);
  const sepN = document.createElement('div');
  sepN.className = 'dock-sep';
  dock.appendChild(sepN);

  const allApps = AppRegistry.list();
  const dockApps = allApps.filter(a => isPinned(a.id) || State.state.windows.some(w => w.appId === a.id));
  for (const app of dockApps) {
    const st = appState(app.id);
    const el = document.createElement('div');
    el.className = 'dock-icon' + (st.running ? ' running' : '') + (st.focused ? ' active' : '');
    el.dataset.appId = app.id;
    const label = st.running && st.count > 1 ? `${app.name} (${st.count})` : app.name;
    el.innerHTML = `<img src="${esc(app.icon)}" alt="${esc(app.name)}"><span class="run-indicator" aria-hidden="true"></span><div class="dock-label">${esc(label)}</div>`;
    el.addEventListener('click', () => {
      const wins = State.state.windows.filter(w => w.appId === app.id);
      if (!wins.length) { EventBus.emit('openApp', app.id); return; }
      const active = wins.find(w => w.id === State.state.activeWindowId);
      if (active && !active.isMinimized) {
        if (wins.length === 1) { WindowManager.minimizeWindow(active.id); return; }
      }
      if (wins.length > 1) {
        const activeIdx = wins.findIndex(w => w.id === State.state.activeWindowId && !w.isMinimized);
        if (activeIdx >= 0) { const next = wins[(activeIdx + 1) % wins.length]; WindowManager.restoreWindow(next.id); WindowManager.focusWindow(next.id); return; }
        const min = wins.find(w => w.isMinimized);
        if (min) { WindowManager.restoreWindow(min.id); return; }
        WindowManager.focusWindow(wins[0].id); return;
      }
      const w = wins[0];
      if (w.isMinimized) WindowManager.restoreWindow(w.id);
      else WindowManager.focusWindow(w.id);
    });
    el.addEventListener('mouseenter', () => { if (st.running) showPreview(el, app.id); });
    el.addEventListener('mouseleave', () => { if (previewTimer) { window.clearTimeout(previewTimer); previewTimer = null; } window.setTimeout(() => { if (previewEl && !previewEl.matches(':hover')) hidePreview(); }, 120); });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation(); hidePreview();
      showAppJumpList(e.clientX, e.clientY, app);
    });
    dock.appendChild(el);
  }

  if (State.state.minimizedWindows.length) {
    const sep = document.createElement('div');
    sep.className = 'dock-sep';
    dock.appendChild(sep);
  }
  // System tray / taskbar details (Windows-like clock + show desktop)
  const pos = SettingsStore.get('dock.position') as string || 'bottom';
  if (pos === 'bottom') {
    const sepT = document.createElement('div');
    sepT.className = 'dock-sep';
    dock.appendChild(sepT);
    const tray = document.createElement('div');
    tray.className = 'dock-tray';
    tray.innerHTML = `<div class="dock-tray-clock" data-k="dclock" aria-label="Clock"></div><button type="button" class="dock-show-desktop" title="Show Desktop" aria-label="Show Desktop"></button>`;
    const tickTray = () => {
      const c = tray.querySelector('[data-k="dclock"]');
      if (!c) return;
      const d = new Date();
      const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dt = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      c.innerHTML = `<span class="dock-tray-time">${esc(t)}</span><span class="dock-tray-date">${esc(dt)}</span>`;
    };
    tickTray();
    trayIv = window.setInterval(tickTray, 15000) as unknown as number;
    tray.querySelector('.dock-show-desktop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      State.state.windows.forEach(w => { if (!w.isMinimized) WindowManager.minimizeWindow(w.id); });
    });
    dock.appendChild(tray);
  }
  updateIndicators();
}

function updateIndicators(): void {
  document.querySelectorAll<HTMLElement>('#dock .dock-icon[data-app-id]').forEach((el) => {
    const id = el.dataset.appId!;
    const st = appState(id);
    el.classList.toggle('running', st.running);
    el.classList.toggle('active', st.focused);
    const lbl = el.querySelector('.dock-label');
    const app = AppRegistry.get(id);
    if (lbl && app) lbl.textContent = st.running && st.count > 1 ? `${app.name} (${st.count})` : app.name;
  });
}

export const Dock = {
  init(): void {
    render();
    applySettings();
    wireAutoHide();
    const dock = getDock();
    dock?.addEventListener('contextmenu', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.dock-icon') || t.closest('.dock-preview')) return;
      if (t.closest('.dock-show-desktop')) return;
      e.preventDefault(); hidePreview();
      showTaskbarMenu(e.clientX, e.clientY);
    });
    SettingsStore.subscribe('dock.position', () => applySettings());
    SettingsStore.subscribe('dock.size', () => applySettings());
    SettingsStore.subscribe('dock.magnification', () => applySettings());
    SettingsStore.subscribe('dock.autoHide', () => applySettings());
    EventBus.on('appsChanged', render);
    EventBus.on('windowMinimized', render);
    EventBus.on('windowRestored', render);
    EventBus.on('windowClosed', () => { render(); });
    EventBus.on('windowFocused', render);
  },
};
