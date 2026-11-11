// The app's running state, the router, and helpers every action uses.
// Actions change the ledger through change(), which saves and then opens the next screen.
import { SCREENS, setupScreen, lockScreen } from '../views.js';
import { photoKey, markPhoto } from '../photos.js';
import { loadState, persist, todayIso, nowStamp } from '../state.js';
import { saveValue } from '../storage.js';
import { SETUP_KEY } from '../state.js';
import { parseMoneyInput, toEnglishDigits, formatMoney } from '../format.js';
import { addAccount, toPiasters } from '../ledger.js';
import { viewData } from '../archive.js';
import { placeList } from '../places.js';
import { EXAMPLES } from '../ui/examples.js';
import { esc } from '../ui/common.js';

export const root = document.getElementById('app');
const DEFAULT_CATEGORIES = ['أكل', 'مواصلات', 'موبايل ونت', 'ترفيه', 'ملابس', 'صحة', 'تعليم', 'صدقات'];

export function freshDraft() {
  return {
    name: '',
    wallets: [{ id: 'w-cash', name: 'الكاش', opening: '' }],
    sources: [{ id: 's-1', name: 'شغل أو دروس', kind: 'monthly' }],
    categories: DEFAULT_CATEGORIES.map((name, i) => ({ id: `c-${i + 1}`, name, on: i < 3 || name === 'صدقات' })),
  };
}

// Everything that lives between screens: where you are, the message to show, and unfinished forms.
export const session = {
  route: { name: 'home', p: {} },
  flash: '',
  setupStep: 0,
  draft: freshDraft(),
  jamDraft: {},
  ctx: null,
  // The lock: whether the code was entered, the digits typed so far, wrong tries, and the lock settings.
  unlocked: false,
  pin: '',
  pinFails: 0,
  pinWaitUntil: 0,
  lock: null,
  hiddenAt: 0,
  // An invoice photo read from the form, waiting for the entry it belongs to.
  pendingPhoto: null,
  photoFor: null,
};

export { nowStamp };
export const today = () => todayIso();
export const v = (id) => document.getElementById(id)?.value ?? '';
export const egp = (id) => parseMoneyInput(v(id));
export const piasters = (id) => toPiasters(egp(id));
export const checked = (id) => Boolean(document.getElementById(id)?.checked);

export function toInt(text, label) {
  const n = Number(toEnglishDigits(String(text)).trim() || 0);
  if (!Number.isInteger(n)) throw new Error(`${label} لازم يكون رقم صحيح`);
  return n;
}

export function shiftDay(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Opens a screen. msg is shown at the top: start it with ✓ for success, anything else is an error.
export function go(name, p = {}, msg = '') {
  session.route = { name, p };
  session.flash = msg;
  return render();
}

export async function render() {
  const state = await loadState();
  const flash = session.flash;
  session.flash = '';
  session.lock = state?.d.settings.lock ?? null;
  if (!state) {
    session.ctx = null;
    root.innerHTML = setupScreen(session.draft, session.setupStep, flash);
  } else if (session.lock && !session.unlocked) {
    session.ctx = null;
    document.documentElement.dataset.theme = state.d.settings.theme;
    root.innerHTML = lockScreen(session.lock, session.pin.length, flash);
    return;
  } else {
    const { d, book } = state;
    document.documentElement.dataset.theme = d.settings.theme;
    const view = viewData(d, book);
    const ctx = {
      d: view.d, archived: view.archived, book, today: today(), month: today().slice(0, 7),
      places: placeList(view.d, book), jamDraft: session.jamDraft,
    };
    session.ctx = ctx;
    const screen = SCREENS[session.route.name] ?? SCREENS.home;
    root.innerHTML = screen(ctx, session.route.p, flash);
    autoHelp(state);
  }
  window.scrollTo(0, 0);
  root.querySelector('[data-autofocus]')?.focus();
  livePaint();
}

// Runs a change on the live ledger, saves it, then opens the next screen.
// next, params and msg may be functions, for when the change itself decides where to go.
export async function change(fn, next = 'home', params = {}, msg = '✓ اتحفظ') {
  const state = await loadState();
  if (!state) throw new Error('مفيش بيانات لسه، كمّل الإعداد الأول');
  session.photoFor = null;
  fn(state);
  await persist(state);
  if (session.photoFor && session.pendingPhoto) await saveValue(photoKey(session.photoFor), session.pendingPhoto);
  session.pendingPhoto = null;
  session.photoFor = null;
  const val = (x) => (typeof x === 'function' ? x() : x);
  return go(val(next), val(params), val(msg));
}

// Shows an error at the top without re-rendering, so typed values stay.
export function showError(message) {
  const body = root.querySelector('.body');
  if (!body) return;
  body.querySelectorAll(':scope > .error, :scope > .notice').forEach((n) => n.remove());
  const box = document.createElement('div');
  box.className = 'error';
  box.textContent = message;
  body.prepend(box);
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export const findBy = (list, id, label) => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`${label} مش موجود`);
  return found;
};

