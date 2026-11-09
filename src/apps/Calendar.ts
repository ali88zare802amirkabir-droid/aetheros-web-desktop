import type { AppDefinition } from '../core/types';
import { calendarIcon } from '../ui/icons';

export const CalendarApp: AppDefinition = {
  id: 'calendar',
  name: 'Calendar',
  icon: calendarIcon,
  defaultSize: { width: 400, height: 440 },
  render() {
    const root = document.createElement('div');
    root.className = 'calendar-app';
    root.innerHTML = `
      <div class="cal-head">
        <button class="cal-nav" data-nav="-1" aria-label="Previous month">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="cal-title">
          <div class="cal-month" data-k="month"></div>
          <button class="cal-today-btn" data-nav="today">Today</button>
        </div>
        <button class="cal-nav" data-nav="1" aria-label="Next month">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      <div class="cal-weekdays" aria-hidden="true">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div class="cal-grid" data-k="grid" role="grid" aria-label="Calendar"></div>`;

    const monthEl = root.querySelector('[data-k="month"]') as HTMLElement;
    const gridEl = root.querySelector('[data-k="grid"]') as HTMLElement;
    let view = new Date();
    view.setDate(1);

    const renderMonth = () => {
      const now = new Date();
      monthEl.textContent = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const year = view.getFullYear();
      const month = view.getMonth();
      const first = new Date(year, month, 1).getDay();
      const daysIn = new Date(year, month + 1, 0).getDate();
      const prevDays = new Date(year, month, 0).getDate();
      const cells: string[] = [];
      const total = 42;
      for (let i = 0; i < total; i++) {
        const dayNum = i - first + 1;
        let label = '';
        let cls = 'cal-cell';
        let aria = '';
        if (dayNum < 1) {
          label = String(prevDays + dayNum);
          cls += ' is-out';
        } else if (dayNum > daysIn) {
          label = String(dayNum - daysIn);
          cls += ' is-out';
        } else {
          label = String(dayNum);
          const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === dayNum;
          if (isToday) cls += ' is-today';
          aria = ` aria-label="${view.toLocaleDateString(undefined, { month: 'long' })} ${dayNum}, ${year}${isToday ? ', today' : ''}"`;
        }
        cells.push(`<button type="button" class="${cls}" role="gridcell"${aria}><span>${label}</span></button>`);
      }
      gridEl.innerHTML = cells.join('');
    };

    root.addEventListener('click', (e) => {
      const nav = (e.target as HTMLElement).closest('[data-nav]') as HTMLElement | null;
      if (!nav) return;
      const v = nav.dataset.nav;
      if (v === 'today') { view = new Date(); view.setDate(1); }
      else { view = new Date(view.getFullYear(), view.getMonth() + Number(v), 1); }
      renderMonth();
    });

    renderMonth();
    return root;
  },
};
