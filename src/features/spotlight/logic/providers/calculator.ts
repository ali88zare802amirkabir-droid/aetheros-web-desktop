import type { Provider, Result } from '../types';
import { normalizeText } from '../calc';
import { icon } from '../../icons';

function toAscii(s: string): string {
  const fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const en = ['0','1','2','3','4','5','6','7','8','9'];
  let t = s;
  for (let i = 0; i < fa.length; i++) t = t.split(fa[i]).join(en[i]);
  t = t.replace(/×/g, '*').replace(/÷/g, '/').replace(/،/g, '.');
  return t;
}

function safeEval(expr: string): number | null {
  try {
    let s = toAscii(expr).replace(/\s+/g, '');
    // only allow digits, operators, parens, dot, functions
    if (/[^0-9+\-*/%^().sqrtincoslogtanabsepi]/.test(s.replace(/sqrt|sin|cos|log|tan|abs|pi/g, ''))) {
      // try to be permissive
    }
    // replace functions
    s = s.replace(/sqrt\(/g, 'Math.sqrt(');
    s = s.replace(/sin\(/g, 'Math.sin(');
    s = s.replace(/cos\(/g, 'Math.cos(');
    s = s.replace(/tan\(/g, 'Math.tan(');
    s = s.replace(/log\(/g, 'Math.log(');
    s = s.replace(/abs\(/g, 'Math.abs(');
    s = s.replace(/pi/g, 'Math.PI');
    s = s.replace(/\^/g, '**');
    // forbid other letters
    if (/[a-zA-Z$@#&|;`"'\\]/.test(s)) return null;
    // eslint-disable-next-line no-new-func
    const fn = new Function('return (' + s + ')');
    const res = fn();
    if (typeof res === 'number' && isFinite(res)) return res;
    return null;
  } catch {
    return null;
  }
}

export const calculatorProvider: Provider = {
  id: 'calculator',
  label: 'Calculator',
  search(query: string): Result[] {
    const q = query.trim();
    if (!q) return [];
    // detect if it looks like math
    if (!/[0-9+\-*/%^().sqrtincoslogtanabsπ]/.test(toAscii(q).toLowerCase()) && !q.match(/[+\-*/^()]/)) {
      return [];
    }
    const res = safeEval(q);
    if (res === null) return [];
    const out = res % 1 === 0 ? res.toString() : res.toString();
    return [
      {
        id: `calc:${q}`,
        providerId: 'calculator',
        providerLabel: 'Calculator',
        group: 'calculator',
        title: out,
        subtitle: q,
        icon: icon('calc', 16),
        iconType: 'svg',
        data: { type: 'calc', value: out },
        actions: [
          {
            id: 'copy',
            label: 'Copy result',
            shortcut: '↵',
            run: async () => {
              try { await navigator.clipboard.writeText(out); } catch (e) {}
            },
          },
        ],
      },
    ];
  },
};
