// Actions for transfer, saved splits, the daily split, borrows, income sources, budgets and spending categories.
// Recording an expense, an income or a «وزّع» is in ctl/flow.js.
import {
  session, change, today, v, egp, piasters, checked, nowStamp, findBy, feeAccount, splitRows, withPhoto,
} from './core.js';
import { addAccount, renameAccount } from '../ledger.js';
import { transfer, applySplit } from '../moves.js';
import { addBorrow, repayBorrow, leftOf } from '../borrows.js';
import { makeTemplate, markDone } from '../daily.js';
import { placeList } from '../places.js';
import { formatMoney, toEnglishDigits } from '../format.js';

const dateOr = (id) => v(id) || today();

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

  'save-template': (p) => change((st) => {
    const rows = splitRows().filter((r) => r.value).map((r) => ({ target: r.id, mode: r.mode, value: r.value }));
    const daily = checked('tp-daily');
    const old = st.d.templates.find((t) => t.id === p.id);
    const made = makeTemplate({
      id: old?.id ?? nowStamp('tpl'), name: v('tp-name'), daily, sourceId: v('tp-source'), rows,
      startDate: old ? (old.lastDone ?? today()) : today(),
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
    const lines = t.rows.map((r, i) => (p.all || checked(`dy-on-${i}`) ? { ...target(r.target), amount: piasters(`dy-val-${i}`) } : null))
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
    // Money spent from a drawer goes back from the place you choose; a borrow between two places goes back the way it came.
    const fromId = b.toId ?? v(`brp-${b.id}`);
    const entryId = nowStamp('tr');
    transfer(st.book, { fromId, toId: b.fromId, amountEgp: amount / 100, date: today(), entryId, memo: 'رجّعت سلفة' });
    st.d.repays[entryId] = { borrowId: b.id, amount: repayBorrow(st.d, b.id, amount) };
  }, 'borrows', () => session.route.p, '✓ اترجّعت'),

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

  // Names and monthly limits of the spending categories, saved together from «أوجه الصرف».
  'save-categories': () => change((st) => {
    for (const c of st.d.categories) {
      if (document.getElementById(`cn-${c.id}`)) c.name = renameAccount(st.book, c.id, v(`cn-${c.id}`));
      if (!document.getElementById(`bud-${c.id}`)) continue;
      const amount = piasters(`bud-${c.id}`);
      if (amount > 0) st.d.budgets[c.id] = amount;
      else delete st.d.budgets[c.id];
    }
  }, 'categories', {}, '✓ اتحفظ'),
  'add-category': () => change((st) => {
    const name = toEnglishDigits(String(v('cat-new'))).trim();
    if (name.length < 2) throw new Error('اكتب الاسم');
    const id = nowStamp('e');
    addAccount(st.book, { id, name, type: 'expense' });
    st.d.categories.push({ id, name });
    const limit = piasters('cat-new-limit');
    if (limit > 0) st.d.budgets[id] = limit;
  }, 'categories', {}, '✓ اتضاف'),
};
