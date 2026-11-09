import { State } from './State';
import { EventBus } from './EventBus';

function hexToRgb(hex: string): string {
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

export function applyAppearance() {
  const mode = State.state.themeMode ?? (State.state.darkMode ? 'dark' : 'light');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'auto' && prefersDark);
  document.documentElement.classList.toggle('dark-mode', dark);
  document.documentElement.classList.toggle('auto-theme', mode === 'auto');
  const accent = State.state.accent || '#007aff';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-rgb', hexToRgb(accent));
  // keep legacy field in sync
  if (State.state.darkMode !== dark) State.update({ darkMode: dark });
  EventBus.emit('themeChanged', { darkMode: dark });
}

export function initAppearance() {
  applyAppearance();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if ((State.state.themeMode ?? 'light') === 'auto') applyAppearance();
  });
  EventBus.on('themeChanged', () => { /* consumers refresh */ });
}
