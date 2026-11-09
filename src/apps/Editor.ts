import type { AppDefinition } from '../core/types';
import { EditorView } from './editor/view/EditorView';
import { OpenWith } from '../core/OpenWith';
import '../apps/editor/editor.css';

export const EditorApp: AppDefinition = {
  id: 'editor',
  name: 'Text Editor',
  icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="12" y="8" width="40" height="48" rx="4" fill="#8e8e93"/><path d="M22 20h20M22 30h20M22 40h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>'),
  defaultSize: { width: 800, height: 600 },
  render(win, vfs, args) {
    const root = document.createElement('div');
    root.style.height = '100%';
    const view = new EditorView();
    view.mount(root);
    if (args && (args as any).path) {
      view.openFile((args as any).path);
    } else {
      view.openNew();
    }
    return root;
  },
};

// register open with
OpenWith.register({ appId: 'editor', extensions: ['txt', 'md', 'json', 'js', 'ts', 'css', 'html', 'py', 'log'], priority: 10 });
OpenWith.register({ appId: 'editor', extensions: ['markdown'], priority: 10 });
