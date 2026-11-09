import type { OSWindow } from './types';
import { State } from './State';
import { EventBus } from './EventBus';
import { AppRegistry } from './AppRegistry';
import { VFS } from './VFS';
import { SettingsStore } from '../apps/settings/store';

function numVar(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function insets() {
  const top = numVar('--menubar-h', 28);
  const pos = document.documentElement.dataset.dockPos || 'bottom';
  const dock = numVar('--dock-h', 48) + 12;
  return {
    top,
    bottom: pos === 'bottom' ? dock : 0,
    left: pos === 'left' ? dock : 0,
    right: pos === 'right' ? dock : 0,
  };
}

class WM {
  nextZIndex = 100;
  private snapEl: HTMLElement | null = null;
  private snapRect: {x:number;y:number;width:number;height:number}|null = null;
  private pendingArgs = new Map<string, Record<string, unknown>>();

  init(): void {
    EventBus.on('openApp', (payload) => this.openApp(payload as any));
    EventBus.on('windowClosed', ({ windowId }) => this.closeWindow(windowId));
    EventBus.on('windowMaximized', ({ windowId }) => this.toggleMaximize(windowId));
    this.applyWmSettings();
    SettingsStore.subscribe('wm.snap', () => { if (!this.snapEnabled()) this.showSnap(null); });
    SettingsStore.subscribe('wm.buttonStyle', () => this.applyWmSettings());
    SettingsStore.subscribe('wm.shadow', () => this.applyWmSettings());
    SettingsStore.subscribe('wm.animations', () => this.applyWmSettings());
    SettingsStore.subscribe('appearance.reducedMotion', () => this.applyWmSettings());
  }

  private reducedMotionOn(): boolean {
    const v = SettingsStore.get('appearance.reducedMotion') as string;
    if (v === 'on') return true;
    if (v === 'off') return false;
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  private animationsEnabled(): boolean { return !!SettingsStore.get('wm.animations') && !this.reducedMotionOn(); }
  private snapEnabled(): boolean { return !!SettingsStore.get('wm.snap'); }
  private applyWmSettings(): void {
    const style = (SettingsStore.get('wm.buttonStyle') as string) || 'mac';
    const shadow = !!SettingsStore.get('wm.shadow');
    document.documentElement.dataset.wmButtonStyle = style;
    document.querySelectorAll<HTMLElement>('.window').forEach(el => {
      el.dataset.buttonStyle = style;
      el.classList.toggle('no-shadow', !shadow);
      el.classList.toggle('no-anim', !this.animationsEnabled());
    });
  }

  private ensureSnap() { if(!this.snapEl){ this.snapEl=document.createElement('div'); this.snapEl.className='snap-preview'; document.body.appendChild(this.snapEl);} return this.snapEl; }
  private showSnap(r:{x:number;y:number;width:number;height:number}|null){ const el=this.ensureSnap(); if(!r){ el.style.display='none'; this.snapRect=null; return;} this.snapRect=r; Object.assign(el.style,{display:'block',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'}); }
  private snapFor(ev:MouseEvent){ const ins=insets(); const m=10, W=window.innerWidth, H=window.innerHeight-ins.bottom; const workW=W-ins.left-ins.right, workH=H-ins.top; const L=ins.left, T=ins.top;
    const l=ev.clientX<ins.left+m, r=ev.clientX>W-ins.right-m, t=ev.clientY<T+m, b=ev.clientY>H-m;
    if(t&&l) return {x:L,y:T,width:workW/2,height:workH/2}; if(t&&r) return {x:L+workW/2,y:T,width:workW/2,height:workH/2};
    if(b&&l) return {x:L,y:T+workH/2,width:workW/2,height:workH/2}; if(b&&r) return {x:L+workW/2,y:T+workH/2,width:workW/2,height:workH/2};
    if(t) return {x:L,y:T,width:workW,height:workH}; if(l) return {x:L,y:T,width:workW/2,height:workH}; if(r) return {x:L+workW/2,y:T,width:workW/2,height:workH}; return null; }

  openApp(payload: string | { id: string; newInstance?: boolean; args?: Record<string, unknown> }): void {
    const appId = typeof payload === 'string' ? payload : payload.id;
    const newInstance = typeof payload === 'object' && !!payload.newInstance;
    const args = typeof payload === 'object' ? payload.args : undefined;
    if (!newInstance) {
      const existing = State.state.windows.find((w) => w.appId === appId);
      if (existing) {
        if (existing.isMinimized) this.restoreWindow(existing.id);
        else this.focusWindow(existing.id);
        return;
      }
    }
    const app = AppRegistry.get(appId);
    if (!app) return;
    const size = app.defaultSize;
    const win: OSWindow = {
      id: `window_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      appId, title: app.name, icon: app.icon,
      x: 60 + Math.random() * 120, y: 50 + Math.random() * 80,
      width: size.width, height: size.height,
      zIndex: ++this.nextZIndex, isMaximized: false, isMinimized: false,
    };
    if (args) this.pendingArgs.set(win.id, args);
    State.state.windows.push(win);
    State.save();
    this.renderWindow(win);
    this.focusWindow(win.id);
    EventBus.emit('windowCreated', win);
  }

  private renderWindow(win: OSWindow): void {
    const app = AppRegistry.get(win.appId);
    if (!app) return;
    const desktop = document.getElementById('desktop')!;
    const el = document.createElement('div');
    el.className = this.animationsEnabled() ? 'window opening' : 'window';
    el.id = win.id;
    this.applyGeom(el, win);
    el.innerHTML = `
      <div class="window-header">
        <div class="title">${win.title}</div>
        <div class="controls">
          <span class="control close" data-action="close"></span>
          <span class="control minimize" data-action="minimize"></span>
          <span class="control maximize" data-action="maximize"></span>
        </div>
      </div>
      <div class="window-content"></div>
      ${['tl','tr','bl','br','top','bottom','left','right'].map(d=>`<div class="resize-handle ${d}" data-dir="${d}"></div>`).join('')}
    `;
    el.dataset.buttonStyle = (SettingsStore.get('wm.buttonStyle') as string) || 'mac';
    if (!SettingsStore.get('wm.shadow')) el.classList.add('no-shadow');
    if (!this.animationsEnabled()) el.classList.add('no-anim');
    const content = el.querySelector('.window-content') as HTMLElement;
    content.appendChild(app.render(win, VFS, this.pendingArgs.get(win.id)));
    this.pendingArgs.delete(win.id);
    desktop.appendChild(el);
    this.bindWindow(el, win);
    if (this.animationsEnabled()) setTimeout(() => el.classList.remove('opening'), 200);
  }

  private bindWindow(el: HTMLElement, win: OSWindow): void {
    const header = el.querySelector('.window-header') as HTMLElement;
    header.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.control')) return;
      this.startDrag(e, el, win);
    });
    header.addEventListener('dblclick', () => this.toggleMaximize(win.id));
    el.addEventListener('mousedown', () => this.focusWindow(win.id));
    el.querySelectorAll('.control').forEach((c) => c.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = (c as HTMLElement).dataset.action;
      if (a === 'close') EventBus.emit('windowClosed', { windowId: win.id });
      if (a === 'minimize') this.minimizeWindow(win.id);
      if (a === 'maximize') this.toggleMaximize(win.id);
    }));
    el.querySelectorAll('.resize-handle').forEach((h) => h.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startResize(e as MouseEvent, el, win, (h as HTMLElement).dataset.dir!);
    }));
  }

  private applyGeom(el: HTMLElement, win: OSWindow): void {
    el.style.left = win.x + 'px'; el.style.top = win.y + 'px';
    el.style.width = win.width + 'px'; el.style.height = win.height + 'px';
    el.style.zIndex = String(win.zIndex);
  }

  private startDrag(e: MouseEvent, el: HTMLElement, win: OSWindow): void {
    if (win.isMaximized) { this.toggleMaximize(win.id); }
    const sx = e.clientX - win.x, sy = e.clientY - win.y;
    const move = (ev: MouseEvent) => {
      const ins = insets();
      win.x = Math.min(Math.max(ins.left, ev.clientX - sx), window.innerWidth - ins.right - win.width);
      win.y = Math.min(Math.max(ins.top, ev.clientY - sy), window.innerHeight - ins.bottom - 60);
      this.applyGeom(el, win);
      if (this.snapEnabled()) this.showSnap(this.snapFor(ev));
      else this.showSnap(null);
    };
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      if (this.snapEnabled() && this.snapRect) { Object.assign(win, this.snapRect, { isMaximized: false }); this.applyGeom(el, win); }
      this.showSnap(null); State.save();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  private startResize(e: MouseEvent, el: HTMLElement, win: OSWindow, dir: string): void {
    if (win.isMaximized) return;
    const sx = e.clientX, sy = e.clientY, { x, y, width: w, height: h } = win;
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let nx = x, ny = y, nw = w, nh = h;
      if (dir.includes('right')) nw = w + dx;
      if (dir.includes('left')) { nw = w - dx; nx = x + dx; }
      if (dir.includes('bottom')) nh = h + dy;
      if (dir.includes('top')) { nh = h - dy; ny = y + dy; }
      nw = Math.max(200, nw); nh = Math.max(150, nh);
      const ins = insets();
      if (nx < ins.left) { nw += nx - ins.left; nx = ins.left; }
      if (ny < ins.top) { nh += ny - ins.top; ny = ins.top; }
      if (nx + nw > window.innerWidth - ins.right) nw = window.innerWidth - ins.right - nx;
      if (ny + nh > window.innerHeight - ins.bottom) nh = window.innerHeight - ins.bottom - ny;
      Object.assign(win, { x: nx, y: ny, width: nw, height: nh });
      this.applyGeom(el, win);
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); State.save(); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  minimizeWindow(id: string): void {
    const win = State.state.windows.find((w) => w.id === id);
    if (!win) return;
    const el = document.getElementById(id);
    const finish = () => {
      if (el) { el.style.display = 'none'; el.classList.remove('genie-min'); el.style.transform = ''; }
      win.isMinimized = true;
      if (!State.state.minimizedWindows.find((w) => w.id === id)) State.state.minimizedWindows.push(win);
      if (State.state.activeWindowId === id) State.state.activeWindowId = null;
      State.save();
      EventBus.emit('windowMinimized', { windowId: id });
    };
    const anim = this.animationsEnabled() && (SettingsStore.get('dock.minimizeAnim') as string) !== 'scale';
    if (el && anim) {
      const dockIcon = document.querySelector<HTMLElement>(`#dock .dock-icon[data-app-id="${win.appId}"]`);
      const wr = el.getBoundingClientRect(); const dr = dockIcon?.getBoundingClientRect();
      if (dr) {
        const tx = (dr.left + dr.width/2) - (wr.left + wr.width/2);
        const ty = (dr.top) - (wr.top + wr.height);
        el.animate([{ transform:'scale(1,1) translate(0,0)', opacity:1, borderRadius:'12px' }, { transform:`translate(${tx*0.6}px,${ty*0.7}px) scale(.4,.08)`, opacity:.5, offset:.6 }, { transform:`translate(${tx}px,${ty}px) scale(.1,.02)`, opacity:0 }], { duration: 320, easing: 'cubic-bezier(.4,0,1,.6)' }).onfinish = finish;
        return;
      }
    }
    if (el && this.animationsEnabled() && (SettingsStore.get('dock.minimizeAnim') as string) === 'scale') {
      el.animate([{transform:'scale(1)',opacity:1},{transform:'scale(.85)',opacity:0}], {duration:160, easing:'ease-out'}).onfinish = finish;
      return;
    }
    finish();
  }

  restoreWindow(id: string): void {
    const win = State.state.windows.find((w) => w.id === id);
    if (!win) return;
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
    win.isMinimized = false;
    State.state.minimizedWindows = State.state.minimizedWindows.filter((w) => w.id !== id);
    State.save();
    EventBus.emit('windowRestored', { windowId: id });
    this.focusWindow(id);
  }

  toggleMaximize(id: string): void {
    const win = State.state.windows.find((w) => w.id === id);
    const el = document.getElementById(id);
    if (!win || !el) return;
    if (!win.isMaximized) {
      const ins = insets();
      Object.assign(win, { savedX: win.x, savedY: win.y, savedWidth: win.width, savedHeight: win.height });
      Object.assign(win, { x: ins.left, y: ins.top, width: window.innerWidth - ins.left - ins.right, height: window.innerHeight - ins.top - ins.bottom, isMaximized: true });
      EventBus.emit('windowMaximized', { windowId: id, windowEl: el });
    } else {
      Object.assign(win, { x: win.savedX ?? win.x, y: win.savedY ?? win.y, width: win.savedWidth ?? win.width, height: win.savedHeight ?? win.height, isMaximized: false });
      EventBus.emit('windowUnmaximized', { windowId: id });
    }
    this.applyGeom(el, win);
    State.save();
  }

  focusWindow(id: string): void {
    const win = State.state.windows.find((w) => w.id === id);
    if (!win) return;
    if (win.isMinimized) { this.restoreWindow(id); return; }
    document.querySelectorAll('.window').forEach((w) => w.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); win.zIndex = ++this.nextZIndex; el.style.zIndex = String(win.zIndex); }
    State.update({ activeWindowId: id, focusedAppId: win.appId });
    EventBus.emit('windowFocused', { windowId: id, win });
  }

  closeWindow(id: string): void {
    const wasActive = State.state.activeWindowId === id;
    const el = document.getElementById(id);
    if (el) {
      if (this.animationsEnabled()) { el.classList.add('closing'); setTimeout(() => el.remove(), 200); }
      else el.remove();
    }
    State.state.windows = State.state.windows.filter((w) => w.id !== id);
    State.state.minimizedWindows = State.state.minimizedWindows.filter((w) => w.id !== id);
    if (wasActive) {
      State.state.activeWindowId = null;
      State.state.focusedAppId = null;
      State.save();
      const next = [...State.state.windows].reverse().find((w) => !w.isMinimized);
      if (next) this.focusWindow(next.id);
    } else {
      State.save();
    }
  }

  constrainWindows(): void {
    const ins = insets();
    for (const win of State.state.windows) {
      const el = document.getElementById(win.id);
      if (win.isMaximized) {
        Object.assign(win, { x: ins.left, y: ins.top, width: window.innerWidth - ins.left - ins.right, height: window.innerHeight - ins.top - ins.bottom });
        if (el) this.applyGeom(el, win);
        continue;
      }
      win.x = Math.max(ins.left, Math.min(win.x, window.innerWidth - ins.right - 80));
      win.y = Math.max(ins.top, Math.min(win.y, window.innerHeight - ins.bottom - 40));
      if (el) this.applyGeom(el, win);
    }
    State.save();
  }

  rehydrate(): void {
    // Sync minimizedWindows references to actual window objects
    const ids = new Set(State.state.minimizedWindows.map((w) => w.id));
    State.state.minimizedWindows = State.state.windows.filter((w) => ids.has(w.id) || w.isMinimized);
    for (const win of [...State.state.windows]) {
      this.renderWindow(win);
      if (win.isMinimized) {
        const el = document.getElementById(win.id);
        if (el) el.style.display = 'none';
      }
    }
    if (State.state.activeWindowId) this.focusWindow(State.state.activeWindowId);
  }
}

export const WindowManager = new WM();
