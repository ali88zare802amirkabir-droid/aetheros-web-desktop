const DB = 'myos-blobs';
const STORE = 'blobs';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbp;
}

export async function putBlob(blob: Blob): Promise<string> {
  const db = await open();
  const id = `blob_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  return id;
}

export async function getBlob(id: string): Promise<Blob | null> {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => res((req.result as Blob) ?? null);
      req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

export async function deleteBlob(id: string): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {}
}

const urlCache = new Map<string, string>();
export async function resolveBlobUrl(ref: string): Promise<string | null> {
  if (!ref.startsWith('idb:')) return ref;
  const id = ref.slice(4);
  if (urlCache.has(id)) return urlCache.get(id)!;
  const blob = await getBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function createBlobUrl(ref: string): Promise<string | null> {
  if (!ref.startsWith('idb:')) return ref;
  const blob = await getBlob(ref.slice(4));
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string | null | undefined) { if (url && url.startsWith('blob:')) try { URL.revokeObjectURL(url); } catch {} }

export function revokeBlobUrl(ref: string) {
  if (!ref.startsWith('idb:')) return;
  const id = ref.slice(4);
  const url = urlCache.get(id);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(id); }
}

export function revokeAllBlobUrls() { urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear(); }

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => revokeAllBlobUrls());
