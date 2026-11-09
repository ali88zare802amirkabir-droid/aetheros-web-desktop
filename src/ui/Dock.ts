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
  dock.appendChild(nexus);
  const sepN = document.createElement('div');
  sepN.className = 'dock-sep';
  dock.appendChild(sepN);

  for (const app of AppRegistry.list()) {
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
        // Windows-like toggle: minimize active instance if it's the focused one
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
      e.preventDefault(); hidePreview();
      const wins = State.state.windows.filter(w => w.appId === app.id);
      const m = document.createElement('div'); m.className = 'context-menu dock-ctx';
      if (!wins.length) {
        const oi=document.createElement('div'); oi.className='context-menu-item'; oi.textContent=`Open ${app.name}`; oi.onclick=()=>{ m.remove(); EventBus.emit('openApp', app.id); }; m.appendChild(oi);
      } else {
        wins.forEach(w => { const it = document.createElement('div'); it.className='context-menu-item'; it.textContent = (w.isMinimized?'○ ':'● ') + w.title + (State.state.activeWindowId===w.id?'  ✓':''); it.onclick=()=>{ m.remove(); WindowManager.restoreWindow(w.id); WindowManager.focusWindow(w.id); }; m.appendChild(it); });
        const sep=document.createElement('div'); sep.className='fm-menu-sep'; m.appendChild(sep);
        const ni=document.createElement('div'); ni.className='context-menu-item'; ni.textContent='New Window'; ni.onclick=()=>{ m.remove(); EventBus.emit('openApp', {id: app.id, newInstance: true} as any); }; m.appendChild(ni);
        const ci=document.createElement('div'); ci.className='context-menu-item'; ci.textContent='Close All'; ci.onclick=()=>{ m.remove(); [...wins].forEach(w => WindowManager.closeWindow(w.id)); }; m.appendChild(ci);
      }
      document.body.appendChild(m);
      m.style.left=Math.min(e.clientX, innerWidth-200)+'px';
      const pos = SettingsStore.get('dock.position') as string || 'bottom';
      if (pos === 'bottom') m.style.top=(innerHeight-70-m.offsetHeight)+'px'; else m.style.top=Math.min(e.clientY, innerHeight-m.offsetHeight-8)+'px';
      setTimeout(()=>document.addEventListener('mousedown',()=>m.remove(),{once:true}),0);
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
