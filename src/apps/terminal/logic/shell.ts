import type { CmdResult, ShellContext, TerminalCommand } from './types';
import { parseLine } from './parser';
import { resolvePath, parentPath, baseName } from './completion';
import { State } from '../../../core/State';
import { WindowManager } from '../../../core/WindowManager';
import { OpenWith } from '../../../core/OpenWith';
import { SettingsStore } from '../../settings/store';
import { EventBus } from '../../../core/EventBus';
import type { TerminalEnv } from './env';

function ok(stdout = ''): CmdResult { return { stdout, stderr: '', code: 0 }; }
function err(stderr: string, code = 1): CmdResult { return { stdout: '', stderr, code }; }

function fmtSize(n: number): string {
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'K';
  return (n / (1024 * 1024)).toFixed(1) + 'M';
}

function nodeSize(node: any): number {
  if (!node) return 0;
  if (node.type === 'file') return (node.content || '').length;
  let s = 0;
  for (const c of Object.values(node.children || {})) s += nodeSize(c);
  return s;
}

function listDir(ctx: ShellContext, path: string, opts: { a?: boolean; l?: boolean; h?: boolean; R?: boolean }, prefix = ''): string {
  const node = ctx.vfs.getNode(path);
  if (!node) return `ls: ${path}: No such file or directory\n`;
  if (node.type === 'file') return prefix + baseName(path) + '\n';
  const entries = Object.entries(node.children || {});
  let out = '';
  if (opts.R && path) out += (prefix ? prefix : path || '/') + ':\n';
  for (const [name, child] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!opts.a && name.startsWith('.')) continue;
    const c: any = child;
    if (opts.l) {
      const t = c.type === 'folder' ? 'd' : '-';
      const sz = opts.h ? fmtSize(nodeSize(c)).padStart(6) : String(nodeSize(c)).padStart(8);
      const dt = c.modified ? new Date(c.modified).toISOString().slice(0, 16).replace('T', ' ') : '---- -- --';
      out += `${t}rw-r--r--  ${sz}  ${dt}  ${name}${c.type === 'folder' ? '/' : ''}\n`;
    } else {
      out += name + (c.type === 'folder' ? '/' : '') + '\n';
    }
  }
  if (opts.R) {
    for (const [name, child] of entries) {
      const c: any = child;
      if (!opts.a && name.startsWith('.')) continue;
      if (c.type === 'folder') {
        const sub = resolvePath(path, name);
        out += '\n' + listDir(ctx, sub, opts, sub);
      }
    }
  }
  return out;
}

