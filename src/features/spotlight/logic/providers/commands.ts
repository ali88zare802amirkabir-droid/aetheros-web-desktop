import type { Provider, Result } from '../types';
import { CommandRegistry } from '../commands';
import { icon } from '../../icons';
import { normalizeText } from '../calc';

export const commandsProvider: Provider = {
  id: 'commands',
  label: 'Commands',
  search(query: string): Result[] {
    const qn = normalizeText(query);
    const results: Result[] = [];
    for (const cmd of CommandRegistry.list()) {
      const tn = normalizeText(cmd.label + ' ' + (cmd.labelFa || '') + ' ' + (cmd.keywords || []).join(' '));
      if (tn.includes(qn) || qn === '') {
        results.push({
          id: `cmd:${cmd.id}`,
          providerId: 'commands',
          providerLabel: 'Commands',
          group: 'commands',
          title: cmd.labelFa || cmd.label,
          subtitle: cmd.label,
          icon: icon('command', 16),
          iconType: 'svg',
          data: { type: 'command', cmdId: cmd.id },
          actions: [
            {
              id: 'run',
              label: 'Run',
              run: () => {
                try { CommandRegistry.get(cmd.id)?.run(); } catch (e) {}
              },
            },
          ],
        });
      }
    }
    return results.slice(0, 10);
  },
};
