// The app's running state, the router, and helpers every action uses.
// Actions change the ledger through change(), which saves and then opens the next screen.
import { SCREENS, setupScreen, lockScreen } from '../views.js';
import { introScreen } from '../ui/intro.js';
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
import { FLOW_ROUTES, newFlow } from '../flow.js';

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
  // The question-by-question flow in progress (income, expense, split, daily), and the last thing it saved.
  flow: null,
  saved: null,
  // The intro screens before the first setup: which one is showing, and whether they were passed.
  intro: 0,
  introDone: false,
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
// The old screen names for expense, income and split now start their question-by-question flow.
export function go(name, p = {}, msg = '') {
  if (FLOW_ROUTES[name]) {
    session.flow = newFlow(FLOW_ROUTES[name], p);
    session.pendingPhoto = null;
    session.route = { name: 'flow', p: {} };
    session.flash = msg;
    return render();
  }
  if (name !== 'flow') session.flow = null;
  session.route = { name, p };
  session.flash = msg;
  return render();
}

export async function render() {
  const state = await loadState();
  const flash = session.flash;
  session.flash = '';
  session.lock = state?.d.settings.lock ?? null;
  if (!state && !session.introDone) {
    session.ctx = null;
    root.innerHTML = introScreen(session.intro);
  } else if (!state) {
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
      places: placeList(view.d, book), jamDraft: session.jamDraft, flow: session.flow,
    };
    session.ctx = ctx;
    if (session.route.name === 'flow' && !session.flow) session.route = { name: 'home', p: {} };
    const screen = SCREENS[session.route.name] ?? SCREENS.home;
    root.innerHTML = screen(ctx, session.route.p, flash);
    showSaved();
    fitHubs();
    autoHelp(state);
  }
  window.scrollTo(0, 0);
  root.querySelector('[data-autofocus]')?.focus();
  livePaint();
}

// After a flow records something, the next screen says so once, with «تراجع» and «عدّل».
function showSaved() {
  const s = session.saved;
  if (!s) return;
  if (s.shown) {
    session.saved = null;
    return;
  }
  s.shown = true;
  const bar = document.createElement('div');
  bar.className = `savedbar ${s.warn ? 'warnbar' : ''}`;
  bar.innerHTML = `<span>✓ ${esc(s.text)}${s.warn ? `<br>⚠ ${esc(s.warn)}` : ''}</span>
    ${s.undoIds.length ? '<button type="button" data-do="undo-saved">تراجع</button>' : ''}
    ${s.entryId ? `<button type="button" data-do="edit-entry" data-id="${esc(s.entryId)}">عدّل</button>` : ''}`;
  root.querySelector('.body')?.prepend(bar);
}

// The home circles are drawn on a 390px stage; on a narrower phone the stage shrinks to fit.
function fitHubs() {
  const stage = root.querySelector('.hubstage');
  if (stage) stage.style.zoom = String(Math.min(1, stage.parentElement.clientWidth / 390));
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
    if (!(e.target === overlay || e.target.closest('[data-help-close]'))) return;
    overlay.remove();
    // Back to the field that was waiting for typing (the amount, a name...).
    root.querySelector('[data-autofocus]')?.focus();
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
