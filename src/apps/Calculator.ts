import type { AppDefinition } from '../core/types';
import { calculatorIcon } from '../ui/icons';

export const CalculatorApp: AppDefinition = {
  id: 'calculator',
  name: 'Calculator',
  icon: calculatorIcon,
  defaultSize: { width: 340, height: 500 },
  render() {
    const root = document.createElement('div');
    root.className = 'calculator-app';
    root.innerHTML = `
      <div class="calc-display" aria-live="polite">
        <div class="calc-expr" data-k="expr"></div>
        <div class="calc-value" data-k="val">0</div>
      </div>
      <div class="calc-keys" role="group" aria-label="Calculator keypad">
        <button class="calc-key is-fn" data-a="clear">AC</button>
        <button class="calc-key is-fn" data-a="sign">+/−</button>
        <button class="calc-key is-fn" data-a="pct">%</button>
        <button class="calc-key is-op" data-a="op" data-v="÷">÷</button>
        <button class="calc-key" data-a="digit" data-v="7">7</button>
        <button class="calc-key" data-a="digit" data-v="8">8</button>
        <button class="calc-key" data-a="digit" data-v="9">9</button>
        <button class="calc-key is-op" data-a="op" data-v="×">×</button>
        <button class="calc-key" data-a="digit" data-v="4">4</button>
        <button class="calc-key" data-a="digit" data-v="5">5</button>
        <button class="calc-key" data-a="digit" data-v="6">6</button>
        <button class="calc-key is-op" data-a="op" data-v="−">−</button>
        <button class="calc-key" data-a="digit" data-v="1">1</button>
        <button class="calc-key" data-a="digit" data-v="2">2</button>
        <button class="calc-key" data-a="digit" data-v="3">3</button>
        <button class="calc-key is-op" data-a="op" data-v="+">+</button>
        <button class="calc-key is-zero" data-a="digit" data-v="0">0</button>
        <button class="calc-key" data-a="dot">.</button>
        <button class="calc-key is-eq" data-a="eq">=</button>
      </div>`;

    const exprEl = root.querySelector('[data-k="expr"]') as HTMLElement;
    const valEl = root.querySelector('[data-k="val"]') as HTMLElement;
    let cur = '0';
    let prev: number | null = null;
    let op: string | null = null;
    let reset = false;
    let expr = '';

    const fmt = (n: number) => {
      if (!Number.isFinite(n)) return 'Error';
      const s = parseFloat(n.toPrecision(12)).toString();
      return s.length > 12 ? n.toExponential(6) : s;
    };
    const show = () => { valEl.textContent = cur.length > 12 ? cur.slice(0, 12) : cur; exprEl.textContent = expr; };
    const inputDigit = (d: string) => { if (reset) { cur = '0'; reset = false; } cur = cur === '0' ? d : cur + d; show(); };
    const inputDot = () => { if (reset) { cur = '0'; reset = false; } if (!cur.includes('.')) cur += '.'; show(); };
    const doOp = (symbol: string, a: number, b: number) => {
      if (symbol === '+') return a + b;
      if (symbol === '−') return a - b;
      if (symbol === '×') return a * b;
      if (symbol === '÷') return b === 0 ? NaN : a / b;
      return b;
    };
    const setOp = (next: string) => {
      const n = parseFloat(cur);
      if (prev !== null && op && !reset) {
        prev = doOp(op, prev, n);
        cur = fmt(prev);
      } else {
        prev = n;
      }
      op = next; reset = true; expr = `${fmt(prev!)} ${op}`; show();
    };
    const eq = () => {
      if (prev === null || !op) return;
      const b = parseFloat(cur);
      const res = doOp(op, prev, b);
      expr = `${fmt(prev)} ${op} ${fmt(b)} =`;
      cur = fmt(res); prev = null; op = null; reset = true; show();
    };
    const clear = () => { cur = '0'; prev = null; op = null; reset = false; expr = ''; show(); };
    const sign = () => { if (cur !== '0' && cur !== 'Error') cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur; show(); };
    const pct = () => { const n = parseFloat(cur); if (Number.isFinite(n)) cur = fmt(n / 100); show(); };

    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
      if (!b) return;
      const a = b.dataset.a; const v = b.dataset.v;
      if (a === 'digit' && v) inputDigit(v);
      else if (a === 'dot') inputDot();
      else if (a === 'op' && v) setOp(v);
      else if (a === 'eq') eq();
      else if (a === 'clear') clear();
      else if (a === 'sign') sign();
      else if (a === 'pct') pct();
    });
    root.tabIndex = 0;
    root.addEventListener('keydown', (e) => {
      if (/^[0-9]$/.test(e.key)) inputDigit(e.key);
      else if (e.key === '.') inputDot();
      else if (e.key === '+') setOp('+');
      else if (e.key === '-') setOp('−');
      else if (e.key === '*') setOp('×');
      else if (e.key === '/') { e.preventDefault(); setOp('÷'); }
      else if (e.key === 'Enter' || e.key === '=') eq();
      else if (e.key === 'Escape') clear();
      else if (e.key === 'Backspace') { if (!reset && cur.length > 1) cur = cur.slice(0, -1); else cur = '0'; show(); }
      else if (e.key === '%') pct();
    });
    setTimeout(() => root.focus(), 0);
    return root;
  },
};
