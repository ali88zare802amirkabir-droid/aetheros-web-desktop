import { icon } from '../icons';
import { t } from '../strings';
import { searchAll, recordSelection } from '../logic/index';
import type { Result } from '../logic/types';

export interface SpotlightState {
  open: boolean;
  query: string;
  results: Result[];
  activeIndex: number;
}

export class SpotlightView {
  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private list: HTMLElement | null = null;
  private preview: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private state: SpotlightState = { open: false, query: '', results: [], activeIndex: -1 };
  private debounceTimer: number | null = null;
  private lastFocus: HTMLElement | null = null;
  private ctx: any = {};

  mount(container: HTMLElement) {
    this.container = container;
    const tr = t();
    const root = document.createElement('div');
    root.className = 'sl-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
      <div class="sl-backdrop" data-sl-close></div>
      <div class="sl-window" role="combobox" aria-haspopup="listbox" aria-expanded="false">
        <div class="sl-header">
          <span class="sl-icon">${icon('search', 18)}</span>
          <input class="sl-input" type="text" autocomplete="off" spellcheck="false" placeholder="${tr.placeholder}" aria-autocomplete="list" aria-controls="sl-list" />
          <span class="sl-count" aria-live="polite"></span>
        </div>
        <div class="sl-body">
          <div class="sl-main">
            <div id="sl-list" class="sl-list" role="listbox" aria-label="Results"></div>
          </div>
          <aside class="sl-preview" aria-label="${tr.preview}"></aside>
        </div>
      </div>
    `;
    container.appendChild(root);
    this.root = root;
    this.input = root.querySelector('.sl-input') as HTMLInputElement;
    this.list = root.querySelector('.sl-list') as HTMLElement;
    this.preview = root.querySelector('.sl-preview') as HTMLElement;
    this.countEl = root.querySelector('.sl-count') as HTMLElement;

    root.querySelectorAll('[data-sl-close]').forEach((el) => {
      el.addEventListener('click', () => this.close());
    });

    this.input.addEventListener('input', () => {
      this.state.query = this.input!.value;
      this.scheduleSearch();
    });

    this.input.addEventListener('keydown', (e) => {
      this.handleKey(e);
    });

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    this.root.classList.add('sl-hidden');
    root.setAttribute('aria-hidden', 'true');
    (this.input as any).setAttribute('aria-activedescendant', '');
  }

  setContext(ctx: any) {
    this.ctx = ctx || {};
  }

  open() {
    if (!this.root) return;
    this.lastFocus = document.activeElement as HTMLElement;
    this.root.classList.remove('sl-hidden');
    this.root.classList.add('sl-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.state.open = true;
    this.state.query = '';
    if (this.input) {
      this.input.value = '';
      setTimeout(() => this.input?.focus(), 0);
    }
    this.state.results = [];
    this.state.activeIndex = -1;
    this.render();
  }

  close() {
    if (!this.root) return;
    this.root.classList.remove('sl-open');
    this.root.classList.add('sl-closing');
    setTimeout(() => {
      this.root?.classList.add('sl-hidden');
      this.root?.classList.remove('sl-closing');
      this.root?.setAttribute('aria-hidden', 'true');
    }, 160);
    this.state.open = false;
    if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
      try { this.lastFocus.focus(); } catch (e) {}
    }
  }

  private scheduleSearch() {
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.doSearch(), 40) as any;
  }

  private async doSearch() {
    const q = this.state.query;
    try {
      const res = await searchAll(q, this.ctx);
      this.state.results = res;
      this.state.activeIndex = res.length ? 0 : -1;
      this.render();
    } catch (e) {
      this.state.results = [];
      this.render();
    }
  }

  private handleKey(e: KeyboardEvent) {
    const list = this.state.results;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!list.length) return;
      this.state.activeIndex = (this.state.activeIndex + 1) % list.length;
      this.render();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!list.length) return;
      this.state.activeIndex = (this.state.activeIndex - 1 + list.length) % list.length;
      this.render();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < list.length) {
        e.preventDefault();
        this.activate(list[idx], e);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
      const cur = list[this.state.activeIndex];
      if (cur && cur.data?.type === 'calc') {
        e.preventDefault();
        try { navigator.clipboard.writeText(cur.title); } catch (e2) {}
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cur = list[this.state.activeIndex >= 0 ? this.state.activeIndex : 0];
      if (cur) {
        this.activate(cur, e);
      }
      return;
    }
    if (e.key === 'Tab') {
      // simple tab navigation between groups - just move
      e.preventDefault();
      if (!list.length) return;
      this.state.activeIndex = (this.state.activeIndex + 1) % list.length;
      this.render();
      return;
    }
    if (e.key === ' ' && e.metaKey === false && e.ctrlKey === false && e.altKey === false) {
      // space for quick look - if not typing and item is file
      const cur = list[this.state.activeIndex];
      if (cur && cur.data?.type === 'file') {
        e.preventDefault();
        try { this.ctx.openQuickLook?.([{ key: cur.data.path, name: cur.title, node: cur.data.node, path: cur.data.path }], cur.data.path); } catch (e2) {}
        return;
      }
    }
  }

  private activate(res: Result, e: KeyboardEvent) {
    try {
      recordSelection(res);
      // find action
      const action = res.actions && res.actions[0];
      if (action && typeof action.run === 'function') {
        action.run(res, this.ctx);
      }
      // special handling
      if (res.data?.type === 'app' && !res.actions?.length) {
        this.ctx.openApp?.(res.data.appId);
      } else if (res.data?.type === 'setting') {
        this.ctx.openApp?.('settings');
        this.ctx.openSettings?.(res.data.rowId);
      } else if (res.data?.type === 'command') {
        // commands run via their action
      }
    } catch (err) {}
    this.close();
  }

  private render() {
    if (!this.list || !this.preview || !this.countEl) return;
    const tr = t();
    const list = this.state.results;
    this.countEl.textContent = String(list.length);
    if (!this.state.query.trim()) {
      this.list.innerHTML = `<div class="sl-empty">${tr.empty}</div>`;
      this.preview.innerHTML = '';
      if (this.input) this.input.setAttribute('aria-activedescendant', '');
      return;
    }
    if (!list.length) {
      this.list.innerHTML = `<div class="sl-empty">${tr.noResults}</div>`;
      this.preview.innerHTML = '';
      if (this.input) this.input.setAttribute('aria-activedescendant', '');
      return;
    }
    // group
    const groups = new Map<string, Result[]>();
    for (const r of list) {
      if (!groups.has(r.group)) groups.set(r.group, []);
      groups.get(r.group)!.push(r);
    }
    let html = '';
    let flatIndex = 0;
    for (const [g, items] of groups) {
      html += `<div class="sl-group"><div class="sl-group-title">${this.groupTitle(g)}</div>`;
      for (let i = 0; i < items.length; i++) {
        const r = items[i];
        const active = flatIndex === this.state.activeIndex ? ' sl-active' : '';
        const id = `sl-item-${flatIndex}`;
        html += `<div id="${id}" class="sl-item${active}" role="option" data-idx="${flatIndex}" data-id="${r.id}">
          <span class="sl-item-icon">${r.icon || ''}</span>
          <div class="sl-item-body">
            <div class="sl-item-title">${this.highlight(r.title)}</div>
            ${r.subtitle ? `<div class="sl-item-sub">${this.highlight(r.subtitle)}</div>` : ''}
          </div>
          ${r.shortcut ? `<span class="sl-item-short">${r.shortcut}</span>` : (i < 9 && flatIndex < 9 ? `<span class="sl-item-short">⌘${i+1}</span>` : '')}
        </div>`;
        flatIndex++;
      }
      html += `</div>`;
    }
    this.list.innerHTML = html;
    // attach clicks
    this.list.querySelectorAll('.sl-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt((el as HTMLElement).dataset.idx || '-1');
        if (idx >= 0 && list[idx]) this.activate(list[idx], new KeyboardEvent('click') as any);
      });
    });
    // update active descendant
    if (this.state.activeIndex >= 0) {
      const activeEl = this.list.querySelector(`#sl-item-${this.state.activeIndex}`) as HTMLElement;
      if (activeEl && this.input) {
        this.input.setAttribute('aria-activedescendant', activeEl.id);
        activeEl.scrollIntoView({ block: 'nearest' });
      }
      this.renderPreview(list[this.state.activeIndex]);
    } else {
      if (this.input) this.input.setAttribute('aria-activedescendant', '');
      this.preview.innerHTML = '';
    }
  }

  private groupTitle(g: string): string {
    const tr = t();
    if (g === 'apps') return tr.apps;
    if (g === 'files') return tr.files;
    if (g === 'settings') return tr.settings;
    if (g === 'calculator') return tr.calculator;
    if (g === 'units') return tr.units;
    if (g === 'commands') return tr.commands;
    if (g === 'web') return tr.web;
    return g;
  }

  private highlight(text: string): string {
    const q = this.state.query.trim();
    if (!q) return this.escape(text);
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    const idx = lower.indexOf(ql);
    if (idx < 0) return this.escape(text);
    return this.escape(text.slice(0, idx)) + '<mark class="sl-mark">' + this.escape(text.slice(idx, idx + q.length)) + '</mark>' + this.escape(text.slice(idx + q.length));
  }

  private escape(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private renderPreview(r: Result) {
    if (!this.preview) return;
    const tr = t();
    if (r.data?.type === 'file' && r.data.node?.type === 'file') {
      const content = (r.data.node.content || '').slice(0, 200);
      this.preview.innerHTML = `<div class="sl-pv"><div class="sl-pv-title">${this.escape(r.title)}</div><pre class="sl-pv-pre">${this.escape(content)}</pre></div>`;
      return;
    }
    if (r.data?.type === 'app') {
      this.preview.innerHTML = `<div class="sl-pv"><div class="sl-pv-title">${this.escape(r.title)}</div><div class="sl-pv-sub">${tr.apps}</div></div>`;
      return;
    }
    if (r.data?.type === 'calc') {
      this.preview.innerHTML = `<div class="sl-pv"><div class="sl-pv-title">${this.escape(r.title)}</div><div class="sl-pv-sub">${r.subtitle || ''}</div></div>`;
      return;
    }
    this.preview.innerHTML = `<div class="sl-pv"><div class="sl-pv-title">${this.escape(r.title)}</div>${r.subtitle ? `<div class="sl-pv-sub">${this.escape(r.subtitle)}</div>` : ''}</div>`;
  }

  update(state: Partial<SpotlightState>) {
    Object.assign(this.state, state);
    this.render();
  }

  destroy() {
    if (this.root && this.container && this.root.parentNode === this.container) {
      this.container.removeChild(this.root);
    }
    if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
    this.root = null;
    this.input = null;
    this.list = null;
    this.preview = null;
    this.countEl = null;
  }
}
