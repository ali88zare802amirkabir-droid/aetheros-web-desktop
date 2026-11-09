import type { AppDefinition } from '../core/types';
import { clockIcon } from '../ui/icons';

export const ClockApp: AppDefinition = {
  id: 'clock',
  name: 'Clock',
  icon: clockIcon,
  defaultSize: { width: 360, height: 460 },
  render() {
    const root = document.createElement('div');
    root.className = 'clock-app';
    root.innerHTML = `
      <div class="clock-shell">
        <div class="clock-face" aria-hidden="true">
          <div class="clock-ring"></div>
          <div class="clock-ticks" data-k="ticks"></div>
          <div class="clock-hand clock-h" data-k="h"></div>
          <div class="clock-hand clock-m" data-k="m"></div>
          <div class="clock-hand clock-s" data-k="s"></div>
          <div class="clock-cap"></div>
        </div>
        <div class="clock-digital">
          <div class="clock-time" data-k="time">--:--:--</div>
          <div class="clock-date" data-k="date"></div>
          <div class="clock-zone" data-k="zone"></div>
        </div>
      </div>`;

    const ticks = root.querySelector('[data-k="ticks"]') as HTMLElement;
    for (let i = 0; i < 60; i++) {
      const t = document.createElement('span');
      t.className = 'clock-tick' + (i % 5 === 0 ? ' is-major' : '');
      t.style.transform = `rotate(${i * 6}deg)`;
      ticks.appendChild(t);
    }

    const hEl = root.querySelector('[data-k="h"]') as HTMLElement;
    const mEl = root.querySelector('[data-k="m"]') as HTMLElement;
    const sEl = root.querySelector('[data-k="s"]') as HTMLElement;
    const timeEl = root.querySelector('[data-k="time"]') as HTMLElement;
    const dateEl = root.querySelector('[data-k="date"]') as HTMLElement;
    const zoneEl = root.querySelector('[data-k="zone"]') as HTMLElement;

    const pad = (n: number) => String(n).padStart(2, '0');
    let iv: number | null = null;
    const tick = () => {
      if (iv != null && !root.isConnected) { window.clearInterval(iv); iv = null; return; }
      const d = new Date();
      const ms = d.getMilliseconds();
      const sec = d.getSeconds() + ms / 1000;
      const min = d.getMinutes() + sec / 60;
      const hr = (d.getHours() % 12) + min / 60;
      hEl.style.transform = `translateX(-50%) rotate(${hr * 30}deg)`;
      mEl.style.transform = `translateX(-50%) rotate(${min * 6}deg)`;
      sEl.style.transform = `translateX(-50%) rotate(${sec * 6}deg)`;
      timeEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      dateEl.textContent = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      try { zoneEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'; } catch { zoneEl.textContent = 'Local time'; }
    };
    tick();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    iv = window.setInterval(tick, reduce ? 1000 : 1000 / 30) as unknown as number;
    return root;
  },
};
