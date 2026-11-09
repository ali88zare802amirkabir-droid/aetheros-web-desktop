import { AppRegistry } from '../../../core/AppRegistry';
import { WindowManager } from '../../../core/WindowManager';
import { VFS } from '../../../core/VFS';
import { SettingsStore } from '../../../apps/settings/store';

function relTime(ts?: number) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
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
    root.className = 'nx-overlay';
    root.innerHTML = `
      <div class="nx-backdrop" data-close="1"></div>
      <div class="nx-panel" role="dialog" aria-label="Nexus Start">
        <div class="nx-search"><div class="nx-search-wrap">
          <span class="nx-search-ico"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg></span>
          <input data-k="q" placeholder="Search apps, files, commands..." />
        </div></div>
        <div class="nx-body">
          <nav class="nx-side">
            <button class="nx-nav active" data-nav="home">Home</button>
            <button class="nx-nav" data-nav="apps">Apps</button>
            <button class="nx-nav" data-nav="files">Files</button>
            <button class="nx-nav" data-nav="settings">Settings</button>
          </nav>
          <div class="nx-main">
            <div class="nx-section-title">Pinned Apps</div>
            <div class="nx-grid" data-k="apps"></div>
            <div class="nx-section-title">Recommended</div>
            <div class="nx-rec-list" data-k="recent"></div>
          </div>
        </div>
        <div class="nx-footer">
          <div class="nx-profile">
            <div class="nx-avatar">U</div>
            <div><div class="nx-profile-name" data-k="pname">User</div><div class="nx-profile-sub"><span class="nx-online"></span>Online</div></div>
          </div>
          <button class="nx-power" data-act="settings">Settings</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-close]')) this.close();
      const nav = t.closest('[data-nav]') as HTMLElement | null;
      if (nav) {
        const n = nav.dataset.nav;
        root.querySelectorAll('.nx-nav').forEach(b => b.classList.toggle('active', b === nav));
        if (n === 'settings') { this.close(); WindowManager.openApp({ id: 'settings' }); }
        if (n === 'apps') this.renderApps((root.querySelector('[data-k="q"]') as HTMLInputElement)?.value || '');
      }
      const appBtn = t.closest('[data-app]') as HTMLElement | null;
      if (appBtn?.dataset.app) { this.close(); WindowManager.openApp({ id: appBtn.dataset.app }); }
      const rec = t.closest('[data-rec]') as HTMLElement | null;
      if (rec?.dataset.rec) {
        this.close();
        try { WindowManager.openApp({ id: 'editor', args: { path: rec.dataset.rec } }); } catch { WindowManager.openApp({ id: 'finder' }); }
      }
      if (t.closest('[data-act="settings"]')) { this.close(); WindowManager.openApp({ id: 'settings' }); }
    });
    root.querySelector('[data-k="q"]')?.addEventListener('input', (e) => {
      this.renderApps((e.target as HTMLInputElement).value);
    });
    document.addEventListener('keydown', this.onKey);
    this.render();
  }

  render() {
    if (!this.root) return;
    this.renderApps('');
    const pname = this.root.querySelector('[data-k="pname"]');
    if (pname) pname.textContent = (SettingsStore.get('profile.name') as string) || 'User';
    const rec = recentFiles(6);
    const recEl = this.root.querySelector('[data-k="recent"]');
    if (recEl) {
      recEl.innerHTML = rec.map(r => `<button class="nx-rec" data-rec="${r.path.replace(/"/g,'&quot;')}"><span class="nx-rec-ico"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/></svg></span><span class="nx-rec-meta"><div class="nx-rec-name">${r.name}</div><div class="nx-rec-sub">${relTime(r.modified)}</div></span></button>`).join('') || '<div class="wg-status-k">No recent files</div>';
    }
  }

  renderApps(q: string) {
    if (!this.root) return;
    const apps = AppRegistry.list().filter(a => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.id.includes(q.toLowerCase())).slice(0, 8);
    const el = this.root.querySelector('[data-k="apps"]');
    if (el) {
      el.innerHTML = apps.map(a => `<button class="nx-app" data-app="${a.id}"><img src="${a.icon}" alt="" /><span>${a.name}</span></button>`).join('');
    }
  }

  open() { if (!this.root) this.mount(); this.isOpen = true; this.render(); this.root?.classList.add('open'); (this.root?.querySelector('[data-k="q"]') as HTMLInputElement | null)?.focus(); }
  close() { this.isOpen = false; this.root?.classList.remove('open'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  destroy() { document.removeEventListener('keydown', this.onKey); this.root?.remove(); this.root = null; }
}
