import type { TokenQuery } from './utils';
import { SettingsStore } from '../settings/store';

export type ViewMode = 'icons' | 'list' | 'columns' | 'gallery';
export type SortKey = 'name' | 'type' | 'modified' | 'size';
export interface Clip { op: 'copy' | 'cut'; parent: string; names: string[] }
export type Cmd = { undo: () => void; redo: () => void; label: string };

export interface FinderTabState {
  id: string;
  path: string;
  history: string[];
  histIdx: number;
  selected: Set<string>;
  anchor: string | null;
  view: ViewMode;
  sortKey: SortKey;
  asc: boolean;
  iconSize: 'sm' | 'md' | 'lg';
  showPreview: boolean;
  filter: string;
  searchScope: 'here' | 'all';
  tokenQ: TokenQuery;
  searchResultPaths: Set<string> | null;
  activeSmartId: string | null;
  galleryIdx: number;
  renaming: string | null;
  scrollTop: number;
  scrollLeft: number;
}

export interface FinderTabsSnapshot { tabs: Omit<FinderTabState, 'selected'|'searchResultPaths'> & { selected: string[]; searchResultPaths: string[]|null }[]; active: number; closed: (Omit<FinderTabState, 'selected'|'searchResultPaths'> & { selected: string[]; searchResultPaths: string[]|null })[]; }

export function serializeTab(t: FinderTabState) {
  return { ...t, selected: [...t.selected], searchResultPaths: t.searchResultPaths ? [...t.searchResultPaths] : null };
}
export function reviveTab(d: any): FinderTabState {
  const base = createFinderTabState(typeof d?.path === 'string' ? d.path : '');
  return { ...base, ...d, selected: new Set(Array.isArray(d?.selected) ? d.selected : []), searchResultPaths: d?.searchResultPaths ? new Set(d.searchResultPaths) : null, tokenQ: d?.tokenQ ?? { raw: '' }, history: Array.isArray(d?.history) && d.history.length ? d.history : [base.path], histIdx: typeof d?.histIdx === 'number' ? d.histIdx : 0 };
}

export function createFinderTabState(path = ''): FinderTabState {
  let view = 'icons' as ViewMode;
  let iconSize = 'md' as 'sm'|'md'|'lg';
  try {
    const dv = SettingsStore.get('finder.defaultView'); if (dv==='icons'||dv==='list'||dv==='columns'||dv==='gallery') view = dv;
    const isz = SettingsStore.get('finder.iconSize'); if (isz==='sm'||isz==='md'||isz==='lg') iconSize = isz;
  } catch {}
  return {
    id: `ftab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    path,
    history: [path],
    histIdx: 0,
    selected: new Set<string>(),
    anchor: null,
    view,
    sortKey: 'name',
    asc: true,
    iconSize,
    showPreview: true,
    filter: '',
    searchScope: 'here',
    tokenQ: { raw: '' },
    searchResultPaths: null,
    activeSmartId: null,
    galleryIdx: 0,
    renaming: null,
    scrollTop: 0,
    scrollLeft: 0,
  };
}
