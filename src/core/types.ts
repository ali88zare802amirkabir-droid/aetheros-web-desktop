export interface OSWindow {
  id: string;
  appId: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMaximized: boolean;
  isMinimized: boolean;
  savedX?: number;
  savedY?: number;
  savedWidth?: number;
  savedHeight?: number;
}

export interface VFSNode {
  type: 'folder' | 'file';
  name: string;
  content?: string;
  children?: Record<string, VFSNode>;
  modified?: number;
  created?: number;
  size?: number;
  tags?: string[];
  comments?: string;
  locked?: boolean;
  customIcon?: string;
  permissions?: string;
}

export interface VFSInterface {
  root: VFSNode;
  getNode(path: string): VFSNode | null;
  createFolder(parentPath: string, name: string): VFSNode;
  createFile(parentPath: string, name: string, content?: string): VFSNode;
  renameNode(parentPath: string, oldName: string, newName: string): void;
  deleteNode(parentPath: string, name: string): void;
  moveNode(fromParent: string, name: string, toParent: string): void;
  copyNode(fromParent: string, name: string, toParent: string): void;
  writeFile(path: string, content: string): void;
  persist(): void;
  load(): void;
}

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  defaultSize: { width: number; height: number };
  render(win: OSWindow, vfs: VFSInterface, args?: Record<string, unknown>): HTMLElement;
}

export interface TrashEntry { id: string; name: string; from: string; deletedAt: number; node: VFSNode }

export interface SmartFolder { id: string; name: string; query: string; scope: 'here' | 'all' }

export interface SystemState {
  darkMode: boolean;
  themeMode?: 'light' | 'dark' | 'auto';
  accent?: string;
  windows: OSWindow[];
  minimizedWindows: OSWindow[];
  activeWindowId: string | null;
  focusedAppId: string | null;
  wallpaper: string;
  trash?: TrashEntry[];
  smartFolders?: SmartFolder[];
}

export interface OSEvents {
  openApp: string | { id: string; newInstance?: boolean; args?: Record<string, unknown> };
  windowCreated: OSWindow;
  windowFocused: { windowId: string; win: OSWindow };
  windowClosed: { windowId: string };
  windowMinimized: { windowId: string };
  windowRestored: { windowId: string };
  windowMaximized: { windowId: string; windowEl: HTMLElement };
  windowUnmaximized: { windowId: string };
  appsChanged: AppDefinition[];
  themeChanged: { darkMode: boolean };
  vfsChanged: void;
}
