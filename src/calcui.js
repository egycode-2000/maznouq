// The calculator window. It lives outside the app root, so screen re-renders never close it.
import { newCalc, press, trail, resultValue } from './calc.js';

const KEYS = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='];
let state = newCalc();
let overlay = null;
let targetId = '';

function paint() {
  overlay.querySelector('.calc-trail').textContent = trail(state);
  overlay.querySelector('.calc-display').textContent = state.cur;
}

export function closeCalc() {
  overlay?.remove();
  overlay = null;
}

// target: id of the money field that receives the result, or '' for a free calculation.
export function openCalc(target = '') {
  closeCalc();
  targetId = target;
  state = newCalc();
  const field = target ? document.getElementById(target) : null;
  if (field && Number(field.value) > 0) {
    for (const ch of String(Number(field.value))) state = press(state, ch);
  }
  overlay = document.createElement('div');
  overlay.className = 'calc-overlay';
  overlay.innerHTML = `
    <div class="calc" role="dialog" aria-label="آلة حاسبة">
      <div class="calc-screen" dir="ltr"><div class="calc-trail"></div><div class="calc-display">0</div></div>
      <div class="calc-keys" dir="ltr">
        ${KEYS.map((k) => `<button type="button" data-key="${k}" class="${/[0-9.]/.test(k) ? '' : 'op'} ${k === '0' ? 'wide' : ''} ${k === '=' ? 'eq' : ''}">${k === '-' ? '−' : k}</button>`).join('')}
      </div>
      ${field ? '<button type="button" class="btn" data-calc-use>استخدم الناتج</button>' : ''}
      <button type="button" class="btn2" data-calc-close>قفل</button>
    </div>`;
  overlay.addEventListener('click', (event) => {
    const key = event.target.closest('[data-key]');
    if (key) {
      state = press(state, key.dataset.key);
      return paint();
    }
    if (event.target.closest('[data-calc-use]')) {
      state = press(state, '=');
      const value = resultValue(state);
      if (value === null) return paint();
      const input = document.getElementById(targetId);
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return closeCalc();
    }
    if (event.target === overlay || event.target.closest('[data-calc-close]')) closeCalc();
  });
  document.body.append(overlay);
  paint();
}
