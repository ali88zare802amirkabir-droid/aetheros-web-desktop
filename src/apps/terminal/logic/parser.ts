import type { TerminalEnv } from './env';
import { expandVars } from './env';

export interface ParsedCommand {
  argv: string[];
  stdinFile?: string;
  stdoutFile?: string;
  append?: boolean;
}

export interface ParsedSegment {
  commands: ParsedCommand[]; // piped
  op?: '&&' | '||' | ';';
}

function splitByOps(line: string): { seg: string; op?: '&&' | '||' | ';' }[] {
  const out: { seg: string; op?: '&&' | '||' | ';' }[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const next = line[i + 1];
    if (quote) {
      if (c === quote) quote = null;
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '#' && !quote) break; // comment
    if (c === '&' && next === '&') { out.push({ seg: cur, op: '&&' }); cur = ''; i++; continue; }
    if (c === '|' && next === '|') { out.push({ seg: cur, op: '||' }); cur = ''; i++; continue; }
    if (c === ';') { out.push({ seg: cur, op: ';' }); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() || out.length === 0) out.push({ seg: cur });
  return out;
}

function splitPipes(s: string): string[] {
  const res: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) quote = null; cur += c; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '|') { res.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur) res.push(cur);
  return res.length ? res : [''];
}

export function tokenize(s: string): string[] {
  const res: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) { quote = null; continue; }
      if (c === '\\' && quote === '"' && i + 1 < s.length) { cur += s[++i]; continue; }
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '\\' && i + 1 < s.length) { cur += s[++i]; continue; }
    if (/\s/.test(c)) { if (cur) { res.push(cur); cur = ''; } continue; }
    cur += c;
  }
  if (cur) res.push(cur);
  return res;
}

function parseCommandPart(raw: string, env: TerminalEnv): ParsedCommand {
  const expanded = expandVars(raw, env);
  let tokens = tokenize(expanded);
  let stdinFile: string | undefined;
  let stdoutFile: string | undefined;
  let append = false;
  const argv: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '>>') { stdoutFile = tokens[++i]; append = true; continue; }
    if (t === '>') { stdoutFile = tokens[++i]; append = false; continue; }
    if (t === '<') { stdinFile = tokens[++i]; continue; }
    argv.push(t);
  }
  return { argv, stdinFile, stdoutFile, append };
}

export function parseLine(line: string, env: TerminalEnv): ParsedSegment[] {
  const segments = splitByOps(line);
  return segments.map((s) => {
    const pipes = splitPipes(s.seg);
    const commands = pipes.map((p) => parseCommandPart(p, env)).filter((c) => c.argv.length > 0 || c.stdoutFile);
    return { commands, op: s.op };
  }).filter((s) => s.commands.length > 0);
}

export function globMatch(pattern: string, name: string): boolean {
  // simple * and ? glob
  const esc = (x: string) => x.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = '^' + pattern.split('*').map((part) => part.split('?').map(esc).join('.')).join('.*') + '$';
  try { return new RegExp(re).test(name); } catch { return pattern === name; }
}
