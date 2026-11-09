import type { VFSNode } from '../../core/types';
import { allPaths, nodeSize, parseTokens, type TokenQuery } from './utils';

type NodeLite = { path: string; name: string; type: 'file'|'folder'; size: number; modified: number; tags: string[]; content?: string };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (paths: string[]) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const { id, matches } = e.data as { id: number; matches: string[] };
      pending.get(id)?.(matches);
      pending.delete(id);
    };
  }
  return worker;
}

export function buildIndex(root: VFSNode): NodeLite[] {
  return allPaths(root).map(({ path, name, node }) => ({
    path, name, type: node.type, size: nodeSize(node), modified: node.modified ?? 0, tags: node.tags ?? [], content: node.type === 'file' ? (node.content || '').slice(0, 4000) : undefined,
  }));
}

export function searchTokens(root: VFSNode, query: string, scopeBase: string): Promise<{ q: TokenQuery; paths: string[] }> {
  const q = parseTokens(query);
  const nodes = buildIndex(root);
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, (paths) => resolve({ q, paths }));
    getWorker().postMessage({ id, nodes, q, scopeBase });
  });
}

export function disposeSearch() { worker?.terminate(); worker = null; pending.clear(); }
