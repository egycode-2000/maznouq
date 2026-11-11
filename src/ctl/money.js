// Actions for money in and out: expense, income, transfer, split, saved splits, daily split, borrows, budgets.
import {
  session, change, today, v, egp, piasters, checked, nowStamp, findBy, feeAccount, miscSource, splitRows, withPhoto,
} from './core.js';
import { addAccount, balanceOf, renameAccount, toPiasters } from '../ledger.js';
import { recordIncome, recordExpense, transfer, planSplit, applySplit } from '../moves.js';
import { addBorrow, repayBorrow, leftOf } from '../borrows.js';
import { makeTemplate, markDone } from '../daily.js';
import { placeList, checkSpend, rememberPlace } from '../places.js';
import { formatMoney, toEnglishDigits } from '../format.js';
import { MISC_SOURCE } from '../views.js';

const dateOr = (id) => v(id) || today();

// Spending more than a place holds: the gap comes from another place first (and may be a borrow).
function coverShortfall(st, fromId, amount, date) {
  const have = balanceOf(st.book, fromId);
  const short = amount - Math.max(0, have);
  if (short <= 0) return;
  const place = placeList(st.d, st.book).find((x) => x.id === fromId);
  const coverId = v('cover');
  if (!coverId || coverId === fromId) {
    if (place?.kind === 'drawer') throw new Error(`الدرج فيه ${formatMoney(Math.max(0, have))} بس. اختار مكان تاني تكمّل منه`);
    return; // cash or a wallet may go below zero, as agreed: warn, do not block
  }
  const cover = placeList(st.d, st.book).find((x) => x.id === coverId);
  if (cover && cover.balance < short) {
    throw new Error(`${cover.name} فيه ${formatMoney(Math.max(0, cover.balance))} بس، والناقص ${formatMoney(short)}. اختار مكان تاني`);
  }
  const entryId = nowStamp('cover');
  transfer(st.book, { fromId: coverId, toId: fromId, amountEgp: short / 100, date, entryId, memo: 'تكملة مصروف' });
  if (checked('cover-back')) addBorrow(st.d, { id: nowStamp('b'), fromId: coverId, toId: fromId, amount: short, date, entryId });
}

let warn = '';

function saveExpense(next) {
  warn = '';
  return change((st) => {
    const fromId = v('from');
    const amount = piasters('amount');
    if (!(amount > 0)) throw new Error('اكتب المبلغ');
    if (!v('category')) throw new Error('اختار صرفت على إيه');
    const date = dateOr('date');
    coverShortfall(st, fromId, amount, date);
    warn = checkSpend(st.d, st.book, fromId, amount);
    const entryId = nowStamp('exp');
    recordExpense(st.book, {
      categoryId: v('category'), placeId: fromId, amountEgp: amount / 100, date, note: v('note'), entryId,
    });
    withPhoto(st, entryId);
    st.d.settings.lastCategory = v('category');
    rememberPlace(st.d, st.book, fromId);
  }, next, {}, () => `✓ اتسجل المصروف${warn}`);
}

function saveIncome(again) {
  const amountText = String(egp('amount'));
  let next = again ? 'income-new' : 'home';
  let params = again ? { id: v('sourceId') } : {};
  return change((st) => {
    let sourceId = v('sourceId');
    if (sourceId === MISC_SOURCE.id) sourceId = miscSource(st);
    const entryId = nowStamp('inc');
    recordIncome(st.book, {
      sourceId, placeId: v('to'), amountEgp: egp('amount'), date: dateOr('date'),
      payer: v('payer'), note: v('note'), entryId,
    });
    withPhoto(st, entryId);
    st.d.settings.lastSource = sourceId;
    // After income, offer to split it when there are drawers or saved splits.
    const hasDrawers = st.d.goals.some((g) => !g.archived);
    if (!again && (hasDrawers || st.d.templates.some((t) => !t.daily))) {
      next = 'split';
      const tpl = st.d.templates.find((t) => !t.daily);
      params = { from: v('to'), amount: amountText, back: 'home', ...(tpl ? { tpl: tpl.id } : {}) };
    }
  }, () => next, () => params, () => (next === 'split' ? '✓ اتسجل الدخل. وزّعه دلوقتي أو اضغط تخطّي' : '✓ اتسجل الدخل'));
}

// The split rows mapped to where each amount goes.
function splitTargets(st) {
  const places = placeList(st.d, st.book);
  return (id) => {
    const drawer = places.find((x) => x.id === id && x.kind === 'drawer');
    if (drawer) return { accountId: id, type: 'pocket', name: drawer.name };
    const cat = st.d.categories.find((c) => c.id === id);
    if (cat) return { accountId: id, type: 'expense', name: cat.name };
    throw new Error('فيه سطر مكانه اتلغى');
  };
}

let doneMsg = '';

