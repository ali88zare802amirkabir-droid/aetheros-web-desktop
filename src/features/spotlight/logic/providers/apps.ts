import type { Provider, Result, ProviderContext } from '../types';
import { AppRegistry } from '../../../../core/AppRegistry';
import { WindowManager } from '../../../../core/WindowManager';
import { icon } from '../../icons';

export const appsProvider: Provider = {
  id: 'apps',
  label: 'Apps',
  search(query: string, ctx: ProviderContext): Result[] {
    const apps = AppRegistry.list();
    const results: Result[] = [];
    for (const app of apps) {
      results.push({
        id: `app:${app.id}`,
        providerId: 'apps',
        providerLabel: 'Apps',
        group: 'apps',
        title: app.name,
        subtitle: app.id,
        icon: icon('app', 16),
        iconType: 'svg',
        data: { type: 'app', appId: app.id },
        actions: [
          {
            id: 'open',
            label: 'Open',
            run: () => {
              try { WindowManager.openApp(app.id); } catch (e) { ctx.openApp?.(app.id); }
            },
          },
        ],
      });
    }
    // simple filter by query will be done by ranking; return all for now
    const ql = query.toLowerCase();
    return results.filter((r) => r.title.toLowerCase().includes(ql) || (r.subtitle||'').toLowerCase().includes(ql));
  },
};
