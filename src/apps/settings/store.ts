import { EventBus } from '../../core/EventBus';
import { State } from '../../core/State';
import { applyAppearance } from '../../core/theme';

export const SETTINGS_SCHEMA_VERSION = 1;
const KEY = 'settings_v1';

export type SettingsMap = Record<string, any>;

const defaults: SettingsMap = {
  'app.layout': 'sidebar',
  'profile.name': 'User',
  'profile.email': 'user@local',
  'appearance.theme': 'light',
  'appearance.accent': '#007aff',
  'appearance.customAccent': '#007aff',
  'appearance.profile': 'custom',
  'appearance.blur': 16,
  'appearance.transparency': 88,
  'appearance.radius': 12,
  'appearance.font': 'Inter',
  'appearance.textSize': 100,
  'appearance.themePack': 'blackos',
  'appearance.reducedMotion': 'system',
  'wallpaper.url': '',
  'wallpaper.autoByTheme': false,
  'wallpaper.blur': 0,
  'desktop.iconSize': 64,
  'desktop.iconPosition': 'left',
  'dock.size': 48,
  'dock.magnification': false,
  'dock.position': 'bottom',
  'dock.autoHide': false,
  'dock.minimizeAnim': 'genie',
  'dock.showRecents': true,
  'dock.clockFormat': '24h',
  'wm.snap': true,
  'wm.buttonStyle': 'mac',
  'wm.shadow': true,
  'wm.animations': true,
  'lang.language': 'fa',
  'lang.direction': 'rtl',
  'lang.calendar': 'shamsi',
  'lang.numberFormat': 'fa',
  'lang.timezone': 'Asia/Tehran',
  'lang.faFont': 'Vazirmatn',
  'notif.enabled': true,
  'notif.position': 'top-right',
  'notif.duration': 4,
  'notif.dnd': false,
  'finder.defaultView': 'icons',
  'finder.showHidden': false,
  'finder.showExtensions': true,
  'finder.tabBehavior': 'new',
  'finder.iconSize': 'md',
  'a11y.highContrast': false,
  'a11y.largeText': false,
  'a11y.reduceTransparency': false,
  'a11y.focusRing': true,
  'a11y.keyboard': true,
  'terminal.font': 'JetBrains Mono',
  'terminal.fontSize': 13,
  'terminal.cursor': 'block',
};