function moveToTrash(ctx: ShellContext, parent: string, name: string): boolean {
  try {
    const node = ctx.vfs.getNode(resolvePath(parent, name));
    if (!node) return false;
    // clone node for trash
    const clone = JSON.parse(JSON.stringify(node));
    const entry = { id: `trash_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, from: parent, deletedAt: Date.now(), node: clone };
    const trash = (State.state.trash || []) as any[];
    trash.push(entry);
    State.update({ trash });
    ctx.vfs.deleteNode(parent, name);
    return true;
  } catch { return false; }
}

async function runCommand(name: string, args: string[], ctx: ShellContext, stdin: string): Promise<CmdResult> {
  // alias expansion
  if (ctx.aliases[name]) {
    const expanded = (ctx.aliases[name] + ' ' + args.join(' ')).trim().split(/\s+/);
    name = expanded[0]; args = expanded.slice(1);
  }

  switch (name) {
    case 'pwd': return ok((ctx.cwd || '/') + '\n');
    case 'whoami': return ok((ctx.env.USER || 'user') + '\n');
    case 'date': return ok(new Date().toString() + '\n');
    case 'echo': return ok(args.join(' ') + '\n');
    case 'clear': return { stdout: '\x1bc', stderr: '', code: 0 };
    case 'help': case 'man': return ok('Commands: ls cd pwd cat echo mkdir touch rm cp mv head tail wc grep find sort uniq tree stat du clear history alias unalias export env date whoami which open edit theme settings neofetch\n');
    case 'which': return ok(args[0] ? `/bin/${args[0]}\n` : '');
    case 'env': return ok(Object.entries(ctx.env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    case 'export': {
      for (const a of args) {
        const i = a.indexOf('=');
        if (i > 0) ctx.env[a.slice(0, i)] = a.slice(i + 1);
      }
      return ok();
    }
    case 'alias': {
      if (!args.length) return ok(Object.entries(ctx.aliases).map(([k, v]) => `alias ${k}='${v}'`).join('\n') + '\n');
      for (const a of args) {
        const i = a.indexOf('=');
        if (i > 0) ctx.aliases[a.slice(0, i)] = a.slice(i + 1).replace(/^['"]|['"]$/g, '');
      }
      return ok();
    }
    case 'unalias': { args.forEach(a => delete ctx.aliases[a]); return ok(); }
    case 'history': return ok(ctx.history.map((h, i) => `${i + 1}  ${h}`).join('\n') + '\n');
    case 'cd': {
      const target = args[0] || ctx.env.HOME || '';
      const np = resolvePath(ctx.cwd, target);
      const node = ctx.vfs.getNode(np);
      if (!node || node.type !== 'folder') return err(`cd: ${args[0] || ''}: No such directory\n`);
      ctx.cwd = np; ctx.env.PWD = np || '/';
      return ok();
    }
    case 'ls': {
      const opts = { a: args.includes('-a') || args.includes('-la') || args.includes('-al'), l: args.includes('-l') || args.includes('-la') || args.includes('-al'), h: args.includes('-h'), R: args.includes('-R') };
      const paths = args.filter(a => !a.startsWith('-'));
      if (!paths.length) return ok(listDir(ctx, ctx.cwd, opts));
      let out = '';
      for (const p of paths) out += listDir(ctx, resolvePath(ctx.cwd, p), opts);
      return ok(out);
    }
    case 'mkdir': {
      const pflag = args.includes('-p');
      const dirs = args.filter(a => !a.startsWith('-'));
      for (const d of dirs) {
        try {
          if (pflag) {
            const parts = d.split('/').filter(Boolean);
            let cur = d.startsWith('/') ? '' : ctx.cwd;
            for (const part of parts) {
              const np = resolvePath(cur, part);
              const ex = ctx.vfs.getNode(np);
              if (!ex) ctx.vfs.createFolder(cur, part);
              cur = np;
            }
          } else {
            const full = resolvePath(ctx.cwd, d);
            ctx.vfs.createFolder(parentPath(full), baseName(full));
          }
        } catch (e: any) { return err(`mkdir: ${e.message}\n`); }
      }
      return ok();
    }
    case 'touch': {
      for (const f of args.filter(a => !a.startsWith('-'))) {
        try {
          const full = resolvePath(ctx.cwd, f);
          const ex = ctx.vfs.getNode(full);
          if (ex && ex.type === 'file') { ex.modified = Date.now(); ctx.vfs.persist?.(); EventBus.emit('vfsChanged', undefined); }
          else if (!ex) ctx.vfs.createFile(parentPath(full), baseName(full), '');
        } catch (e: any) { return err(`touch: ${e.message}\n`); }
      }
      return ok();
    }
    case 'cat': {
      let out = '';
      const files = args.filter(a => !a.startsWith('-'));
      if (!files.length && stdin) return ok(stdin);
      for (const f of files) {
        const node = ctx.vfs.getNode(resolvePath(ctx.cwd, f));
        if (!node) return err(`cat: ${f}: No such file\n`);
        if (node.type === 'folder') return err(`cat: ${f}: Is a directory\n`);
        out += node.content || '';
      }
      return ok(out);
    }
    case 'rm': {
      const r = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
      const f = args.includes('-f') || args.includes('-rf') || args.includes('-fr');
      const targets = args.filter(a => !a.startsWith('-'));
      for (const t of targets) {
        const full = resolvePath(ctx.cwd, t);
        const node = ctx.vfs.getNode(full);
        if (!node) { if (!f) return err(`rm: ${t}: No such file\n`); continue; }
        if (node.type === 'folder' && !r) return err(`rm: ${t}: is a directory\n`);
        if (f) {
          try { ctx.vfs.deleteNode(parentPath(full), baseName(full)); } catch {}
        } else {
          moveToTrash(ctx, parentPath(full), baseName(full));
        }
      }
      return ok();
    }
    case 'cp': {
      const r = args.includes('-r') || args.includes('-R');
      const a = args.filter(x => !x.startsWith('-'));
      if (a.length < 2) return err('cp: missing operand\n');
      const dest = resolvePath(ctx.cwd, a[a.length - 1]);
      for (const src of a.slice(0, -1)) {
        const sp = resolvePath(ctx.cwd, src);
        const sn = ctx.vfs.getNode(sp);
        if (!sn) return err(`cp: ${src}: No such file\n`);
        if (sn.type === 'folder' && !r) return err(`cp: ${src}: is a directory\n`);
        try { ctx.vfs.copyNode(parentPath(sp), baseName(sp), dest || ''); } catch (e: any) { try { ctx.vfs.copyNode(parentPath(sp), baseName(sp), parentPath(dest)); } catch {} }
      }
      return ok();
    }
    case 'mv': {
      const a = args.filter(x => !x.startsWith('-'));
      if (a.length < 2) return err('mv: missing operand\n');
      const dest = resolvePath(ctx.cwd, a[a.length - 1]);
      for (const src of a.slice(0, -1)) {
        const sp = resolvePath(ctx.cwd, src);
        try {
          const destNode = ctx.vfs.getNode(dest);
          if (destNode && destNode.type === 'folder') ctx.vfs.moveNode(parentPath(sp), baseName(sp), dest);
          else ctx.vfs.moveNode(parentPath(sp), baseName(sp), parentPath(dest));
        } catch (e: any) { return err(`mv: ${e.message}\n`); }
      }
      return ok();
    }
    case 'head': case 'tail': {
      const nArg = args.findIndex(a => a === '-n');
      const n = nArg >= 0 ? parseInt(args[nArg + 1]) || 10 : 10;
      const file = args.find(a => !a.startsWith('-') && (nArg < 0 || args.indexOf(a) !== nArg + 1));
      let text = stdin;
      if (file) { const node = ctx.vfs.getNode(resolvePath(ctx.cwd, file)); if (!node || node.type !== 'file') return err(`${name}: ${file}: No such file\n`); text = node.content || ''; }
      const lines = (text || '').split('\n');
      return ok((name === 'head' ? lines.slice(0, n) : lines.slice(-n)).join('\n') + '\n');
    }
    case 'wc': {
      let text = stdin || '';
      const file = args.find(a => !a.startsWith('-'));
      if (file) { const node = ctx.vfs.getNode(resolvePath(ctx.cwd, file)); if (!node || node.type !== 'file') return err(`wc: ${file}: No such file\n`); text = node.content || ''; }
      const l = text.split('\n').length; const w = text.trim() ? text.trim().split(/\s+/).length : 0; const c = text.length;
      return ok(`${l} ${w} ${c} ${file || ''}\n`.trim() + '\n');
    }
    case 'grep': {
      const iFlag = args.includes('-i'); const nFlag = args.includes('-n'); const vFlag = args.includes('-v'); const rFlag = args.includes('-r');
      const pat = args.find(a => !a.startsWith('-'));
      if (!pat) return err('grep: missing pattern\n');
      const files = args.filter(a => !a.startsWith('-') && a !== pat);
      const re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), iFlag ? 'i' : '');
      const searchIn = (text: string, label: string) => {
        let out = '';
        text.split('\n').forEach((line, idx) => {
          const m = re.test(line);
          if ((m && !vFlag) || (!m && vFlag)) out += `${nFlag ? (idx + 1) + ':' : ''}${label ? label + ':' : ''}${line}\n`;
        });
        return out;
      };
      if (!files.length && stdin) return ok(searchIn(stdin, ''));
      let out = '';
      const walk = (p: string) => {
        const node = ctx.vfs.getNode(p);
        if (!node) return;
        if (node.type === 'file') { out += searchIn(node.content || '', p); return; }
        if (rFlag) Object.keys(node.children || {}).forEach(n => walk(resolvePath(p, n)));
      };
      for (const f of files) { if (rFlag) walk(resolvePath(ctx.cwd, f)); else { const node = ctx.vfs.getNode(resolvePath(ctx.cwd, f)); if (node?.type === 'file') out += searchIn(node.content || '', f); } }
      return ok(out);
    }
    case 'find': {
      const nameIdx = args.indexOf('-name');
      const pattern = nameIdx >= 0 ? args[nameIdx + 1] : '*';
      const start = resolvePath(ctx.cwd, args[0] && !args[0].startsWith('-') ? args[0] : '.');
      const re = new RegExp('^' + (pattern || '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      let out = '';
      const walk = (p: string) => {
        const node = ctx.vfs.getNode(p);
        if (!node) return;
        const nm = baseName(p) || '/';
        if (re.test(nm)) out += (p || '/') + '\n';
        if (node.type === 'folder') Object.keys(node.children || {}).forEach(c => walk(resolvePath(p, c)));
      };
      walk(start);
      return ok(out);
    }
    case 'sort': { const text = stdin || ''; return ok(text.split('\n').filter((_,i,a)=>!(i===a.length-1 && a[i]==='')).sort().join('\n') + '\n'); }
    case 'uniq': { const text = stdin || ''; const lines = text.split('\n'); const out: string[] = []; lines.forEach(l=>{ if(out[out.length-1]!==l) out.push(l); }); return ok(out.join('\n') + (out.length&&out[out.length-1]===''?'':'\n')); }
    case 'tree': {
      const start = resolvePath(ctx.cwd, args[0] || '.');
      let out = (start || '/') + '\n';
      const walk = (p: string, indent: string) => {
        const node = ctx.vfs.getNode(p); if (!node || node.type !== 'folder') return;
        const entries = Object.entries(node.children || {});
        entries.forEach(([n, c]: any, i) => {
          const last = i === entries.length - 1;
          out += indent + (last ? '└── ' : '├── ') + n + (c.type === 'folder' ? '/' : '') + '\n';
          if (c.type === 'folder') walk(resolvePath(p, n), indent + (last ? '    ' : '│   '));
        });
      };
      walk(start, '');
      return ok(out);
    }
    case 'stat': {
      const p = resolvePath(ctx.cwd, args[0] || '.');
      const node = ctx.vfs.getNode(p);
      if (!node) return err(`stat: ${args[0]}: No such file\n`);
      return ok(`  File: ${p || '/'}\n  Type: ${node.type}\n  Size: ${nodeSize(node)}\n  Modified: ${node.modified ? new Date(node.modified).toISOString() : '-'}\n`);
    }
    case 'du': { const p = resolvePath(ctx.cwd, args[0] || '.'); const node = ctx.vfs.getNode(p); if(!node) return err('du: not found\n'); return ok(`${nodeSize(node)}\t${p || '/'}\n`); }
    case 'open': {
      const f = args[0]; if (!f) return err('open: missing file\n');
      const p = resolvePath(ctx.cwd, f); const node = ctx.vfs.getNode(p);
      if (!node) return err(`open: ${f}: not found\n`);
      const apps = OpenWith.resolve(node, baseName(p));
      if (apps.length) { WindowManager.openApp({ id: apps[0], newInstance: false, args: { path: p } }); return ok(); }
      WindowManager.openApp({ id: 'finder', newInstance: true }); return ok();
    }
    case 'edit': {
      const f = args[0]; if (!f) return err('edit: missing file\n');
      const p = resolvePath(ctx.cwd, f);
      WindowManager.openApp({ id: 'editor', newInstance: false, args: { path: p } }); return ok();
    }
    case 'theme': {
      const t = args[0];
      if (t === 'dark' || t === 'light' || t === 'auto') { SettingsStore.set('appearance.theme', t); return ok(); }
      if (t === 'blackos') { document.documentElement.setAttribute('data-theme-pack', 'blackos'); return ok(); }
      return ok('Usage: theme [dark|light|auto|blackos]\n');
    }
    case 'settings': {
      if (args[0] === 'get') return ok(String(SettingsStore.get(args[1])) + '\n');
      if (args[0] === 'set') { SettingsStore.set(args[1], args.slice(2).join(' ')); return ok(); }
      return ok('Usage: settings get <key> | settings set <key> <value>\n');
    }
    case 'neofetch': {
      const os = 'myOS (blackOS)'; const host = ctx.env.HOST || 'myos'; const user = ctx.env.USER || 'user';
      return ok(`
  ╭──────╮   ${user}@${host}
  │ ◆ ◆  │   OS: ${os}
  │  ◆   │   Shell: vsh
  │ ◆ ◆  │   Theme: ${SettingsStore.get('appearance.theme')}
  ╰──────╯   Accent: ${SettingsStore.get('appearance.accent')}
             CWD: ${ctx.cwd || '/'}
`);
    }
    default:
      return err(`${name}: command not found\n`);
  }
}

export async function executeLine(line: string, ctx: ShellContext): Promise<CmdResult> {
  const env: TerminalEnv = { vars: ctx.env, aliases: ctx.aliases, cwd: ctx.cwd };
  const segments = parseLine(line, env);
  ctx.cwd = env.cwd;
  ctx.env = env.vars;
  ctx.aliases = env.aliases;
  let final: CmdResult = ok();
  let lastCode = 0;
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    if (si > 0) {
      const prevOp = segments[si - 1].op;
      if (prevOp === '&&' && lastCode !== 0) continue;
      if (prevOp === '||' && lastCode === 0) continue;
    }
    let stdin = '';
    for (let i = 0; i < seg.commands.length; i++) {
      const cmd = seg.commands[i];
      if (cmd.stdinFile) {
        const node = ctx.vfs.getNode(resolvePath(ctx.cwd, cmd.stdinFile));
        stdin = node?.type === 'file' ? (node.content || '') : '';
      }
      const name = cmd.argv[0];
      const args = cmd.argv.slice(1);
      if (!name) { final = ok(); continue; }
      final = await runCommand(name, args, ctx, stdin);
      stdin = final.stdout;
      if (cmd.stdoutFile) {
        const full = resolvePath(ctx.cwd, cmd.stdoutFile);
        try {
          const ex = ctx.vfs.getNode(full);
          if (ex && ex.type === 'file') ctx.vfs.writeFile(full, cmd.append ? (ex.content || '') + final.stdout : final.stdout);
          else ctx.vfs.createFile(parentPath(full), baseName(full), final.stdout);
        } catch {}
        final = { ...final, stdout: '' };
      }
      lastCode = final.code;
    }
  }
  return final;
}

export const commandNames = ['ls','cd','pwd','cat','echo','mkdir','touch','rm','cp','mv','head','tail','wc','grep','find','sort','uniq','tree','stat','du','clear','history','alias','unalias','export','env','date','whoami','which','man','help','open','edit','theme','settings','neofetch'];
