export interface EditorDoc {
  id: string;
  path: string | null;
  name: string;
  content: string;
  language: string;
  dirty: boolean;
  encoding: 'utf-8';
  lineEnding: 'lf' | 'crlf';
  readOnly: boolean;
}

export function createDoc(path: string | null, name: string, content: string): EditorDoc {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const lang = detectLang(ext);
  const readOnly = content.length > 1024 * 1024; // >1MB
  return {
    id: path || `untitled:${Date.now()}`,
    path,
    name,
    content,
    language: lang,
    dirty: !path,
    encoding: 'utf-8',
    lineEnding: content.includes('\r\n') ? 'crlf' : 'lf',
    readOnly,
  };
}

export function detectLang(ext: string): string {
  if (['json'].includes(ext)) return 'json';
  if (['js', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (['ts', 'tsx'].includes(ext)) return 'typescript';
  if (['css'].includes(ext)) return 'css';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['py'].includes(ext)) return 'python';
  return 'plaintext';
}

export function countWords(s: string): number {
  if (!s.trim()) return 0;
  return s.trim().split(/\s+/).length;
}
