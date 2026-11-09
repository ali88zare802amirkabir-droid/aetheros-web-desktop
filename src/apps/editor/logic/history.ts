export interface HistoryState {
  past: string[];
  future: string[];
}

export class UndoRedo {
  past: string[] = [];
  future: string[] = [];
  limit = 200;

  push(current: string, last?: string) {
    if (last === current) return;
    this.past.push(last !== undefined ? last : current);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  undo(current: string): string | null {
    if (!this.canUndo()) return null;
    const prev = this.past.pop()!;
    this.future.push(current);
    return prev;
  }

  redo(current: string): string | null {
    if (!this.canRedo()) return null;
    const next = this.future.pop()!;
    this.past.push(current);
    return next;
  }

  reset() {
    this.past = [];
    this.future = [];
  }
}
