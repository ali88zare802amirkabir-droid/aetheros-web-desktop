import type { Provider, Result } from '../types';
import { icon } from '../../icons';

const rates: Record<string, Record<string, number>> = {
  length: { km: 1000, m: 1, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  mass: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.028349523125 },
  currency: { USD: 1, EUR: 0.92, GBP: 0.79, IRR: 42000 }, // offline fixed rates as required
};

function convert(val: number, from: string, to: string): number | null {
  // try length
  if (rates.length[from] && rates.length[to]) return val * rates.length[from] / rates.length[to];
  if (rates.mass[from] && rates.mass[to]) return val * rates.mass[from] / rates.mass[to];
  if (rates.currency[from] && rates.currency[to]) return val * rates.currency[from] / rates.currency[to];
  return null;
}

export const unitsProvider: Provider = {
  id: 'units',
  label: 'Units',
  search(query: string): Result[] {
    const q = query.trim().toLowerCase();
    // pattern: 10km to mi
    const m = q.match(/([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)\s+(?:to|=)\s+([a-z]+)/);
    if (!m) return [];
    const val = parseFloat(m[1]);
    const from = m[2];
    const to = m[3];
    const res = convert(val, from, to);
    if (res === null) return [];
    const out = res % 1 === 0 ? res.toString() : res.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    return [
      {
        id: `unit:${q}`,
        providerId: 'units',
        providerLabel: 'Units',
        group: 'units',
        title: `${val}${from} = ${out}${to}`,
        subtitle: 'Convert',
        icon: icon('calc', 16),
        iconType: 'svg',
        data: { type: 'unit', value: out },
        actions: [
          {
            id: 'copy',
            label: 'Copy',
            run: async () => {
              try { await navigator.clipboard.writeText(out + to); } catch (e) {}
            },
          },
        ],
      },
    ];
  },
};
