// Actions for الالتزامات: bills, the jam'iya questions, and jam'iya months.
import { session, go, change, today, v, egp, nowStamp, findBy, toInt, withPhoto } from './core.js';
import { createBill, editBill, addIncrease, payBill, undoBill, MONTHLY_KINDS } from '../bills.js';
import {
  createJamiya, payMonth, setMonthStatus, receivePayout, undoReceive, editJamiya, previewJamiya,
} from '../obligations.js';
import { toEnglishDigits } from '../format.js';
import { checkSpend, rememberPlace } from '../places.js';
import { billAmountFor } from '../bills.js';
import { toPiasters } from '../ledger.js';

let warn = '';
import { JAM_STEPS } from '../views.js';

const dateOr = (id) => v(id) || today();
const num = (id) => toEnglishDigits(v(id)).trim();

// Each jam'iya question checks its own answer before moving on.
function readJamAnswer(step) {
  const a = session.jamDraft;
  const key = JAM_STEPS[step];
  const value = num('jq');
  if (key === 'name') {
    if (v('jq').trim().length < 2) throw new Error('اكتب اسم الجمعية');
    a.name = v('jq').trim();
  }
  if (key === 'members') a.members = String(toInt(value, 'عدد الأنفار'));
  if (key === 'monthly') {
    if (!(egp('jq') > 0)) throw new Error('اكتب القسط');
    a.monthly = String(egp('jq'));
  }
  if (key === 'payDay') a.payDay = String(toInt(value || '1', 'يوم الدفع'));
  if (key === 'currentNumber') a.currentNumber = String(toInt(value || '1', 'رقم الشهر'));
  if (key === 'currentPaid') a.currentPaid = v('jq');
  if (key === 'received') a.received = v('jq');
  if (key === 'detail') {
    if (a.received === 'before') a.payout = String(egp('jq'));
    else a.turn = value;
  }
  // Catch impossible answers as early as possible (for example a month after the last one).
  if (['members', 'monthly', 'currentNumber', 'detail'].includes(key) && a.members && a.monthly) {
    previewJamiya({
      members: a.members, monthly: a.monthly, currentNumber: a.currentNumber ?? 1, received: a.received ?? 'no',
      payoutEgp: a.received === 'before' ? a.payout : null, turn: a.received === 'no' ? a.turn : null, thisMonth: today().slice(0, 7),
    });
  }
}

export const duesActions = {
  'save-bill': () => change((st) => {
    st.d.bills.push(createBill(st.book, {
      id: nowStamp('b'), name: v('b-name'), kind: v('b-kind'), amountEgp: egp('b-amount'),
      dueDay: num('b-day'), startMonth: v('b-start'), dueDate: v('b-date'), everyMonths: num('b-every'),
    }));
  }, 'dues', {}, '✓ اتضاف الالتزام'),
  'save-bill-edit': (p) => change((st) => {
    editBill(st.book, findBy(st.d.bills, p.id, 'الالتزام'), {
      name: v('be-name'), amountEgp: egp('be-amount'), dueDay: num('be-day'), dueDate: v('be-date'), everyMonths: num('be-every'),
    });
  }, 'bill', { id: p.id }),
  'add-increase': (p) => change((st) => {
    addIncrease(findBy(st.d.bills, p.id, 'الالتزام'), { fromMonth: v('inc-from'), amountEgp: egp('inc-amount') });
  }, 'bill', { id: p.id }),
  'pay-bill': (p) => change((st) => {
    const bill = findBy(st.d.bills, p.id, 'الالتزام');
    const period = MONTHLY_KINDS.includes(bill.kind) ? (v('bill-period') || p.month) : 'once';
    const typed = v('bill-amount').trim() === '' ? null : toPiasters(egp('bill-amount'));
    warn = checkSpend(st.d, st.book, v('from'), typed ?? (period === 'once' ? bill.amount : billAmountFor(bill, period)));
    const entryId = nowStamp('pb');
    payBill(st.book, bill, {
      period, placeId: v('from'), date: dateOr('date'), entryId, amountEgp: v('bill-amount').trim() === '' ? null : egp('bill-amount'), note: v('note'),
    });
    withPhoto(st, entryId);
    rememberPlace(st.d, st.book, v('from'));
  }, 'dues', {}, () => `✓ اتسجل الدفع${warn}`),
  'undo-bill': (p) => change((st) => {
    undoBill(st.book, findBy(st.d.bills, p.id, 'الالتزام'), p.month, { id: nowStamp('ub'), date: today() });
  }, 'bill', { id: p.id, month: p.month }, '✓ اتعكس الدفع'),

  // ---- the jam'iya questions ----
  'jam-next': (p) => {
    readJamAnswer(Number(p.step));
    return go('jam-new', { step: Number(p.step) + 1 });
  },
  'jam-prev': (p) => go('jam-new', { step: Math.max(0, Number(p.step) - 1) }),
  'jam-create': () => change((st) => {
    const a = session.jamDraft;
    st.d.jamiyas.push(createJamiya(st.book, {
      id: nowStamp('j'), name: a.name, members: a.members, monthly: a.monthly, payDay: a.payDay ?? 1,
      currentNumber: a.currentNumber ?? 1, currentPaid: a.currentPaid === 'yes', received: a.received ?? 'no',
      payoutEgp: a.received === 'before' ? a.payout : null, turn: a.received === 'no' ? a.turn : null,
      thisMonth: today().slice(0, 7), date: today(),
    }));
    session.jamDraft = {};
  }, 'dues', {}, '✓ اتضافت الجمعية'),

  'jam-pay': (p) => change((st) => {
    const j = findBy(st.d.jamiyas, p.id, 'الجمعية');
    warn = checkSpend(st.d, st.book, v('from'), j.monthly);
    const entryId = nowStamp('jp');
    payMonth(st.book, j, { index: Number(p.month), placeId: v('from'), date: dateOr('date'), note: v('note'), entryId });
    withPhoto(st, entryId);
    rememberPlace(st.d, st.book, v('from'));
  }, 'jam', { id: p.id }, () => `✓ اتسجل قسط الجمعية${warn}`),
  'jam-mark': (p) => change((st) => {
    setMonthStatus(st.book, findBy(st.d.jamiyas, p.id, 'الجمعية'), {
      index: Number(p.month), status: p.status, date: today(), idPrefix: nowStamp('jam-fix'),
    });
  }, 'jam', { id: p.id, month: p.month }),
  'jam-receive': (p) => change((st) => {
    receivePayout(st.book, findBy(st.d.jamiyas, p.id, 'الجمعية'), {
      placeId: v('to'), payoutEgp: egp('jam-payout'), date: today(), entryId: nowStamp('jr'),
    });
  }, 'jam', { id: p.id }, '✓ اتسجل القبض'),
  'jam-unreceive': (p) => change((st) => {
    undoReceive(st.book, findBy(st.d.jamiyas, p.id, 'الجمعية'), { id: nowStamp('jam-unrecv'), date: today() });
  }, 'jam', { id: p.id }, '✓ اتعكس القبض'),
  'save-jam-edit': (p) => change((st) => {
    editJamiya(st.book, findBy(st.d.jamiyas, p.id, 'الجمعية'), {
      name: v('je-name'), payDay: num('je-day'), remindDays: num('je-remind'), payoutEgp: egp('je-payout'),
      turn: num('je-turn'), holder: v('je-holder'), phone: toEnglishDigits(v('je-phone')),
    });
  }, 'jam', { id: p.id }),
};

