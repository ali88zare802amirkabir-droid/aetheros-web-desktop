import { esc } from './utils';

type Lang = 'json' | 'js' | 'ts' | 'css' | 'html' | 'md' | 'plain';
const extLang = (name: string): Lang => {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (e === 'json') return 'json';
  if (['js','jsx'].includes(e)) return 'js';
  if (['ts','tsx'].includes(e)) return 'ts';
  if (e === 'css') return 'css';
  if (['html','htm','xml','svg'].includes(e)) return 'html';
  if (e === 'md') return 'md';
  return 'plain';
};

function span(cls: string, s: string) { return `<span class="hl-${cls}">${esc(s)}</span>`; }

export function highlightCode(code: string, name: string): string {
  const lang = extLang(name);
  if (lang === 'plain') return esc(code);
  if (lang === 'json') return hlJson(code);
  if (lang === 'html') return hlHtml(code);
  if (lang === 'css') return hlCss(code);
  if (lang === 'md') return hlMd(code);
  return hlJs(code);
}

function hlJson(code: string): string {
  return esc(code).replace(/("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g,
    (m, str, colon, kw) => str ? (colon ? span('key', str.replace(/:$/,'')) + esc(colon) : span('str', str)) : kw ? span('kw', m) : span('num', m));
}
function hlJs(code: string): string {
  const kws = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|null|undefined|true|false|void|interface|type|implements|public|private|protected|readonly)\b/g;
  let s = esc(code);
  s = s.replace(/(\/\/.*$)/gm, m => span('cmt', m));
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, m => span('cmt', m));
  s = s.replace(/(&quot;(?:\\.|[^&])*?&quot;|&#39;(?:\\.|[^&])*?&#39;|`(?:\\.|[^`])*?`)/g, m => span('str', m));
  s = s.replace(kws, m => span('kw', m));
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, m => span('num', m));
  return s;
}
function hlCss(code: string): string {
  let s = esc(code);
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, m => span('cmt', m));
  s = s.replace(/([^{};]+)(?=\s*\{)/g, m => span('key', m));
  s = s.replace(/([a-z-]+)(?=\s*:)/gi, m => span('kw', m));
  s = s.replace(/(&quot;[^&]*&quot;|'[^']*')/g, m => span('str', m));
  return s;
}
function hlHtml(code: string): string {
  return esc(code).replace(/(&lt;\/?)([\w-]+)([^&]*?)(&gt;)/g, (_, a, tag, attrs, b) => {
    const ha = attrs.replace(/([\w-]+)(=)/g, (_m: string, n: string, eq: string) => span('key', n) + eq)
      .replace(/(&quot;[^&]*&quot;)/g, (m: string) => span('str', m));
    return span('cmt', a) + span('kw', tag) + ha + span('cmt', b);
  });
}
function hlMd(code: string): string {
  let s = esc(code);
  s = s.replace(/^(#{1,6} .+)$/gm, m => span('kw', m));
  s = s.replace(/(\*\*[^*]+\*\*|__[^_]+__)/g, m => `<strong>${m}</strong>`);
  s = s.replace(/(`[^`]+`)/g, m => span('str', m));
  s = s.replace(/(\[[^\]]+\]\([^)]+\))/g, m => span('key', m));
  return s;
}

export function injectHighlightCss() {
  if (document.getElementById('hl-css')) return;
  const st = document.createElement('style'); st.id = 'hl-css';
  st.textContent = `.hl-kw{color:#c678dd}.hl-str{color:#98c379}.hl-num{color:#d19a66}.hl-key{color:#61afef}.hl-cmt{color:#7f848e;font-style:italic}
  .dark .hl-kw{color:#c678dd}.dark .hl-str{color:#98c379}.dark .hl-num{color:#d19a66}.dark .hl-key{color:#61afef}.dark .hl-cmt{color:#8b949e}
  .ql-code{font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;overflow:auto;tab-size:2}
  mark{background:rgba(255,204,0,.35);color:inherit;border-radius:2px;padding:0 1px}`;
  document.head.appendChild(st);
}
