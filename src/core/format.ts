import { SettingsStore } from '../apps/settings/store';

export function formatClock(d: Date): string {
  const fmt = (SettingsStore.get('dock.clockFormat') as string) === '12h' ? '12h' : '24h';
  const lang = (SettingsStore.get('lang.language') as string) === 'en' ? 'en-US' : 'fa-IR';
  try {
    return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: fmt === '12h' });
  } catch {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: fmt === '12h' });
  }
}
