import type { SystemState } from './types';

const defaults: SystemState = {
  darkMode: false,
  themeMode: 'light',
  accent: '#007aff',
  windows: [],
  minimizedWindows: [],
  activeWindowId: null,
  focusedAppId: null,
  wallpaper: '',
  trash: [],
  smartFolders: [],
};

class StateStore {
  state: SystemState = { ...defaults, windows: [], minimizedWindows: [] };

  get(key: string, defaultValue: unknown): unknown {
    try {
      const raw = localStorage.getItem(`desktop_${key}`);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`desktop_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('State.set failed', e);
    }
  }

  init(): void {
    const saved = this.get('systemState', null) as Partial<SystemState> | null;
    this.state = {
      ...defaults,
      ...(saved ?? {}),
      windows: saved?.windows ?? [],
      minimizedWindows: saved?.minimizedWindows ?? [],
      trash: saved?.trash ?? [],
      smartFolders: saved?.smartFolders ?? [],
      themeMode: saved?.themeMode ?? (saved?.darkMode ? 'dark' : 'light'),
      accent: saved?.accent ?? '#007aff',
    };
    if (this.state.darkMode) {
      document.documentElement.classList.add('dark-mode');
    }
  }

  save(): void {
    this.set('systemState', this.state);
  }

  update(partial: Partial<SystemState>): void {
    Object.assign(this.state, partial);
    this.save();
  }
}

export const State = new StateStore();
