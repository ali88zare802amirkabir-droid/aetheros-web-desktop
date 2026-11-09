import type { AppDefinition } from './types';
import type { VFSNode } from './types';

export interface OpenWithEntry {
  appId: string;
  mimeTypes?: string[];
  extensions?: string[];
  priority?: number;
}

class OpenWithRegistry {
  private entries: OpenWithEntry[] = [];

  register(entry: OpenWithEntry) {
    this.entries.push(entry);
    this.entries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  resolve(node: VFSNode, name: string): string[] {
    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    const results = this.entries
      .filter((e) => {
        if (e.extensions && ext && e.extensions.map((x) => x.toLowerCase()).includes(ext)) return true;
        if (e.mimeTypes && node.type === 'file') return true;
        return false;
      })
      .map((e) => e.appId);
    // deduplicate while preserving order
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of results) {
      if (!seen.has(r)) {
        seen.add(r);
        out.push(r);
      }
    }
    return out;
  }

  all(): OpenWithEntry[] {
    return this.entries;
  }
}

export const OpenWith = new OpenWithRegistry();
