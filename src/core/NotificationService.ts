import { SettingsStore } from '../apps/settings/store';

export type NotifyOpts = { title?: string; message: string; durationMs?: number };

class NotificationServiceImpl {
  private root: HTMLElement | null = null;
  private queue: NotifyOpts[] = [];
  private showing = 0;
  private max = 3;
  private cfg = { enabled: true, position: 'top-right', duration: 4, dnd: false };

  init() {
    this.ensureRoot();
    SettingsStore.subscribe('notif.enabled', v => { this.cfg.enabled = !!v; this.applyPos(); });
    SettingsStore.subscribe('notif.position', v => { this.cfg.position = String(v || 'top-right'); this.applyPos(); });
    SettingsStore.subscribe('notif.duration', v => { this.cfg.duration = Math.max(1, +v || 4); });
    SettingsStore.subscribe('notif.dnd', v => { this.cfg.dnd = !!v; });
  }

  private ensureRoot() {
    if (this.root && document.body.contains(this.root)) return;
    this.root = document.createElement('div');
    this.root.className = 'os-toast-host';
    this.root.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.root);
    this.applyPos();
  }

  private applyPos() {
    this.ensureRoot();
    const r = this.root!;
    r.className = 'os-toast-host pos-' + (this.cfg.position || 'top-right');
  }

  notify(opts: NotifyOpts | string) {
    const o: NotifyOpts = typeof opts === 'string' ? { message: opts } : opts;
    if (!o.message) return;
    if (!this.cfg.enabled || this.cfg.dnd) return;
    if (this.showing >= this.max) { this.queue.push(o); return; }
    this.show(o);
  }

  private show(o: NotifyOpts) {
    this.ensureRoot();
    this.showing++;
    const el = document.createElement('div');
    el.className = 'os-toast';
    el.innerHTML = `${o.title ? `<div class="os-toast-title"></div>` : ''}<div class="os-toast-msg"></div>`;
    if (o.title) (el.querySelector('.os-toast-title') as HTMLElement).textContent = o.title;
    (el.querySelector('.os-toast-msg') as HTMLElement).textContent = o.message;
    this.root!.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const ms = o.durationMs ?? this.cfg.duration * 1000;
    window.setTimeout(() => {
      el.classList.remove('show');
      window.setTimeout(() => { el.remove(); this.showing--; if (this.queue.length) this.show(this.queue.shift()!); }, 180);
    }, ms);
  }
}

export const NotificationService = new NotificationServiceImpl();
