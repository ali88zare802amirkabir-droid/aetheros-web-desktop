export const languages = ['plaintext', 'json', 'javascript', 'typescript', 'css', 'html', 'markdown', 'python'];

export function languageLabel(l: string) {
  const map: Record<string, string> = {
    plaintext: 'Plain Text',
    json: 'JSON',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    css: 'CSS',
    html: 'HTML',
    markdown: 'Markdown',
    python: 'Python',
  };
  return map[l] || l;
}