export const moneyActions = {
  'save-expense': () => saveExpense('home'),
  'save-expense-more': () => saveExpense('expense'),
  'save-income': () => saveIncome(false),
  'save-income-more': () => saveIncome(true),

  'save-transfer': () => change((st) => {
    const fee = egp('fee');
    const date = dateOr('date');
    const entryId = nowStamp('tr');
    const r = transfer(st.book, {
      fromId: v('from'), toId: v('to'), amountEgp: egp('amount'), feeEgp: fee,
      feeAccountId: fee > 0 ? feeAccount(st) : null, date, entryId, note: v('note'),
    });
    withPhoto(st, entryId);
    if (checked('tr-borrow')) addBorrow(st.d, { id: nowStamp('b'), fromId: v('from'), toId: v('to'), amount: r.arrived, date, entryId });
    doneMsg = r.fee ? `✓ اتحوّل. وصل ${formatMoney(r.arrived)} والخصم ${formatMoney(r.fee)}` : '✓ اتحوّل';
  }, () => session.route.p.back ?? 'home', {}, () => doneMsg),

  'do-split': (p) => change((st) => {
    const amount = toPiasters(egp('split-amount'));
    const rows = splitRows();
    const plan = planSplit(amount, rows);
    const target = splitTargets(st);
    const outside = checked('split-outside');
    const total = applySplit(st.book, {
      placeId: v('split-from'), date: today(), idPrefix: nowStamp('sp'), note: v('split-note'),
      outsideSourceId: outside ? miscSource(st) : null, payer: v('split-payer'),
      lines: plan.lines.map((l) => ({ ...target(l.id), amount: l.amount })),
    });
    const name = v('split-save-name').trim();
    if (name) {
      const keep = rows.filter((r) => r.value);
      const old = st.d.templates.find((t) => t.id === p.tpl && t.name === name);
      if (old) old.rows = keep.map((r) => ({ target: r.id, mode: r.mode, value: r.value }));
      else st.d.templates.push(makeTemplate({ id: nowStamp('tpl'), name, sourceId: v('split-from'), rows: keep.map((r) => ({ target: r.id, mode: r.mode, value: r.value })) }));
    }
    doneMsg = outside
      ? `✓ اتسجل ${formatMoney(total)} دخل من بره واتوزّع`
      : `✓ اتوزّع ${formatMoney(total)} والباقي ${formatMoney(plan.rest)} في مكانه`;
  }, 'home', {}, () => doneMsg),

  'save-template': (p) => change((st) => {
    const rows = splitRows().filter((r) => r.value).map((r) => ({ target: r.id, mode: r.mode, value: r.value }));
    const daily = checked('tp-daily');
    const old = st.d.templates.find((t) => t.id === p.id);
    const made = makeTemplate({
      id: old?.id ?? nowStamp('tpl'), name: v('tp-name'), daily, sourceId: v('tp-source'), rows,
      startDate: old ? (old.lastDone ?? today()) : (v('tp-start') || today()),
    });
    if (old) {
      Object.assign(old, { name: made.name, daily: made.daily, sourceId: made.sourceId, rows: made.rows, active: checked('tp-active') });
      if (old.daily && !old.lastDone) old.lastDone = made.lastDone;
    } else {
      st.d.templates.push(made);
    }
  }, 'templates'),
  'delete-template': (p) => change((st) => {
    st.d.templates = st.d.templates.filter((t) => t.id !== p.id);
  }, 'templates', {}, '✓ اتمسحت التقسيمة'),

  'confirm-daily': (p) => change((st) => {
    const t = findBy(st.d.templates, p.id, 'التقسيمة');
    const target = splitTargets(st);
    const lines = t.rows.map((r, i) => (checked(`dy-on-${i}`) ? { ...target(r.target), amount: piasters(`dy-val-${i}`) } : null))
      .filter((l) => l && l.amount > 0);
    let total = 0;
    if (lines.length) total = applySplit(st.book, { placeId: v('dy-from'), date: today(), idPrefix: nowStamp('dy'), note: v('dy-note'), lines });
    markDone(t, today());
    doneMsg = total ? `✓ اتحط ${formatMoney(total)} في الأدراج` : '✓ ماتسجّلش حاجة النهارده';
  }, 'home', {}, () => doneMsg),
  'skip-daily': (p) => change((st) => {
    markDone(findBy(st.d.templates, p.id, 'التقسيمة'), today());
  }, 'home', {}, '✓ اتخطيت'),

  'repay-borrow': (p) => change((st) => {
    const b = findBy(st.d.borrows, p.id, 'السلفة');
    const amount = Math.min(piasters(`br-${b.id}`), leftOf(b));
    if (!(amount > 0)) throw new Error('اكتب المبلغ اللي هترجّعه');
    transfer(st.book, { fromId: b.toId, toId: b.fromId, amountEgp: amount / 100, date: today(), entryId: nowStamp('tr'), memo: 'رجّعت سلفة' });
    repayBorrow(st.d, b.id, amount);
  }, 'borrows', {}, '✓ اترجّعت'),

  'save-source': () => change((st) => {
    const name = String(v('src-name')).trim();
    if (name.length < 2) throw new Error('اكتب اسم المصدر');
    const id = nowStamp('s');
    addAccount(st.book, { id, name, type: 'income' });
    st.d.sources.push({ id, name, kind: v('src-kind') === 'monthly' ? 'monthly' : 'open' });
  }, 'income'),
  'save-source-edit': (p) => change((st) => {
    const s = findBy(st.d.sources, p.id, 'المصدر');
    s.name = renameAccount(st.book, s.id, v('src-name'));
    s.kind = v('src-kind') === 'monthly' ? 'monthly' : 'open';
  }, 'income'),

  'save-budgets': () => change((st) => {
    for (const c of st.d.categories) {
      if (!document.getElementById(`bud-${c.id}`)) continue;
      const amount = piasters(`bud-${c.id}`);
      if (amount > 0) st.d.budgets[c.id] = amount;
      else delete st.d.budgets[c.id];
    }
  }, 'budgets'),
  'save-categories': () => change((st) => {
    for (const c of st.d.categories) {
      if (document.getElementById(`cn-${c.id}`)) c.name = renameAccount(st.book, c.id, v(`cn-${c.id}`));
    }
  }, 'categories'),
  'add-category': () => change((st) => {
    const name = toEnglishDigits(String(v('cat-new'))).trim();
    if (name.length < 2) throw new Error('اكتب الاسم');
    const id = nowStamp('e');
    addAccount(st.book, { id, name, type: 'expense' });
    st.d.categories.push({ id, name });
  }, 'categories'),
};
