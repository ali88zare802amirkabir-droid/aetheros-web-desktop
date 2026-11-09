import { EventBus } from '../../../core/EventBus';
import { State } from '../../../core/State';
import { SettingsStore } from '../../../apps/settings/store';

export interface Command {
  id: string;
  label: string;
  labelFa?: string;
  keywords: string[];
  run: () => void | Promise<void>;
}

class CmdReg {
  private cmds: Command[] = [
    {
      id: 'darkmode',
      label: 'Toggle Dark Mode',
      labelFa: 'تغییر تم تاریک/روشن',
      keywords: ['dark', 'mode', 'theme', 'تاریک', 'تم'],
      run: () => {
        const cur = SettingsStore.get('appearance.theme');
        SettingsStore.set('appearance.theme', cur === 'dark' ? 'light' : 'dark');
      },
    },
    {
      id: 'lock',
      label: 'Lock',
      labelFa: 'قفل',
      keywords: ['lock', 'قفل'],
      run: () => {
        // best effort
        try { document.dispatchEvent(new CustomEvent('os-lock')); } catch (e) {}
      },
    },
    {
      id: 'emptytrash',
      label: 'Empty Trash',
      labelFa: 'خالی کردن سطل زباله',
      keywords: ['empty', 'trash', 'زباله'],
      run: () => {
        try { State.update({ trash: [] }); EventBus.emit('vfsChanged', undefined); } catch (e) {}
      },
    },
    {
      id: 'newfolder',
      label: 'New Folder',
      labelFa: 'پوشه جدید',
      keywords: ['new', 'folder', 'پوشه'],
      run: () => {
        try { EventBus.emit('finder-newfolder' as any, {} as any); } catch (e) {}
      },
    },
    {
      id: 'togglednd',
      label: 'Toggle Do Not Disturb',
      labelFa: 'تغییر مزاحم نشوید',
      keywords: ['dnd', 'do not disturb', 'مزاحم'],
      run: () => {
        try {
          const cur = SettingsStore.get('notif.dnd');
          SettingsStore.set('notif.dnd', !cur);
        } catch (e) {}
      },
    },
  ];
  list() {
    return this.cmds;
  }
  get(id: string) {
    return this.cmds.find((c) => c.id === id);
  }
}

export const CommandRegistry = new CmdReg();
