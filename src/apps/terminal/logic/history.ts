export class HistoryStore {
  items: string[] = [];
  index = -1;
  private max = 500;

  push(cmd: string) {
    const t = cmd.trim();
    if (!t) return;
    if (this.items[this.items.length - 1] === t) return;
    this.items.push(t);
    if (this.items.length > this.max) this.items.shift();
    this.index = this.items.length;
  }

  up(current: string): string | null {
    if (!this.items.length) return null;
    if (this.index >= this.items.length) this.index = this.items.length - 1;
    else if (this.index > 0) this.index--;
    return this.items[this.index] ?? current;
  }

  down(): string {
    if (this.index < this.items.length - 1) {
      this.index++;
      return this.items[this.index] ?? '';
    }
    this.index = this.items.length;
    return '';
  }

  search(prefix: string): string | null {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].includes(prefix)) return this.items[i];
    }
    return null;
  }

  list(): string[] {
    return [...this.items];
  }
}
