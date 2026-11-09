import './style.css';
import './features/spotlight/spotlight.css';
import './features/widgets/widgets.css';
import './features/startmenu/startmenu.css';
import { State } from './core/State';
// Apply theme pack if set
try {
  const raw = localStorage.getItem('settings_v1');
  if (raw) {
    const p = JSON.parse(raw);
    const tp = p?.data?.['appearance.themePack'] || p?.['appearance.themePack'];
    if (tp) document.documentElement.setAttribute('data-theme-pack', tp);
  }
} catch {}
import { VFS } from './core/VFS';
import { WindowManager } from './core/WindowManager';
import { MenuBar } from './ui/MenuBar';
import { Dock } from './ui/Dock';
import { Desktop } from './ui/Desktop';
import { registerDefaultApps } from './apps';
import { initAppearance } from './core/theme';
import { EventBus } from './core/EventBus';
import { migrateBase64ToBlobs } from './core/migrateBlobs';
import { SettingsStore } from './apps/settings/store';
import { NotificationService } from './core/NotificationService';
import { SpotlightView } from './features/spotlight/view/SpotlightView';
import { openQuickLook } from './apps/finder/quicklook';
import { WidgetsRail } from './features/widgets/view/WidgetsRail';
import { StartMenu } from './features/startmenu/view/StartMenu';

registerDefaultApps();
State.init();
VFS.load();
initAppearance();
SettingsStore.init();
NotificationService.init();
void migrateBase64ToBlobs();
try {
  if (!VFS.getNode('.hidden-demo.txt')) VFS.createFile('', '.hidden-demo.txt', 'Hidden file (dot prefix) for testing Finder showHidden.');
  if (!VFS.getNode('Documents/.notes-secret.txt')) VFS.createFile('Documents', '.notes-secret.txt', 'Hidden notes for testing.');
} catch {}
MenuBar.init();
WindowManager.init();
Dock.init();
Desktop.init();
WindowManager.rehydrate();

// Aether Widgets
const widgets = new WidgetsRail();
widgets.mount();

// Nexus Start Menu
const startMenu = new StartMenu();
startMenu.mount();
(window as any).__startMenu = startMenu;
document.addEventListener('nexus:toggle', () => startMenu.toggle());

// Spotlight
const spotlightRoot = document.createElement('div');
spotlightRoot.id = 'spotlight-root';
document.body.appendChild(spotlightRoot);
const spotlight = new SpotlightView();
spotlight.mount(spotlightRoot);
spotlight.setContext({
  openApp: (id: string, args?: any) => {
    try { WindowManager.openApp({ id, newInstance: false, args }); } catch (e) { try { WindowManager.openApp(id); } catch (e2) {} }
  },
  openSettings: (rowId?: string) => {
    try {
      WindowManager.openApp({ id: 'settings', newInstance: false, args: rowId ? { highlight: rowId } : undefined });
    } catch (e) {
      try { WindowManager.openApp('settings'); } catch (e2) {}
    }
  },
  openQuickLook: (items: any[], startKey?: string) => {
    try { openQuickLook({ items, startKey } as any); } catch (e) {}
  },
  showInFinder: (path: string) => {
    try {
      WindowManager.openApp({ id: 'finder', newInstance: false, args: { path } });
    } catch (e) {
      try { WindowManager.openApp('finder'); } catch (e2) {}
    }
  },
  toggleDnd: () => {
    try {
      const cur = SettingsStore.get('notif.dnd');
      SettingsStore.set('notif.dnd', !cur);
    } catch (e) {}
  },
  emptyTrash: () => {
    try { State.update({ trash: [] }); } catch (e) {}
  },
  newFolder: () => {
    try { document.dispatchEvent(new CustomEvent('finder:newfolder')); } catch (e) {}
  },
});
(window as any).__spotlight = spotlight;
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
    e.preventDefault();
    spotlight.open();
  }
});
document.addEventListener('spotlight:toggle', () => {
  // simple toggle - just open
  spotlight.open();
});

if (State.state.wallpaper) {
  document.body.style.backgroundImage = `url("${State.state.wallpaper}")`;
  document.body.style.backgroundSize = 'cover';
}

window.addEventListener('resize', () => WindowManager.constrainWindows());
(window as any).WindowManager = WindowManager;
(window as any).EventBus = EventBus;
(window as any).VFS = VFS;
(window as any).State = State;
(window as any).__mockFinderItems = (count = 10000, folder = 'Documents') => {
  const parent = VFS.getNode(folder);
  if (!parent || parent.type !== 'folder') { console.warn('folder not found', folder); return; }
  if (!parent.children) parent.children = {};
  for (let i = 1; i <= count; i++) {
    const name = `mock-item-${String(i).padStart(5,'0')}.txt`;
    if (!parent.children[name]) parent.children[name] = { type: 'file', name, content: `Mock content ${i}`, size: 20, modified: Date.now() - i * 1000, created: Date.now() };
  }
  VFS.persist();
  console.log(`[OS] created ${count} mock items in ${folder}`);
};
console.log('[OS] boot complete', State.state);
