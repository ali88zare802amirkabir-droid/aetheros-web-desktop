import { formatClockParts, formatDate, getStorageInfo, fmtBytes, pseudoMetrics } from '../logic/data';
import { SettingsStore } from '../../../apps/settings/store';

function ringSvg(id: string, pct: number, color: string) {
  const r = 27;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return `
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id="wg-g-${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="var(--wg-accent3)" />
        </linearGradient>
      </defs>
      <circle class="wg-ring-track" cx="36" cy="36" r="${r}"></circle>
      <circle class="wg-ring-val" cx="36" cy="36" r="${r}" stroke="url(#wg-g-${id})" stroke-dasharray="${c}" stroke-dashoffset="${off}"></circle>
    </svg>`;
}

export class WidgetsRail {
  private root: HTMLElement | null = null;
  private timer: number | null = null;
  private unsub: Array<() => void> = [];
  private dragOff = () => {};

  private restorePos() {
    if (!this.root) return;
    try {
      const raw = localStorage.getItem('aether.widgets.pos');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.left === 'number' && typeof p?.top === 'number') {
        this.applyPos(p.left, p.top);
      }
    } catch {}
  }

  private applyPos(left: number, top: number) {
    if (!this.root) return;
    const r = this.root.getBoundingClientRect();
    const maxL = Math.max(8, window.innerWidth - (r.width || 300) - 8);
    const maxT = Math.max(8, window.innerHeight - 80);
    const l = Math.min(Math.max(8, left), maxL);
    const t = Math.min(Math.max(40, top), maxT);
    this.root.style.left = `${l}px`;
    this.root.style.top = `${t}px`;
    this.root.style.right = 'auto';
    this.root.style.insetInlineEnd = 'auto';
  }

  private bindDrag() {
    const root = this.root;
    if (!root) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // allow dragging from rail background or card chrome; ignore if selecting text
      if (target.closest('a,button,input,textarea,select')) return;
      const rect = root.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      root.classList.add('dragging');
      root.setPointerCapture?.(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        this.applyPos(ev.clientX - sx, ev.clientY - sy);
      };
      const onUp = () => {
        root.classList.remove('dragging');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        try {
          const r = root.getBoundingClientRect();
          localStorage.setItem('aether.widgets.pos', JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
        } catch {}
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };
    root.addEventListener('pointerdown', onDown);
    const onResize = () => {
      try {
        const raw = localStorage.getItem('aether.widgets.pos');
        if (!raw) return; const p = JSON.parse(raw);
        if (typeof p?.left === 'number' && typeof p?.top === 'number') this.applyPos(p.left, p.top);
      } catch {}
    };
    window.addEventListener('resize', onResize);
    this.dragOff = () => { root.removeEventListener('pointerdown', onDown); window.removeEventListener('resize', onResize); };
  }

  mount() {
    if (this.root) return;
    const root = document.createElement('aside');
    root.className = 'wg-rail';
    root.setAttribute('aria-label', 'Widgets');
    root.innerHTML = `
      <section class="wg-card" data-wg="clock">
        <div class="wg-clock-time" data-k="time">--:--</div>
        <div class="wg-clock-date" data-k="date"></div>
      </section>
      <section class="wg-card" data-wg="monitor">
        <div class="wg-title">System Monitor</div>
        <div class="wg-rings">
          <div class="wg-ring" data-r="cpu"><div class="wg-ring-svg"></div><div class="wg-ring-center"><div class="wg-ring-pct">--%</div><div class="wg-ring-label">CPU</div></div></div>
          <div class="wg-ring" data-r="mem"><div class="wg-ring-svg"></div><div class="wg-ring-center"><div class="wg-ring-pct">--%</div><div class="wg-ring-label">Memory</div></div></div>
          <div class="wg-ring" data-r="net"><div class="wg-ring-svg"></div><div class="wg-ring-center"><div class="wg-ring-pct">--%</div><div class="wg-ring-label">Network</div></div></div>
        </div>
      </section>
      <section class="wg-card" data-wg="storage">
        <div class="wg-title">Storage</div>
        <div class="wg-storage-bar"><div class="wg-storage-fill" data-k="fill"></div></div>
        <div class="wg-storage-meta"><span data-k="used">--</span><strong data-k="total">--</strong></div>
      </section>
      <section class="wg-card" data-wg="status">
        <div class="wg-title">Nexus Status</div>
        <div class="wg-status-row"><span class="wg-status-k">Core</span><span class="wg-status-v"><span class="wg-dot"></span>Online</span></div>
        <div class="wg-status-row"><span class="wg-status-k">Security</span><span class="wg-status-v">Shielded</span></div>
        <div class="wg-status-row"><span class="wg-status-k">Mode</span><span class="wg-status-v">Aether</span></div>
      </section>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.restorePos();
    this.bindDrag();
    this.update();
    this.timer = window.setInterval(() => this.update(), 1000);
    this.unsub.push(SettingsStore.subscribe('lang.language', () => this.update()));
  }

  async update() {
    if (!this.root) return;
    const now = new Date();
    const lang = (SettingsStore.get('lang.language') as string) || 'en';
    const { time } = formatClockParts(now);
    const tEl = this.root.querySelector('[data-k="time"]'); if (tEl) tEl.textContent = time;
    const dEl = this.root.querySelector('[data-k="date"]'); if (dEl) dEl.textContent = formatDate(now, lang);
    // rings
    const m = pseudoMetrics(Date.now());
    (['cpu','mem','net'] as const).forEach((k, i) => {
      const colors = ['var(--wg-accent)', 'var(--wg-accent2)', 'var(--wg-accent3)'];
      const wrap = this.root!.querySelector(`[data-r="${k}"]`);
      if (!wrap) return;
      const svgWrap = wrap.querySelector('.wg-ring-svg');
      const pctEl = wrap.querySelector('.wg-ring-pct');
      if (svgWrap) svgWrap.innerHTML = ringSvg(k, m[k], colors[i]);
      if (pctEl) pctEl.textContent = `${m[k]}%`;
    });
    // storage (throttled feel via occasional update is fine; we just run)
    if (now.getSeconds() % 5 === 0) {
      const s = await getStorageInfo();
      const pct = s.quota ? Math.min(100, (s.usage / s.quota) * 100) : 0;
      const fill = this.root.querySelector('[data-k="fill"]') as HTMLElement | null;
      if (fill) fill.style.width = `${pct}%`;
      const used = this.root.querySelector('[data-k="used"]');
      const total = this.root.querySelector('[data-k="total"]');
      if (used) used.textContent = `${fmtBytes(s.usage)} used`;
      if (total) total.textContent = fmtBytes(s.quota || 0);
    }
  }

  destroy() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.dragOff();
    this.dragOff = () => {};
    this.unsub.forEach(u => u());
    this.unsub = [];
    if (this.root?.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
  }
}
