import type { Provider, Result, ProviderContext } from '../types';
import { SETTINGS } from '../../../../apps/settings/defs';
import { icon } from '../../icons';
import { normalizeText } from '../calc';

export const settingsProvider: Provider = {
  id: 'settings',
  label: 'Settings',
  search(query: string, ctx: ProviderContext): Result[] {
    const qn = normalizeText(query);
    const results: Result[] = [];
    for (const s of SETTINGS as any[]) {
      const tn = normalizeText(s.label + ' ' + (s.labelFa || '') + ' ' + (s.keywords || []).join(' '));
      if (tn.includes(qn) || qn === '') {
        results.push({
          id: `setting:${s.id}`,
          providerId: 'settings',
          providerLabel: 'Settings',
          group: 'settings',
          title: s.labelFa || s.label,
          subtitle: s.label,
          icon: icon('settings', 16),
          iconType: 'svg',
          data: { type: 'setting', rowId: s.id, section: s.section },
          actions: [
            {
              id: 'open',
              label: 'Open in Settings',
              run: (res) => {
                try { ctx.openApp?.('settings'); ctx.openSettings?.(res.data.rowId); } catch (e) {}
              },
            },
          ],
        });
      }
    }
    return results.slice(0, 20);
  },
};
