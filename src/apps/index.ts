import { AppRegistry } from '../core/AppRegistry';
import { FinderApp } from './Finder';
import { NotesApp } from './Notes';
import { SettingsApp } from './Settings';
import { EditorApp } from './Editor';
import { TerminalApp } from './Terminal';

export function registerDefaultApps(): void {
  AppRegistry.register(FinderApp);
  AppRegistry.register(NotesApp);
  AppRegistry.register(SettingsApp);
  AppRegistry.register(EditorApp);
  AppRegistry.register(TerminalApp);
}
