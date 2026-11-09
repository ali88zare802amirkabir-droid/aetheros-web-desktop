import type { VFSInterface, VFSNode } from './types';
import { State } from './State';
import { EventBus } from './EventBus';

class VirtualFS implements VFSInterface {
  root: VFSNode = { type: 'folder', name: 'Desktop', children: {} };

  load(): void {
    const saved = State.get('vfs', null) as VFSNode | null;
    if (saved && saved.type === 'folder' && saved.children) this.root = saved;
    else this.initDefault();
  }

  private initDefault(): void {
    const now = Date.now();
    this.root = {
      type: 'folder', name: 'Desktop', modified: now, children: {
        Documents: { type: 'folder', name: 'Documents', children: {}, modified: now },
        Downloads: { type: 'folder', name: 'Downloads', children: {}, modified: now },
      },
    };
    this.persist();
  }

  getNode(path: string): VFSNode | null {
    if (!path) return this.root;
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === this.root.name) parts.shift();
    let node: VFSNode = this.root;
    for (const p of parts) {
      if (node.type !== 'folder' || !node.children?.[p]) return null;
      node = node.children[p];
    }
    return node;
  }

  private parent(path: string): VFSNode {
    const p = this.getNode(path);
    if (!p || p.type !== 'folder') throw new Error('Invalid folder');
    if (!p.children) p.children = {};
    return p;
  }

  private touch(node: VFSNode, content?: string): void {
    node.modified = Date.now();
    if (node.type === 'file' && content !== undefined) node.size = content.length;
  }

  createFolder(parentPath: string, name: string): VFSNode {
    const p = this.parent(parentPath);
    if (p.children![name]) throw new Error('Name already exists');
    const node: VFSNode = { type: 'folder', name, children: {}, modified: Date.now() };
    p.children![name] = node; this.touch(p); this.commit(); return node;
  }

  createFile(parentPath: string, name: string, content = ''): VFSNode {
    const p = this.parent(parentPath);
    if (p.children![name]) throw new Error('Name already exists');
    const node: VFSNode = { type: 'file', name, content, modified: Date.now(), size: content.length };
    p.children![name] = node; this.touch(p); this.commit(); return node;
  }

  renameNode(parentPath: string, oldName: string, newName: string): void {
    if (oldName === newName) return;
    const p = this.parent(parentPath);
    if (!p.children![oldName]) throw new Error('Not found');
    if (p.children![newName]) throw new Error('Name already exists');
    const node = p.children![oldName]; delete p.children![oldName];
    node.name = newName; node.modified = Date.now(); p.children![newName] = node;
    this.touch(p); this.commit();
  }

  deleteNode(parentPath: string, name: string): void {
    const p = this.parent(parentPath);
    if (!p.children![name]) throw new Error('Not found');
    delete p.children![name]; this.touch(p); this.commit();
  }

  moveNode(fromParent: string, name: string, toParent: string): void {
    const src = this.parent(fromParent), dst = this.parent(toParent);
    if (!src.children![name]) throw new Error('Not found');
    if (src === dst) return;
    if (dst.children![name]) throw new Error('Name already exists at destination');
    const node = src.children![name];
    // prevent moving folder into itself
    if (node.type === 'folder') {
      const destPath = (toParent ? toParent + '/' : '') + name;
      const srcPath = (fromParent ? fromParent + '/' : '') + name;
      if (destPath === srcPath || destPath.startsWith(srcPath + '/')) throw new Error('Cannot move a folder into itself');
    }
    delete src.children![name]; dst.children![name] = node;
    this.touch(src); this.touch(dst); this.commit();
  }

  copyNode(fromParent: string, name: string, toParent: string): void {
    const src = this.parent(fromParent), dst = this.parent(toParent);
    const node = src.children![name];
    if (!node) throw new Error('Not found');
    let newName = name;
    if (dst.children![newName]) {
      const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
      const base = ext ? name.slice(0, -ext.length) : name;
      let i = 2;
      while (dst.children![`${base} copy${i > 2 ? ' ' + i : ''}${ext}`]) i++;
      newName = `${base} copy${i > 2 ? ' ' + i : ''}${ext}`;
    }
    dst.children![newName] = this.clone(node, newName);
    this.touch(dst); this.commit();
  }

  private clone(node: VFSNode, name = node.name): VFSNode {
    if (node.type === 'file') return { type: 'file', name, content: node.content, modified: Date.now(), size: (node.content || '').length };
    const children: Record<string, VFSNode> = {};
    for (const [k, v] of Object.entries(node.children ?? {})) children[k] = this.clone(v, v.name);
    return { type: 'folder', name, children, modified: Date.now() };
  }

  writeFile(path: string, content: string): void {
    const node = this.getNode(path);
    if (!node || node.type !== 'file') throw new Error('File not found');
    node.content = content; node.size = content.length; node.modified = Date.now();
    this.commit();
  }

  persist(): void { State.set('vfs', this.root); }
  private commit(): void { this.persist(); EventBus.emit('vfsChanged', undefined); }
}

export const VFS = new VirtualFS();

