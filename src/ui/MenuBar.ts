import { EventBus } from '../core/EventBus';
import { State } from '../core/State';
import { SettingsStore } from '../apps/settings/store';
import { formatClock } from '../core/format';

export const MenuBar = {
  init(): void {
    const bar = document.getElementById('menubar')!;
    bar.innerHTML = `
      <div class="menu-left"><span class="logo" aria-label="AetherOS">◈ AetherOS</span><span class="menu-sep" aria-hidden="true"></span><span id="active-app" class="app-name">—</span></div>
      <div class="menu-right"><button id="spotlight-toggle" title="Spotlight (⌘/Ctrl+Space)" aria-label="Spotlight" class="menu-action">${'<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>'}</button><span id="clock"></span><button id="theme-toggle" class="menu-action" title="Toggle theme" aria-label="Toggle theme">◐</button></div>
    `;
    document.getElementById('spotlight-toggle')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('spotlight:toggle'));
    });
    const tick = () => {
      const el = document.getElementById('clock');
      if (el) el.textContent = formatClock(new Date());
    };
    tick();
    setInterval(tick, 1000);
    SettingsStore.subscribe('dock.clockFormat', tick);
    SettingsStore.subscribe('lang.language', tick);
    SettingsStore.subscribe('lang.direction', tick);
    document.getElementById('theme-toggle')!.addEventListener('click', () => {
      const dark = !State.state.darkMode;
      document.documentElement.classList.toggle('dark-mode', dark);
      State.update({ darkMode: dark });
      EventBus.emit('themeChanged', { darkMode: dark });
    });
    EventBus.on('windowFocused', ({ win }) => {
      document.getElementById('active-app')!.textContent = win.title;
    });
    EventBus.on('windowClosed', () => {
      if (State.state.windows.length === 0) document.getElementById('active-app')!.textContent = '—';
    });
  },
};
