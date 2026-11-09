export interface FindOpts {
  query: string;
  replace?: string;
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export function findAll(text: string, opts: FindOpts): number[] {
  if (!opts.query) return [];
  let pattern = opts.query;
  if (!opts.regex) {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  if (opts.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  try {
    const re = new RegExp(pattern, opts.caseSensitive ? 'g' : 'gi');
    const matches: number[] = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push(m.index);
    }
    return matches;
  } catch {
    return [];
  }
}

export function replaceAll(text: string, opts: FindOpts): string {
  if (!opts.query || opts.replace === undefined) return text;
  let pattern = opts.query;
  if (!opts.regex) {
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  if (opts.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  try {
    const re = new RegExp(pattern, opts.caseSensitive ? 'g' : 'gi');
    return text.replace(re, opts.replace);
  } catch {
    return text;
  }
}
