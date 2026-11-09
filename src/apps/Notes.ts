import type { AppDefinition } from '../core/types';
import { VFS } from '../core/VFS';
import { noteIcon } from '../ui/icons';

export const NotesApp: AppDefinition = {
  id: 'notes',
  name: 'Notes',
  icon: noteIcon,
  defaultSize: { width: 520, height: 380 },
  render() {
    const root = document.createElement('div');
    root.className = 'notes-app';
    const ta = document.createElement('textarea');
    ta.placeholder = 'Write something...';
    const bar = document.createElement('div');
    bar.className = 'notes-bar';
    const btn = document.createElement('button');
    btn.textContent = 'Save';
    const status = document.createElement('span');
    status.className = 'notes-status';
    bar.append(btn, status);
    root.append(ta, bar);

    const existing = VFS.getNode('note.txt');
    if (existing?.type === 'file') ta.value = existing.content ?? '';

    btn.onclick = () => {
      const node = VFS.getNode('note.txt');
      if (node?.type === 'file') {
        node.content = ta.value;
        VFS.persist();
      } else {
        try { VFS.createFile('', 'note.txt', ta.value); } catch { /* exists race */ }
      }
      status.textContent = 'Saved ✓';
      setTimeout(() => (status.textContent = ''), 1500);
    };
    return root;
  },
};
