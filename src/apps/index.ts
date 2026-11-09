import { AppRegistry } from '../core/AppRegistry';
import { FinderApp } from './Finder';
import { NotesApp } from './Notes';
import { SettingsApp } from './Settings';
import { EditorApp } from './Editor';
import { TerminalApp } from './Terminal';
import { CalculatorApp } from './Calculator';
import { ClockApp } from './Clock';
import { CalendarApp } from './Calendar';

export function registerDefaultApps(): void {
  AppRegistry.register(FinderApp);
  AppRegistry.register(NotesApp);
  AppRegistry.register(CalculatorApp);
  AppRegistry.register(ClockApp);
  AppRegistry.register(CalendarApp);
  AppRegistry.register(EditorApp);
  AppRegistry.register(TerminalApp);
  AppRegistry.register(SettingsApp);
}
