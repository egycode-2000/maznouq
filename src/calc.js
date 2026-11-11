// Simple calculator logic (no screen code here). Works like a basic pocket calculator:
// each operation is applied as soon as the next one is pressed.
const OPS = ['+', '-', '×', '÷'];

export function newCalc() {
  return { cur: '0', acc: null, op: null, pending: false, replace: true, error: false };
}

function fmt(n) {
  return String(Math.round(n * 1e8) / 1e8);
}

function apply(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (b === 0) return null;
  return a / b;
}

export function press(state, key) {
  if (key === 'C' || state.error) {
    const fresh = newCalc();
    if (key === 'C' || !/^[0-9.]$/.test(key)) return fresh;
    state = fresh;
  }
  const s = { ...state };

  if (/^[0-9]$/.test(key)) {
    if (s.replace) { s.cur = key; s.replace = false; } else if (s.cur.replace('.', '').length < 12) s.cur = s.cur === '0' ? key : s.cur + key;
    s.pending = true;
    return s;
  }
  if (key === '.') {
    if (s.replace) { s.cur = '0.'; s.replace = false; } else if (!s.cur.includes('.')) s.cur += '.';
    s.pending = true;
    return s;
  }
  if (key === '⌫') {
    if (!s.replace) s.cur = s.cur.length > 1 ? s.cur.slice(0, -1) : '0';
    return s;
  }
  if (key === '%') {
    const n = Number(s.cur);
    // 200 + 10 % means 200 + 20. 200 × 10 % means 200 × 0.1.
    const value = s.op === '+' || s.op === '-' ? (s.acc * n) / 100 : n / 100;
    s.cur = fmt(value);
    s.pending = true;
    s.replace = true;
    return s;
  }
  if (OPS.includes(key) || key === '=') {
    if (s.op && (s.pending || key === '=')) {
      const result = apply(s.acc, s.op, Number(s.cur));
      if (result === null) return { ...newCalc(), cur: 'مينفعش القسمة على صفر', error: true };
      s.acc = result;
    } else if (!s.op) {
      s.acc = Number(s.cur);
    }
    s.op = key === '=' ? null : key;
    s.cur = fmt(s.acc);
    s.pending = false;
    s.replace = true;
    return s;
  }
  return s;
}

// The small line above the number, e.g. "200 ×".
export function trail(state) {
  return state.op && state.acc !== null ? `${fmt(state.acc)} ${state.op === '-' ? '−' : state.op}` : '';
}

// The value to put into a money field: two decimals at most, never negative.
export function resultValue(state) {
  const n = Number(state.cur);
  if (state.error || !Number.isFinite(n) || n < 0) return null;
  return String(Math.round(n * 100) / 100);
}
