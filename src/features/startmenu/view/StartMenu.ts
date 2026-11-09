import { AppRegistry } from '../../../core/AppRegistry';
import { WindowManager } from '../../../core/WindowManager';
import { VFS } from '../../../core/VFS';
import { SettingsStore } from '../../../apps/settings/store';

function relTime(ts?: number) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function recentFiles(limit = 6): { name: string; path: string; modified: number }[] {
  const out: { name: string; path: string; modified: number }[] = [];
  const walk = (path: string, node: any) => {
    if (!node) return;
    if (node.type === 'file') out.push({ name: node.name, path: path ? `${path}/${node.name}` : node.name, modified: node.modified || 0 });
    if (node.type === 'folder' && node.children) {
      Object.values(node.children).forEach((c: any) => walk(path ? `${path}/${node.name}` : node.name, c));
    }
  };
  try {
    if (VFS.root.children) Object.values(VFS.root.children).forEach((c: any) => walk('', c));
  } catch {}
  return out.sort((a, b) => b.modified - a.modified).slice(0, limit);
}

type Res = { kind: 'app'; id: string; icon: string; title: string; meta: string } | { kind: 'file'; path: string; title: string; meta: string };

export class StartMenu {
  private root: HTMLElement | null = null;
  private isOpen = false;
  private sel = 0;
  private results: Res[] = [];
  private onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.toggle(); return; }
    if (!this.isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.moveSel(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.moveSel(-1); return; }
    if (e.key === 'Enter') {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== this.root?.querySelector('[data-k="q"]') && active.closest('.nx-overlay')) return;
      if (this.results[this.sel]) { e.preventDefault(); this.launch(this.results[this.sel]); }
    }
  };

  mount() {
    if (this.root) return;
    const root = document.createElement('div');
    root.className = 'nx-overlay ios-nexus';
    root.innerHTML = `
      <div class="nx-backdrop" data-close="1"></div>
      <div class="nx-panel ios-sheet" role="dialog" aria-modal="true" aria-label="Nexus">
        <div class="nx-search ios-search">
          <div class="nx-search-wrap">
            <span class="nx-search-ico" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.2-3.2"/></svg>
            </span>
            <input data-k="q" type="search" placeholder="Search apps and files" aria-label="Search apps and files" autocomplete="off" spellcheck="false" />
            <kbd class="nx-kbd" aria-hidden="true">ESC</kbd>
          </div>
        </div>
        <div class="nx-body ios-body">
          <div class="nx-main ios-content" data-k="content"></div>
        </div>
        <div class="nx-footer ios-footer">
          <div class="nx-profile ios-profile">
            <div class="nx-avatar ios-avatar">U</div>
            <div class="ios-profile-meta">
              <div class="nx-profile-name" data-k="pname">User</div>
              <div class="nx-profile-sub ios-profile-sub">Nexus · AetherOS</div>
            </div>
          </div>
          <div class="nx-hints" aria-hidden="true"><span>↑↓</span><span>Enter</span></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-close]')) { this.close(); return; }
      const act = t.closest('[data-act]') as HTMLElement | null;
      if (act?.dataset.act === 'settings') { this.close(); WindowManager.openApp({ id: 'settings' }); return; }
      if (act?.dataset.act === 'files') { this.close(); WindowManager.openApp({ id: 'finder' }); return; }
      const app = t.closest('[data-app]') as HTMLElement | null;
      if (app?.dataset.app) { this.close(); WindowManager.openApp({ id: app.dataset.app }); return; }
      const row = t.closest('[data-i]') as HTMLElement | null;
      if (row?.dataset.i != null) {
        const i = +row.dataset.i;
        if (this.results[i]) this.launch(this.results[i]);
      }
    });
    root.querySelector('[data-k="q"]')?.addEventListener('input', () => { this.sel = 0; this.render(); });
    document.addEventListener('keydown', this.onKey);
    this.render();
  }

  private esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  private fileIco() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
  }

  private rowHtml(r: Res, i: number, sel: boolean) {
    const ico = r.kind === 'app'
      ? `<span class="nx-ico nx-ico-app"><img src="${this.esc(r.icon)}" alt="" draggable="false" /></span>`
      : `<span class="nx-ico nx-ico-file">${this.fileIco()}</span>`;
    return `<button type="button" class="nx-row${sel ? ' is-sel' : ''}" data-i="${i}" role="option" aria-selected="${sel}">
      ${ico}
      <span class="nx-row-main"><span class="nx-row-title">${this.esc(r.title)}</span><span class="nx-row-meta">${this.esc(r.meta)}</span></span>
      <span class="nx-row-kind">${r.kind === 'app' ? 'App' : 'File'}</span>
    </button>`;
  }

  private buildResults(q: string): { apps: Res[]; rec: Res[]; list: Res[] } {
    const ql = q.toLowerCase().trim();
    const apps: Res[] = AppRegistry.list()
      .filter(a => !ql || a.name.toLowerCase().includes(ql) || a.id.includes(ql))
      .map(a => ({ kind: 'app', id: a.id, icon: a.icon, title: a.name, meta: 'Application' }));
    const rec: Res[] = recentFiles(ql ? 8 : 6)
      .filter(r => !ql || r.name.toLowerCase().includes(ql) || r.path.toLowerCase().includes(ql))
      .map(r => ({ kind: 'file', path: r.path, title: r.name, meta: relTime(r.modified) || r.path }));
    const list = ql ? [...apps, ...rec].slice(0, 12) : rec;
    return { apps, rec, list };
  }

  render() {
    if (!this.root) return;
    const q = ((this.root.querySelector('[data-k="q"]') as HTMLInputElement | null)?.value || '');
    const ql = q.trim().toLowerCase();
    const { apps, rec, list } = this.buildResults(q);
    this.results = ql ? list : rec;
    if (this.sel >= this.results.length) this.sel = Math.max(0, this.results.length - 1);

    const pname = this.root.querySelector('[data-k="pname"]');
    if (pname) pname.textContent = (SettingsStore.get('profile.name') as string) || 'User';
    const av = this.root.querySelector('.nx-avatar');
    if (av) av.textContent = (((SettingsStore.get('profile.name') as string) || 'U').trim()[0] || 'U').toUpperCase();

    const content = this.root.querySelector('[data-k="content"]');
    if (!content) return;

    if (ql) {
      if (!list.length) {
        content.innerHTML = `<div class="nx-empty"><div class="nx-empty-glyph">⌘</div><div class="nx-empty-title">No results</div><div class="nx-empty-sub">No matches for “${this.esc(q.trim())}”</div></div>`;
      } else {
        content.innerHTML = `<div class="nx-section"><div class="nx-section-title">Top Hits</div><div class="nx-list" role="listbox">${list.map((r, i) => this.rowHtml(r, i, i === this.sel)).join('')}</div></div>`;
      }
      return;
    }

    const quick = apps.slice(0, 6);
    content.innerHTML = `
      <div class="nx-section">
        <div class="nx-section-title">Quick Apps</div>
        <div class="nx-quick">${quick.map((a) => a.kind === 'app' ? `<button type="button" class="nx-qapp" data-i="${-1}" data-app="${this.esc(a.id)}" aria-label="${this.esc(a.title)}"><span class="nx-qico"><img src="${this.esc(a.icon)}" alt="" draggable="false" /></span><span class="nx-qlabel">${this.esc(a.title)}</span></button>` : '').join('')}</div>
      </div>
      <div class="nx-section">
        <div class="nx-section-title">Recent</div>
        ${rec.length ? `<div class="nx-list" role="listbox">${rec.map((r, i) => this.rowHtml(r, i, i === this.sel)).join('')}</div>` : `<div class="nx-empty-inline">No recent files</div>`}
      </div>
      <div class="nx-section nx-actions-sec">
        <div class="nx-actions">
          <button type="button" class="nx-act" data-act="files"><span class="nx-act-ico">${this.fileIco()}</span><span>Files</span></button>
          <button type="button" class="nx-act" data-act="settings"><span class="nx-act-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6Z"/></svg></span><span>Settings</span></button>
        </div>
      </div>`;

    // quick apps handled by delegated [data-app] listener
  }

  private moveSel(dir: number) {
    if (!this.results.length) return;
    this.sel = (this.sel + dir + this.results.length) % this.results.length;
    this.render();
    this.root?.querySelector('.nx-row.is-sel')?.scrollIntoView({ block: 'nearest' });
  }

  private launch(r: Res) {
    this.close();
    if (r.kind === 'app') WindowManager.openApp({ id: r.id });
    else { try { WindowManager.openApp({ id: 'editor', args: { path: r.path } }); } catch { WindowManager.openApp({ id: 'finder' }); } }
  }

  open() {
    if (!this.root) this.mount();
    if (this.isOpen) return;
    this.isOpen = true;
    this.sel = 0;
    const q = this.root?.querySelector('[data-k="q"]') as HTMLInputElement | null;
    if (q) q.value = '';
    this.render();
    this.root?.classList.remove('closing');
    this.root?.classList.add('open');
    requestAnimationFrame(() => q?.focus());
  }
  close() {
    if (!this.root || !this.isOpen) return;
    this.isOpen = false;
    this.root.classList.add('closing');
    const done = () => { this.root?.classList.remove('open', 'closing'); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    window.setTimeout(done, 170);
  }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  destroy() { document.removeEventListener('keydown', this.onKey); this.root?.remove(); this.root = null; }
}