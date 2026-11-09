import { VFS } from './VFS';
import { putBlob } from './BlobStore';
import type { VFSNode } from './types';

const FLAG = 'vfs_blob_migrated_v1';

function walk(node: VFSNode, fn: (n: VFSNode) => void) {
  fn(node);
  if (node.children) for (const c of Object.values(node.children)) walk(c, fn);
}

export async function migrateBase64ToBlobs(): Promise<void> {
  if (localStorage.getItem(FLAG) === '1') return;
  try {
    let changed = false;
    const jobs: Promise<void>[] = [];
    walk(VFS.root, (n) => {
      const c = n.content;
      if (typeof c === 'string' && c.startsWith('data:') && c.includes(';base64,') && c.length > 4096) {
        jobs.push((async () => {
          try {
            const res = await fetch(c);
            const blob = await res.blob();
            const id = await putBlob(blob);
            n.content = `idb:${id}`;
            changed = true;
          } catch { /* fallback: keep original */ }
        })());
      }
      if (typeof n.customIcon === 'string' && n.customIcon.startsWith('data:') && n.customIcon.length > 4096) {
        jobs.push((async () => {
          try { const res = await fetch(n.customIcon!); const blob = await res.blob(); n.customIcon = `idb:${await putBlob(blob)}`; changed = true; } catch {}
        })());
      }
    });
    await Promise.all(jobs);
    if (changed) VFS.persist();
  } catch { /* fallback: keep original data */ }
  try { localStorage.setItem(FLAG, '1'); } catch {}
}
