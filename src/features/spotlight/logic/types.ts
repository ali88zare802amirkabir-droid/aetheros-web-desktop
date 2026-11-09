export interface Result {
  id: string;
  providerId: string;
  providerLabel: string;
  group: string;
  title: string;
  subtitle?: string;
  icon?: string;
  iconType?: 'svg' | 'url' | 'text';
  score?: number;
  data?: any;
  shortcut?: string;
  actions?: Action[];
}

export interface Action {
  id: string;
  label: string;
  shortcut?: string;
  run: (result: Result, ctx: ProviderContext) => void | Promise<void>;
}

export interface ProviderContext {
  recentAppIds?: string[];
  frequent?: Record<string, number>;
  history?: any;
  vfs?: any;
  apps?: any[];
  settingsDefs?: any[];
  openApp?: (id: string, args?: any) => void;
  openSettings?: (rowId?: string) => void;
  openQuickLook?: (items: any[], startKey?: string) => void;
  showInFinder?: (path: string) => void;
  toggleDnd?: () => void;
  emptyTrash?: () => void;
  newFolder?: () => void;
  setTheme?: (mode: string) => void;
}

export interface Provider {
  id: string;
  label: string;
  icon?: string;
  search(query: string, ctx: ProviderContext): Result[] | Promise<Result[]>;
}
