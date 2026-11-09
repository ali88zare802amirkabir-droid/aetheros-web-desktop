import { AppRegistry } from '../core/AppRegistry';
import { EventBus } from '../core/EventBus';
import { State } from '../core/State';
import { WindowManager } from '../core/WindowManager';
import { SettingsStore } from '../apps/settings/store';

let hideTimer: number | null = null;
let revealZone: HTMLElement | null = null;

function getDock() { return document.getElementById('dock') as HTMLElement | null; }

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

function render(): void {
  const dock = getDock()!;
  dock.innerHTML = '';
  // Nexus launcher — opens Spotlight (future command surface)
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
    const el = document.createElement('div');
    el.className = 'dock-icon';
    el.dataset.appId = app.id;
    el.innerHTML = `<img src="${app.icon}" alt="${app.name}"><div class="dock-label">${app.name}</div>`;
    el.addEventListener('click', () => {
      const wins = State.state.windows.filter(w => w.appId === app.id);
      if (wins.length > 1) {
        const activeIdx = wins.findIndex(w => w.id === State.state.activeWindowId && !w.isMinimized);
        if (activeIdx >= 0) { const next = wins[(activeIdx + 1) % wins.length]; WindowManager.restoreWindow(next.id); WindowManager.focusWindow(next.id); return; }
        const min = wins.find(w => w.isMinimized);
        if (min) { WindowManager.restoreWindow(min.id); return; }
        WindowManager.focusWindow(wins[0].id); return;
      }
      EventBus.emit('openApp', app.id);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const wins = State.state.windows.filter(w => w.appId === app.id);
      if (!wins.length) return;
      const m = document.createElement('div'); m.className = 'context-menu';
      wins.forEach(w => { const it = document.createElement('div'); it.className='context-menu-item'; it.textContent = (w.isMinimized?'[min] ':'') + w.title + (State.state.activeWindowId===w.id?' •':''); it.onclick=()=>{ m.remove(); WindowManager.restoreWindow(w.id); WindowManager.focusWindow(w.id); }; m.appendChild(it); });
      const sep=document.createElement('div'); sep.className='fm-menu-sep'; m.appendChild(sep);
      const ni=document.createElement('div'); ni.className='context-menu-item'; ni.textContent='New Window'; ni.onclick=()=>{ m.remove(); EventBus.emit('openApp', {id: app.id, newInstance: true} as any); }; m.appendChild(ni);
      document.body.appendChild(m); m.style.left=Math.min(e.clientX, innerWidth-180)+'px'; m.style.top=(innerHeight-60-m.offsetHeight)+'px';
      setTimeout(()=>document.addEventListener('mousedown',()=>m.remove(),{once:true}),0);
    });
    dock.appendChild(el);
  }
  if (State.state.minimizedWindows.length) {
    const sep = document.createElement('div');
    sep.className = 'dock-sep';
    dock.appendChild(sep);
  }
  for (const win of State.state.minimizedWindows) {
    const app = AppRegistry.get(win.appId);
    if (!app) continue;
    const el = document.createElement('div');
    el.className = 'dock-icon minimized';
    el.dataset.appId = app.id;
    el.innerHTML = `<img src="${app.icon}" alt="${win.title}"><span class="dot"></span><div class="dock-label">${win.title}</div>`;
    el.addEventListener('click', () => WindowManager.restoreWindow(win.id));
    dock.appendChild(el);
  }
  highlight();
}

function highlight(): void {
  document.querySelectorAll('#dock .dock-icon').forEach((el) => {
    const d = (el as HTMLElement).dataset.appId;
    el.classList.toggle('active', !!d && d === State.state.focusedAppId);
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
    EventBus.on('windowClosed', () => { render(); if (!State.state.windows.length) highlight(); });
    EventBus.on('windowFocused', render);
  },
};
