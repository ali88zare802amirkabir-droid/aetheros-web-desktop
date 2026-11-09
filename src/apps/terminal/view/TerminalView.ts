import type { ShellContext } from '../logic/types';
import { createEnv } from '../logic/env';
import { HistoryStore } from '../logic/history';
import { executeLine, commandNames } from '../logic/shell';
import { complete } from '../logic/completion';
import { VFS } from '../../../core/VFS';
import { State } from '../../../core/State';
import { SettingsStore } from '../../settings/store';

export class TerminalView {
  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private output: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private ctx: ShellContext;
  private hist = new HistoryStore();

  constructor() {
    const env = createEnv();
    this.ctx = { cwd: '', env: env.vars, aliases: {}, history: [], vfs: VFS, state: State };
    // load profile
    try {
      const prof = VFS.getNode('.profile');
      if (prof && prof.type === 'file' && prof.content) {
        prof.content.split('\n').forEach((l: string) => { if (l.startsWith('alias ')) { /* simple */ } });
      }
    } catch {}
  }

  mount(container: HTMLElement) {
    this.container = container;
    const root = document.createElement('div');
    root.className = 'tm-app';
    root.innerHTML = `
      <div class="tm-tabs"><div class="tm-tab active">Terminal</div></div>
      <div class="tm-output" tabindex="0"></div>
      <div class="tm-input-row">
        <span class="tm-prompt" data-prompt></span>
        <input class="tm-input" spellcheck="false" />
      </div>
    `;
    container.appendChild(root);
    this.root = root;
    this.output = root.querySelector('.tm-output') as HTMLElement;
    this.input = root.querySelector('.tm-input') as HTMLInputElement;
    this.renderPrompt();
    this.printLine('Welcome to myOS Terminal. Type `help` to start.\n');
    this.input.focus();

    this.input.addEventListener('keydown', (e) => this.onKey(e));
    root.addEventListener('click', () => this.input?.focus());
  }

  private renderPrompt() {
    const p = this.root?.querySelector('[data-prompt]') as HTMLElement;
    if (p) p.textContent = `${this.ctx.env.USER || 'user'}@${this.ctx.env.HOST || 'myos'} ${this.ctx.cwd || '/'} $ `;
  }

  private printLine(text: string, cls?: string) {
    if (!this.output) return;
    const div = document.createElement('div');
    div.className = 'tm-line' + (cls ? ' ' + cls : '');
    // basic ANSI clear
    if (text === '\x1bc') { this.output.innerHTML = ''; return; }
    div.textContent = text;
    this.output.appendChild(div);
    this.output.scrollTop = this.output.scrollHeight;
  }

  private async exec(line: string) {
    if (!line.trim()) { this.printLine(''); return; }
    this.printLine(`${this.ctx.env.USER || 'user'}@${this.ctx.env.HOST || 'myos'} ${this.ctx.cwd || '/'} $ ${line}`);
    this.hist.push(line);
    this.ctx.history = this.hist.list();
    const res = await executeLine(line, this.ctx);
    if (res.stdout) this.printLine(res.stdout.replace(/\n$/, ''));
    if (res.stderr) this.printLine(res.stderr.replace(/\n$/, ''), 'tm-err');
    this.renderPrompt();
  }

  private onKey(e: KeyboardEvent) {
    if (!this.input) return;
    if (e.key === 'Enter') {
      const v = this.input.value;
      this.input.value = '';
      void this.exec(v);
      e.preventDefault();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { options } = complete(this.input.value, this.ctx, commandNames);
      if (options.length === 1) {
        const parts = this.input.value.split(/\s+/);
        parts[parts.length - 1] = options[0];
        this.input.value = parts.join(' ');
      } else if (options.length > 1) {
        this.printLine(options.join('  '));
      }
      return;
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); const v = this.hist.up(this.input.value); if (v !== null) this.input.value = v; return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.input.value = this.hist.down(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); if (this.output) this.output.innerHTML = ''; return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); this.printLine('^C'); this.input.value = ''; return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); this.input.value = ''; return; }
  }

  update(_state: any) {}
  destroy() {
    if (this.root && this.container && this.root.parentNode === this.container) this.container.removeChild(this.root);
    this.root = null;
  }
}
