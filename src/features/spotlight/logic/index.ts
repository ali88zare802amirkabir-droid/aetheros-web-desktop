import type { Result, Provider, ProviderContext } from './types';
import { appsProvider } from './providers/apps';
import { filesProvider } from './providers/files';
import { settingsProvider } from './providers/settings';
import { calculatorProvider } from './providers/calculator';
import { unitsProvider } from './providers/units';
import { commandsProvider } from './providers/commands';
import { webProvider } from './providers/web';
import { rankResults } from './ranking';
import { addToHistory } from './history';

export type { Result, Provider, ProviderContext };

const providers: Provider[] = [
  appsProvider,
  filesProvider,
  settingsProvider,
  calculatorProvider,
  unitsProvider,
  commandsProvider,
  webProvider,
];

export async function searchAll(query: string, ctx: ProviderContext): Promise<Result[]> {
  const q = query.trim();
  if (!q) return [];
  const results: Result[] = [];
  for (const p of providers) {
    try {
      const res = await p.search(q, ctx);
      for (const r of res) {
        results.push({ ...r, providerId: r.providerId || p.id, providerLabel: r.providerLabel || p.label });
      }
    } catch (e) {
      // ignore provider errors
    }
  }
  const ranked = rankResults(results, q, ctx);
  // add web suggestion row at the end if no direct web action - webProvider adds it
  return ranked;
}

export function recordSelection(result: Result) {
  if (result.id) addToHistory(result.id);
}

export { providers };
