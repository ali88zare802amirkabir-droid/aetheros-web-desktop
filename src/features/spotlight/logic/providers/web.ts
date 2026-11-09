import type { Provider, Result } from '../types';
import { icon } from '../../icons';
import { t } from '../../strings';

export const webProvider: Provider = {
  id: 'web',
  label: 'Web',
  search(query: string): Result[] {
    const q = query.trim();
    if (!q) return [];
    const tr = t();
    return [
      {
        id: `web:${q}`,
        providerId: 'web',
        providerLabel: 'Web',
        group: 'web',
        title: tr.webSearch + ' ' + q,
        subtitle: 'DuckDuckGo',
        icon: icon('web', 16),
        iconType: 'svg',
        data: { type: 'web', query: q },
        actions: [
          {
            id: 'search',
            label: 'Search',
            run: () => {
              try {
                const url = 'https://duckduckgo.com/?q=' + encodeURIComponent(q);
                window.open(url, '_blank', 'noopener,noreferrer');
              } catch (e) {}
            },
          },
        ],
      },
    ];
  },
};