// The expense account for transfer fees, made the first time it is needed.
export function feeAccount(st) {
  const id = 'e-fees';
  if (!st.book.accounts.has(id)) {
    addAccount(st.book, { id, name: 'رسوم تحويل', type: 'expense' });
    st.d.categories.push({ id, name: 'رسوم تحويل' });
  }
  return id;
}

// The income source used for money from outside with no regular source.
export function miscSource(st) {
  const id = 's-misc';
  if (!st.book.accounts.has(id)) {
    addAccount(st.book, { id, name: 'دخل متفرق', type: 'income' });
    st.d.sources.push({ id, name: 'دخل متفرق', kind: 'open' });
  }
  return id;
}

// ---------- «مثال» ----------
export function openHelp(key) {
  const ex = EXAMPLES[key];
  if (!ex) return;
  document.querySelector('.help-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.innerHTML = `
    <div class="help-sheet" role="dialog" aria-label="مثال">
      <div class="lbl">الصفحة دي بتعمل إيه؟</div>
      <p>${esc(ex.what)}</p>
      <div class="lbl">مثال</div>
      <ol>${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <button class="btn" data-help-close>فهمت</button>
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-help-close]')) overlay.remove();
  });
  document.body.append(overlay);
}

// The first time a screen opens, its example shows by itself (unless turned off in settings).
function autoHelp(state) {
  const key = root.querySelector('[data-help]')?.dataset.help;
  const s = state.d.settings;
  if (!key || !s.autoExamples || s.seen?.[key]) return;
  openHelp(key);
  s.seen = { ...(s.seen ?? {}), [key]: true };
  saveValue(SETUP_KEY, { ...state.d, settings: s }).catch(() => {});
}

// ---------- Live numbers on forms (no saving, display only) ----------
const fieldMoney = (el) => {
  try { return toPiasters(parseMoneyInput(el?.value ?? '')); } catch { return null; }
};
const chosen = (group) => root.querySelector(`[data-pickgroup="${group}"] .chip.on`);

export function livePaint() {
  paintSplit('split-summary', document.getElementById('split-amount'));
  paintCover();
  paintFee();
  paintPut();
  paintCount();
}

function splitRows() {
  return [...root.querySelectorAll('.split-val[data-target]')].map((input) => ({
    id: input.dataset.target,
    mode: v(`spm-${input.dataset.target}`) === 'pct' ? 'pct' : 'amt',
    value: input.value.trim() === '' ? 0 : parseMoneyInput(input.value),
  }));
}
export { splitRows };

