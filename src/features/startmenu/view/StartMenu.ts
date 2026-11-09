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

function recentFiles(limit = 5): { name: string; path: string; modified: number }[] {
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

export class StartMenu {
  private root: HTMLElement | null = null;
  private isOpen = false;
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isOpen) this.close();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.toggle(); }
  };

  mount() {
    if (this.root) return;
    const root = document.createElement('div');
    root.className = 'nx-overlay ios-nexus';
    root.innerHTML = `
      <div class="nx-backdrop" data-close="1"></div>
      <div class="nx-panel ios-sheet" role="dialog" aria-modal="true" aria-label="Nexus">
        <div class="ios-grabber" aria-hidden="true"></div>
        <div class="nx-search ios-search">
          <div class="nx-search-wrap">
            <span class="nx-search-ico" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </span>
            <input data-k="q" type="search" placeholder="Search" aria-label="Search apps and files" autocomplete="off" spellcheck="false" />
          </div>
        </div>
        <div class="nx-body ios-body">
          <div class="nx-main ios-content">
            <div class="ios-section-head" data-k="apps-head">
              <span class="nx-section-title">Apps</span>
            </div>
            <div class="nx-grid ios-app-grid" data-k="apps"></div>
            <div class="ios-section-head" data-k="rec-head">
              <span class="nx-section-title">Suggestions</span>
            </div>
            <div class="ios-group" data-k="rec-group">
              <div class="nx-rec-list" data-k="recent"></div>
            </div>
            <div class="ios-actions" data-k="actions">
              <button class="ios-action" type="button" data-act="settings">
                <span class="ios-action-ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6Z"/></svg></span>
                <span class="ios-action-label">Settings</span>
                <span class="ios-action-chevron" aria-hidden="true">›</span>
              </button>
              <button class="ios-action" type="button" data-act="files">
                <span class="ios-action-ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8l-6-4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/><path d="M14 4v4h6"/></svg></span>
                <span class="ios-action-label">Files</span>
                <span class="ios-action-chevron" aria-hidden="true">›</span>
              </button>
            </div>
          </div>
        </div>
        <div class="nx-footer ios-footer">
          <div class="nx-profile ios-profile">
            <div class="nx-avatar ios-avatar">U</div>
            <div class="ios-profile-meta">
              <div class="nx-profile-name" data-k="pname">User</div>
              <div class="nx-profile-sub ios-profile-sub">AetherOS</div>
            </div>
          </div>
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
      const nav = t.closest('[data-nav]') as HTMLElement | null;
      if (nav?.dataset.nav === 'settings') { this.close(); WindowManager.openApp({ id: 'settings' }); return; }
      if (nav?.dataset.nav === 'files') { this.close(); WindowManager.openApp({ id: 'finder' }); return; }
      const appBtn = t.closest('[data-app]') as HTMLElement | null;
      if (appBtn?.dataset.app) { this.close(); WindowManager.openApp({ id: appBtn.dataset.app }); return; }
      const rec = t.closest('[data-rec]') as HTMLElement | null;
      if (rec?.dataset.rec) {
        this.close();
        try { WindowManager.openApp({ id: 'editor', args: { path: rec.dataset.rec } }); } catch { WindowManager.openApp({ id: 'finder' }); }
      }
    });
    root.querySelector('[data-k="q"]')?.addEventListener('input', () => this.render());
    document.addEventListener('keydown', this.onKey);
    this.render();
  }

  private esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  render() {
    if (!this.root) return;
    const q = ((this.root.querySelector('[data-k="q"]') as HTMLInputElement | null)?.value || '').trim();
    this.renderContent(q);
    const pname = this.root.querySelector('[data-k="pname"]');
    if (pname) pname.textContent = (SettingsStore.get('profile.name') as string) || 'User';
    const av = this.root.querySelector('.nx-avatar');
    if (av) av.textContent = (((SettingsStore.get('profile.name') as string) || 'U').trim()[0] || 'U').toUpperCase();
  }

  private renderContent(q: string) {
    if (!this.root) return;
    const ql = q.toLowerCase();
    const apps = AppRegistry.list().filter(a => !ql || a.name.toLowerCase().includes(ql) || a.id.includes(ql));
    const rec = recentFiles(12).filter(r => !ql || r.name.toLowerCase().includes(ql) || r.path.toLowerCase().includes(ql)).slice(0, ql ? 6 : 5);

    const appsHead = this.root.querySelector('[data-k="apps-head"]') as HTMLElement | null;
    const recHead = this.root.querySelector('[data-k="rec-head"]') as HTMLElement | null;
    const recGroup = this.root.querySelector('[data-k="rec-group"]') as HTMLElement | null;
    const actions = this.root.querySelector('[data-k="actions"]') as HTMLElement | null;
    if (appsHead) appsHead.style.display = (ql && !apps.length) ? 'none' : '';
    if (recHead) recHead.style.display = (ql && !rec.length) ? 'none' : '';
    if (recGroup) recGroup.style.display = (ql && !rec.length) ? 'none' : '';
    if (actions) actions.style.display = ql ? 'none' : '';

    const appsEl = this.root.querySelector('[data-k="apps"]');
    if (appsEl) {
      appsEl.innerHTML = apps.map(a => `<button class="nx-app ios-app" data-app="${this.esc(a.id)}" aria-label="${this.esc(a.name)}"><span class="ios-app-icon"><img src="${this.esc(a.icon)}" alt="" draggable="false" /></span><span class="ios-app-label">${this.esc(a.name)}</span></button>`).join('')
        || (!ql ? '<div class="ios-empty">No apps</div>' : '');
      (appsEl as HTMLElement).style.display = (ql && !apps.length) ? 'none' : '';
    }

    const recEl = this.root.querySelector('[data-k="recent"]');
    if (recEl) {
      recEl.innerHTML = rec.map(r => `<button class="nx-rec ios-rec" data-rec="${this.esc(r.path)}"><span class="nx-rec-ico ios-rec-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span><span class="nx-rec-meta ios-rec-meta"><span class="nx-rec-name ios-rec-name">${this.esc(r.name)}</span><span class="nx-rec-sub ios-rec-sub">${relTime(r.modified)}</span></span><span class="ios-rec-chevron" aria-hidden="true">›</span></button>`).join('')
        || (!ql ? '<div class="ios-empty">No recent files</div>' : '');
    }

    const body = this.root.querySelector('.ios-content');
    let empty = body?.querySelector('[data-k="search-empty"]') as HTMLElement | null;
    if (ql && !apps.length && !rec.length) {
      if (!empty && body) { empty = document.createElement('div'); empty.className = 'ios-empty ios-search-empty'; empty.dataset.k = 'search-empty'; body.appendChild(empty); }
      if (empty) empty.textContent = `No results for “${q}”`;
    } else if (empty) empty.remove();
  }

  open() {
    if (!this.root) this.mount();
    if (this.isOpen) return;
    this.isOpen = true;
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