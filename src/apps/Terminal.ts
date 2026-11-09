import type { AppDefinition } from '../core/types';
import { TerminalView } from './terminal/view/TerminalView';
import './terminal/terminal.css';

export const TerminalApp: AppDefinition = {
  id: 'terminal',
  name: 'Terminal',
  icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="44" rx="6" fill="#1d1d1f"/><path d="M16 24l8 8-8 8M28 40h14" stroke="#28c840" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
  defaultSize: { width: 760, height: 480 },
  render(win, vfs, args) {
    const root = document.createElement('div');
    root.style.height = '100%';
    const view = new TerminalView();
    view.mount(root);
    return root;
  },
};