function paintSplit(boxId, amountInput) {
  const box = document.getElementById(boxId);
  if (!box || !amountInput) return;
  try {
    const amount = fieldMoney(amountInput) ?? 0;
    const rows = splitRows();
    let total = 0;
    for (const r of rows) total += r.mode === 'pct' ? Math.round((amount * r.value) / 100) : Math.round(r.value * 100);
    const rest = amount - total;
    box.className = `card split-summary ${rest < 0 ? 'neg' : ''}`;
    box.innerHTML = rest < 0
      ? `التوزيع أكبر من المبلغ بـ ${formatMoney(-rest)}`
      : `<div class="row"><span>هيتوزّع</span><b>${formatMoney(total)}</b></div><div class="row"><span>يفضل في مكانه</span><b>${formatMoney(rest)}</b></div>`;
  } catch (e) {
    box.className = 'card split-summary neg';
    box.textContent = e.message;
  }
}

function paintCount() {
  const box = document.getElementById('count-diff');
  if (!box) return;
  const dens = [...root.querySelectorAll('.den')];
  if (dens.some((el) => el.value.trim() !== '')) {
    const total = dens.reduce((sum, el, i) => sum + Math.round([200, 100, 50, 20, 10, 5, 1, 0.5][i] * 100) * (Number(toEnglishDigits(el.value)) || 0), 0);
    document.getElementById('count-amount').value = String(total / 100);
  }
  const recorded = Number(chosen('count-place')?.dataset.balance ?? 0);
  const counted = fieldMoney(document.getElementById('count-amount'));
  if (counted === null || document.getElementById('count-amount').value.trim() === '') {
    box.innerHTML = `<div class="row"><span>البرنامج شايف</span><b>${formatMoney(recorded)}</b></div>`;
    return;
  }
  const diff = counted - recorded;
  const line = diff === 0 ? 'مظبوط، مفيش فرق' : diff < 0 ? `ناقص ${formatMoney(-diff)}` : `زيادة ${formatMoney(diff)}`;
  box.innerHTML = `<div class="row"><span>البرنامج شايف</span><b>${formatMoney(recorded)}</b></div>
    <div class="row"><span>إنت عدّيت</span><b>${formatMoney(counted)}</b></div>
    <div class="row total ${diff < 0 ? 'neg' : ''}"><span>الفرق</span><b>${line}</b></div>`;
}

function paintCover() {
  const box = document.getElementById('cover');
  if (!box) return;
  const amount = fieldMoney(document.getElementById('amount')) ?? 0;
  const from = chosen('from');
  const balance = Number(from?.dataset.balance ?? 0);
  const short = amount - Math.max(0, balance);
  box.hidden = !(amount > 0 && short > 0);
  if (!box.hidden) document.getElementById('cover-text').textContent = `المكان ده فيه ${formatMoney(Math.max(0, balance))}، ناقص ${formatMoney(short)}`;
}

function paintFee() {
  const fee = document.getElementById('fee');
  if (!fee || !session.ctx) return;
  const amount = fieldMoney(document.getElementById('amount')) ?? 0;
  const fromId = v('from');
  const toId = v('to');
  const wallet = session.ctx.d.wallets.find((w) => w.id === fromId);
  const cash = session.ctx.d.wallets.find((w) => w.kind === 'cash');
  if (!fee.dataset.touched) {
    const pct = wallet && wallet.kind !== 'cash' && toId === cash?.id ? wallet.feePct || 0 : 0;
    const suggested = Math.round((amount * pct) / 100);
    fee.value = suggested ? String(suggested / 100) : '';
  }
  const feeP = fieldMoney(fee) ?? 0;
  document.getElementById('arrive').textContent = amount ? `هيوصل ${formatMoney(Math.max(0, amount - feeP))}` : '';
}

function paintPut() {
  const out = document.getElementById('put-total');
  if (!out) return;
  const total = [...root.querySelectorAll('.put-val')].reduce((s, el) => s + (fieldMoney(el) ?? 0), 0);
  out.textContent = total ? `الإجمالي ${formatMoney(total)}` : '';
}

export { persist, loadState };

// Links the invoice photo picked in the form (if any) to the entry just recorded.
export function withPhoto(st, entryId) {
  if (!session.pendingPhoto) return;
  markPhoto(st.d, entryId);
  session.photoFor = entryId;
}