function hexToRgb(hex: string): string {
  const h = (hex||'#007aff').replace('#','');
  const f = h.length===3 ? h.split('').map(c=>c+c).join('') : h.padEnd(6,'0');
  const n = parseInt(f,16); return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

class SettingsStoreImpl {
  data: SettingsMap = { ...defaults };
  listeners = new Set<(key?: string) => void>();
  keyListeners = new Map<string, Set<(value: any, key: string) => void>>();

  init() {
    let persisted: SettingsMap | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') persisted = (p.data ?? p) as SettingsMap;
      }
    } catch {}
    this.data = { ...defaults, ...(persisted || {}) };
    // sync from legacy State only when not explicitly persisted in settings_v1
    if (!persisted || !Object.prototype.hasOwnProperty.call(persisted, 'appearance.theme')) {
      this.data['appearance.theme'] = State.state.themeMode ?? (State.state.darkMode ? 'dark' : 'light');
    }
    if (!persisted || !Object.prototype.hasOwnProperty.call(persisted, 'appearance.accent')) {
      this.data['appearance.accent'] = State.state.accent || this.data['appearance.accent'];
    }
    if (!persisted || !Object.prototype.hasOwnProperty.call(persisted, 'wallpaper.url')) {
      this.data['wallpaper.url'] = State.state.wallpaper || this.data['wallpaper.url'];
    }
    this.applyAll();
  }

  get<T = any>(key: string): T { return (this.data[key] ?? defaults[key]) as T; }
  private emitKey(key: string, value: any) {
    this.keyListeners.get(key)?.forEach(fn => { try { fn(value, key); } catch {} });
  }
  subscribe(key: string, cb: (value: any, key: string) => void) {
    if (!this.keyListeners.has(key)) this.keyListeners.set(key, new Set());
    this.keyListeners.get(key)!.add(cb);
    try { cb(this.get(key), key); } catch {}
    return () => { this.keyListeners.get(key)?.delete(cb); };
  }
  set(key: string, value: any) {
    this.data[key] = value;
    this.persist();
    this.applyKey(key, value);
    this.listeners.forEach(fn => { try { fn(key); } catch {} });
    this.emitKey(key, value);
    try { EventBus.emit('themeChanged', { darkMode: State.state.darkMode }); } catch {}
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: { key, value } }));
  }
  setMany(obj: SettingsMap) {
    Object.entries(obj).forEach(([k,v]) => { this.data[k]=v; this.applyKey(k,v); });
    this.persist();
    Object.entries(obj).forEach(([k,v]) => this.emitKey(k, v));
    this.listeners.forEach(fn=>{try{fn();}catch{}});
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: { many: true } }));
  }
  on(fn: (key?: string) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  persist() { try { localStorage.setItem(KEY, JSON.stringify({ version: SETTINGS_SCHEMA_VERSION, data: this.data })); } catch {} }
  exportJson() { return JSON.stringify({ version: SETTINGS_SCHEMA_VERSION, exportedAt: Date.now(), data: this.data }, null, 2); }
  importJson(text: string) { const p = JSON.parse(text); if (!p || typeof p !== 'object' || !p.data) throw new Error('Invalid settings file'); this.data = { ...defaults, ...p.data }; this.persist(); this.applyAll(); this.listeners.forEach(fn=>{try{fn();}catch{}}); }
  reset() { this.data = { ...defaults }; this.persist(); this.applyAll(); this.listeners.forEach(fn=>{try{fn();}catch{}}); }

  applyKey(key: string, value: any) {
    if (key === 'appearance.theme' || key === 'appearance.accent') {
      State.update({ themeMode: this.get('appearance.theme'), accent: this.get('appearance.accent'), darkMode: State.state.darkMode });
      applyAppearance();
    }
    if (key === 'appearance.themePack') {
      if (value) document.documentElement.setAttribute('data-theme-pack', String(value));
      else document.documentElement.removeAttribute('data-theme-pack');
    }
    if (key === 'appearance.customAccent') { /* applied when selected */ }
    if (key === 'appearance.blur') document.documentElement.style.setProperty('--glass-blur', `${value}px`);
    if (key === 'appearance.transparency') document.documentElement.style.setProperty('--glass-alpha', `${(+value)/100}`);
    if (key === 'appearance.radius') document.documentElement.style.setProperty('--radius', `${value}px`);
    if (key === 'appearance.font') { document.documentElement.style.setProperty('--ui-font', String(value)); document.body.style.fontFamily = `"${value}", "Vazirmatn", system-ui, sans-serif`; }
    if (key === 'appearance.textSize') document.documentElement.style.setProperty('--text-scale', `${(+value)/100}`);
    if (key === 'appearance.reducedMotion') document.documentElement.dataset.reduceMotion = String(value);
    if (key === 'wallpaper.url' || key === 'wallpaper.blur') this.applyWallpaper();
    if (key === 'lang.direction') { document.documentElement.dir = value === 'rtl' ? 'rtl' : 'ltr'; }
    if (key === 'lang.language') document.documentElement.lang = value === 'fa' ? 'fa' : 'en';
    if (key === 'a11y.highContrast') document.documentElement.classList.toggle('high-contrast', !!value);
    if (key === 'a11y.reduceTransparency') document.documentElement.classList.toggle('reduce-transparency', !!value);
    if (key === 'a11y.focusRing') document.documentElement.classList.toggle('a11y-focus-ring', !!value);
    if (key === 'a11y.largeText') document.documentElement.style.setProperty('--text-scale', value ? '1.15' : `${(+this.get('appearance.textSize')||100)/100}`);
    if (key === 'dock.position') document.documentElement.dataset.dockPos = String(value);
    if (key === 'dock.size') document.documentElement.style.setProperty('--dock-h', `${value}px`);
  }
  applyWallpaper() {
    const url = this.get('wallpaper.url'); const blur = this.get('wallpaper.blur');
    if (url) { document.body.style.backgroundImage = `url("${url}")`; document.body.style.backgroundSize='cover'; document.body.style.backgroundPosition='center'; }
    else document.body.style.backgroundImage = '';
    document.documentElement.style.setProperty('--wallpaper-blur', `${blur||0}px`);
    State.update({ wallpaper: url || '' });
  }
  applyAll() {
    ['appearance.theme','appearance.themePack','appearance.accent','appearance.blur','appearance.transparency','appearance.radius','appearance.font','appearance.textSize','appearance.reducedMotion','lang.direction','lang.language','a11y.highContrast','a11y.reduceTransparency','a11y.focusRing','a11y.largeText','dock.position','dock.size'].forEach(k=>this.applyKey(k,this.get(k)));
    this.applyWallpaper();
  }
}

export const SettingsStore = new SettingsStoreImpl();
