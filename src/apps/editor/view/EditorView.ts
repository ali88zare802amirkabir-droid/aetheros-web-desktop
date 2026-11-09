import { createDoc, detectLang, countWords } from '../logic/document';
import { UndoRedo } from '../logic/history';
import { findAll, replaceAll } from '../logic/findreplace';
import { saveDraft, loadDraft, removeDraft } from '../logic/session';
import { VFS } from '../../../core/VFS';
import { SettingsStore } from '../../settings/store';

export class EditorView {
  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private gutter: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private findbar: HTMLElement | null = null;
  private docs: any[] = [];
  private active = 0;
  private history = new UndoRedo();
  private findOpen = false;
  private lastSaved = '';
  private autoSaveTimer: any = null;

  mount(container: HTMLElement) {
    this.container = container;
    const root = document.createElement('div');
    root.className = 'ed-app';
    root.innerHTML = `
      <div class="ed-tabs"></div>
      <div class="ed-toolbar">
        <button data-act="save">Save</button>
        <button data-act="saveas">Save As</button>
        <button data-act="find">Find</button>
        <button data-act="replace">Replace</button>
        <button data-act="goto">Go to Line</button>
        <button data-act="wrap">Wrap</button>
        <button data-act="rtl">RTL/LTR</button>
      </div>
      <div class="ed-findbar" style="display:none">
        <input data-find="q" placeholder="Find" />
        <input data-find="r" placeholder="Replace" />
        <label><input type="checkbox" data-find="case" /> Case</label>
        <label><input type="checkbox" data-find="word" /> Whole word</label>
        <label><input type="checkbox" data-find="regex" /> Regex</label>
        <button data-find="find">Find</button>
        <button data-find="rep">Replace</button>
        <button data-find="repall">Replace All</button>
        <span data-find="count"></span>
        <button data-find="close">×</button>
      </div>
      <div class="ed-main">
        <div class="ed-gutter"></div>
        <div class="ed-editor-wrap">
          <textarea class="ed-textarea" spellcheck="false"></textarea>
        </div>
      </div>
      <div class="ed-statusbar">
        <div class="ed-status-group">
          <span data-st="pos">Ln 1, Col 1</span>
          <span data-st="words">0 words</span>
          <span data-st="enc">UTF-8</span>
        </div>
        <div class="ed-status-group">
          <span data-st="lang">Plain Text</span>
          <span data-st="eol">LF</span>
        </div>
      </div>
    `;
    container.appendChild(root);
    this.root = root;
    this.textarea = root.querySelector('.ed-textarea') as HTMLTextAreaElement;
    this.gutter = root.querySelector('.ed-gutter') as HTMLElement;
    this.status = root.querySelector('.ed-statusbar') as HTMLElement;
    this.findbar = root.querySelector('.ed-findbar') as HTMLElement;

    root.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => this.doAction((b as HTMLElement).dataset.act!));
    });
    root.querySelectorAll('[data-find]').forEach((b) => {
      b.addEventListener('click', () => this.doFind((b as HTMLElement).dataset.find!));
    });

    this.textarea.addEventListener('input', () => {
      this.onInput();
    });
    this.textarea.addEventListener('keydown', (e) => {
      this.onKey(e);
    });
    this.textarea.addEventListener('scroll', () => this.syncScroll());
    this.textarea.addEventListener('click', () => this.updateStatus());
    this.textarea.addEventListener('keyup', () => this.updateStatus());

    // auto-save draft
    this.autoSaveTimer = setInterval(() => this.saveDraft(), 5000);
  }

  openFile(path: string) {
    try {
      const node = VFS.getNode(path);
      if (!node || node.type !== 'file') return;
      // check if already open
      const idx = this.docs.findIndex((d) => d.path === path);
      if (idx >= 0) {
        this.active = idx;
        this.loadActive();
        return;
      }
      const doc = createDoc(path, node.name, node.content || '');
      this.docs.push(doc);
      this.active = this.docs.length - 1;
      this.history.reset();
      this.loadActive();
      this.renderTabs();
    } catch (e) {}
  }

  openNew() {
    const doc = createDoc(null, 'Untitled.txt', '');
    this.docs.push(doc);
    this.active = this.docs.length - 1;
    this.history.reset();
    this.loadActive();
    this.renderTabs();
  }

  private loadActive() {
    const doc = this.docs[this.active];
    if (!this.textarea) return;
    this.textarea.value = doc.content;
    this.lastSaved = doc.content;
    this.updateGutter();
    this.updateStatus();
    this.renderTabs();
    // try to load draft
    loadDraft(doc.id).then((d) => {
      if (d && d.content && d.content !== this.textarea?.value) {
        // could prompt, but just restore for resilience
        // keep simple
      }
    });
  }

  private onInput() {
    if (!this.textarea) return;
    const doc = this.docs[this.active];
    const prev = doc.content;
    doc.content = this.textarea.value;
    doc.dirty = doc.content !== this.lastSaved;
    if (doc.content.length > 1024 * 1024) doc.readOnly = true;
    this.history.push(doc.content, prev);
    this.updateGutter();
    this.updateStatus();
    this.renderTabs();
  }

  private onKey(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.save();
      return;
    }
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      this.toggleFind();
      return;
    }
    if (mod && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      this.toggleFind();
      return;
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && e.key === '=') {
      e.preventDefault();
      // increase font size via css var not implemented fully, just skip
      return;
    }
    if (mod && e.key === '-') {
      e.preventDefault();
      return;
    }
    if (mod && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      const line = prompt('Go to line:');
      if (line) this.goToLine(parseInt(line));
      return;
    }
  }

  private undo() {
    const doc = this.docs[this.active];
    const res = this.history.undo(doc.content);
    if (res !== null && this.textarea) {
      this.textarea.value = res;
      doc.content = res;
      doc.dirty = doc.content !== this.lastSaved;
      this.updateGutter();
      this.updateStatus();
      this.renderTabs();
    }
  }

  private redo() {
    const doc = this.docs[this.active];
    const res = this.history.redo(doc.content);
    if (res !== null && this.textarea) {
      this.textarea.value = res;
      doc.content = res;
      doc.dirty = doc.content !== this.lastSaved;
      this.updateGutter();
      this.updateStatus();
      this.renderTabs();
    }
  }

  private save() {
    const doc = this.docs[this.active];
    if (doc.readOnly) {
      alert('File too large for editing');
      return;
    }
    if (!doc.path) {
      this.saveAs();
      return;
    }
    try {
      VFS.writeFile(doc.path, doc.content);
      doc.dirty = false;
      this.lastSaved = doc.content;
      removeDraft(doc.id);
      this.renderTabs();
    } catch (e) {
      alert('Save failed');
    }
  }

  private saveAs() {
    const name = prompt('Save as (filename):', this.docs[this.active].name);
    if (!name) return;
    try {
      const p = name.startsWith('/') ? name.slice(1) : name;
      VFS.createFile('', p, this.docs[this.active].content);
      const doc = this.docs[this.active];
      doc.path = p;
      doc.name = p.split('/').pop() || p;
      doc.id = p;
      doc.dirty = false;
      this.lastSaved = doc.content;
      removeDraft(doc.id);
      this.renderTabs();
    } catch (e) {
      alert('Save As failed');
    }
  }

  private doAction(act: string) {
    if (act === 'save') this.save();
    else if (act === 'saveas') this.saveAs();
    else if (act === 'find') this.toggleFind();
    else if (act === 'replace') this.toggleFind(true);
    else if (act === 'goto') {
      const line = prompt('Go to line:');
      if (line) this.goToLine(parseInt(line));
    } else if (act === 'wrap') {
      this.textarea?.classList.toggle('wrap');
    } else if (act === 'rtl') {
      if (this.textarea) {
        this.textarea.dir = this.textarea.dir === 'rtl' ? 'ltr' : 'rtl';
      }
    }
  }

  private toggleFind(showReplace = false) {
    this.findOpen = !this.findOpen;
    if (this.findbar) {
      this.findbar.style.display = this.findOpen ? 'flex' : 'none';
      const r = this.findbar.querySelector('[data-find="r"]') as HTMLElement;
      if (r) r.style.display = showReplace ? 'inline-block' : 'none';
    }
  }

  private doFind(act: string) {
    const q = (this.findbar?.querySelector('[data-find="q"]') as HTMLInputElement)?.value || '';
    const rep = (this.findbar?.querySelector('[data-find="r"]') as HTMLInputElement)?.value || '';
    const cs = (this.findbar?.querySelector('[data-find="case"]') as HTMLInputElement)?.checked;
    const ww = (this.findbar?.querySelector('[data-find="word"]') as HTMLInputElement)?.checked;
    const re = (this.findbar?.querySelector('[data-find="regex"]') as HTMLInputElement)?.checked;
    const text = this.textarea?.value || '';
    if (act === 'find' || act === 'close') {
      const matches = findAll(text, { query: q, regex: re, caseSensitive: cs, wholeWord: ww });
      const cnt = this.findbar?.querySelector('[data-find="count"]') as HTMLElement;
      if (cnt) cnt.textContent = matches.length + ' matches';
      if (act === 'close') this.toggleFind();
      return;
    }
    if (act === 'rep') {
      // replace first - simple
      const replaced = replaceAll(text, { query: q, replace: rep, regex: re, caseSensitive: cs, wholeWord: ww });
      if (this.textarea) {
        this.textarea.value = replaced;
        this.onInput();
      }
      return;
    }
    if (act === 'repall') {
      const replaced = replaceAll(text, { query: q, replace: rep, regex: re, caseSensitive: cs, wholeWord: ww });
      if (this.textarea) {
        this.textarea.value = replaced;
        this.onInput();
      }
      return;
    }
  }

  private goToLine(line: number) {
    if (!this.textarea) return;
    const lines = this.textarea.value.split('\n');
    if (line < 1) line = 1;
    if (line > lines.length) line = lines.length;
    let pos = 0;
    for (let i = 0; i < line - 1; i++) pos += lines[i].length + 1;
    this.textarea.focus();
    this.textarea.setSelectionRange(pos, pos);
    this.updateStatus();
  }

  private updateGutter() {
    if (!this.gutter || !this.textarea) return;
    const lines = this.textarea.value.split('\n').length || 1;
    let html = '';
    for (let i = 1; i <= lines; i++) html += i + '<br/>';
    this.gutter.innerHTML = html;
  }

  private syncScroll() {
    if (this.gutter && this.textarea) {
      this.gutter.scrollTop = this.textarea.scrollTop;
    }
  }

  private updateStatus() {
    if (!this.textarea || !this.status) return;
    const doc = this.docs[this.active];
    const text = this.textarea.value;
    const posEl = this.status.querySelector('[data-st="pos"]');
    const wordsEl = this.status.querySelector('[data-st="words"]');
    const encEl = this.status.querySelector('[data-st="enc"]');
    const langEl = this.status.querySelector('[data-st="lang"]');
    const eolEl = this.status.querySelector('[data-st="eol"]');
    if (posEl) {
      const before = text.slice(0, this.textarea.selectionStart);
      const line = before.split('\n').length;
      const col = before.split('\n').pop()!.length + 1;
      posEl.textContent = `Ln ${line}, Col ${col}`;
    }
    if (wordsEl) wordsEl.textContent = countWords(text) + ' words';
    if (encEl) encEl.textContent = doc?.encoding || 'UTF-8';
    if (langEl) langEl.textContent = doc?.language || 'Plain Text';
    if (eolEl) eolEl.textContent = (doc?.lineEnding || 'lf').toUpperCase();
  }

  private renderTabs() {
    if (!this.root) return;
    const tabs = this.root.querySelector('.ed-tabs') as HTMLElement;
    if (!tabs) return;
    tabs.innerHTML = this.docs.map((d, i) => `<div class="ed-tab ${i === this.active ? 'active' : ''} ${d.dirty ? 'ed-tab-dirty' : ''}" data-tab="${i}"><span>${d.name}</span><button class="ed-tab-close" data-close="${i}">×</button></div>`).join('');
    tabs.querySelectorAll('[data-tab]').forEach((t) => {
      t.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.dataset.close !== undefined) return;
        this.active = parseInt((t as HTMLElement).dataset.tab || '0');
        this.loadActive();
      });
    });
    tabs.querySelectorAll('[data-close]').forEach((c) => {
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt((c as HTMLElement).dataset.close || '0');
        const doc = this.docs[idx];
        if (doc.dirty) {
          if (!confirm('Save changes?')) return;
        }
        this.docs.splice(idx, 1);
        if (this.active >= this.docs.length) this.active = Math.max(0, this.docs.length - 1);
        if (this.docs.length === 0) {
          this.openNew();
        } else {
          this.loadActive();
        }
      });
    });
  }

  private saveDraft() {
    const doc = this.docs[this.active];
    if (!doc) return;
    if (doc.dirty) {
      saveDraft(doc.id, { content: doc.content, path: doc.path, name: doc.name });
    }
  }

  update(state: any) {}
  destroy() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    if (this.root && this.container && this.root.parentNode === this.container) {
      this.container.removeChild(this.root);
    }
    this.root = null;
  }
}
