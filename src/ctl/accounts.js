// Actions for الحسابات: running accounts and fixed debts (with money set aside and handed over).
import { change, today, v, egp, nowStamp, findBy, toInt, withPhoto } from './core.js';
import { renameAccount, balanceOf } from '../ledger.js';
import { createRunning, moveRunning } from '../people.js';
import { planMonthly, planEvery, createDebt, addInstallment, payDebt, remainingOf } from '../debts.js';
import { createGoal, depositGoal } from '../moves.js';
import { debtPocket } from '../reports.js';
import { toEnglishDigits } from '../format.js';
import { checkSpend, rememberPlace } from '../places.js';
import { toPiasters } from '../ledger.js';

let warn = '';

const dateOr = (id) => v(id) || today();
const RESERVE_SAFE = 'محجوز للديون';

// Money set aside for debts lives in its own safe, made the first time it is needed.
function reserveSafe(st) {
  let safe = st.d.safes.find((s) => s.name === RESERVE_SAFE && !s.archived);
  if (!safe) {
    safe = { id: nowStamp('safe'), name: RESERVE_SAFE, note: '' };
    st.d.safes.push(safe);
  }
  return safe.id;
}

export const accountActions = {
  // A new account opens straight away, since an account with a zero balance sits folded under «خالص».
  'save-person': () => {
    const id = nowStamp('p');
    return change((st) => {
      st.d.people.push(createRunning(st.book, {
        id, person: v('pn-name'), phone: toEnglishDigits(v('pn-phone')),
        openingEgp: egp('pn-open'), openingSide: v('pn-side'), date: today(),
      }));
    }, 'person', { id }, '✓ اتفتح الحساب. سجّل اديته أو خدت منه');
  },
  'person-move': (p) => change((st) => {
    const acc = findBy(st.d.people, p.id, 'الحساب');
    warn = p.side === 'gave' ? checkSpend(st.d, st.book, v('place'), toPiasters(egp('amount'))) : '';
    const entryId = nowStamp('pe');
    moveRunning(st.book, acc, {
      side: p.side, placeId: v('place'), amountEgp: egp('amount'), date: dateOr('date'), note: v('note'), entryId,
    });
    withPhoto(st, entryId);
    rememberPlace(st.d, st.book, v('place'));
  }, 'person', { id: p.id, side: p.side }, () => `✓ اتسجل${warn}`),
  'save-person-edit': (p) => change((st) => {
    const acc = findBy(st.d.people, p.id, 'الحساب');
    const name = String(v('pe-name')).trim();
    if (name.length < 2) throw new Error('اكتب الاسم');
    renameAccount(st.book, acc.accountId, `حساب: ${name}`);
    acc.person = name;
    acc.phone = toEnglishDigits(v('pe-phone')).replace(/\D/g, '');
  }, 'person', { id: p.id }),

  'save-debt': () => change((st) => {
    const totalEgp = egp('dn-total');
    const count = toInt(v('dn-count'), 'عدد الأقساط');
    let installments = [];
    if (v('dn-plan') === 'monthly') installments = planMonthly({ totalEgp, count, firstDate: v('dn-first') });
    if (v('dn-plan') === 'days') installments = planEvery({ totalEgp, count, everyDays: toInt(v('dn-days'), 'عدد الأيام'), firstDate: v('dn-first') });
    st.d.debts.push(createDebt(st.book, {
      id: nowStamp('d'), person: v('dn-person'), phone: toEnglishDigits(v('dn-phone')), direction: v('dn-dir'),
      totalEgp, installments, startDate: v('dn-start') || today(), moveNow: v('dn-move') === 'yes', placeId: v('place'), note: v('dn-note'),
    }));
  }, 'accounts', {}, '✓ اتسجل الدين'),
  'save-debt-edit': (p) => change((st) => {
    const debt = findBy(st.d.debts, p.id, 'الدين');
    const person = String(v('de-person')).trim();
    if (person.length < 2) throw new Error('اكتب اسم الشخص');
    renameAccount(st.book, debt.accountId, `دين: ${person}`);
    debt.person = person;
    debt.phone = toEnglishDigits(v('de-phone')).replace(/\D/g, '');
    const pocket = debtPocket(st.d, debt.id);
    if (pocket) {
      pocket.name = `محجوز: ${person}`;
      renameAccount(st.book, pocket.accountId, `درج: ${pocket.name}`);
    }
  }, 'debt', { id: p.id }),
  'pay-debt': (p) => change((st) => {
    const debt = findBy(st.d.debts, p.id, 'الدين');
    warn = debt.direction === 'out' ? checkSpend(st.d, st.book, v('place'), toPiasters(egp('pay-amount'))) : '';
    const entryId = nowStamp('dp');
    payDebt(st.book, debt, {
      amountEgp: egp('pay-amount'), placeId: v('place'), date: dateOr('date'), note: v('note'), entryId,
    });
    withPhoto(st, entryId);
  }, 'debt', { id: p.id }, () => `✓ اتسجل السداد${warn}`),
  'reserve-debt': (p) => change((st) => {
    const debt = findBy(st.d.debts, p.id, 'الدين');
    let pocket = debtPocket(st.d, debt.id);
    if (!pocket) {
      pocket = createGoal(st.book, { id: nowStamp('g'), name: `محجوز: ${debt.person}`, kind: 'debt', debtId: debt.id, safeId: reserveSafe(st) });
      st.d.goals.push(pocket);
    }
    depositGoal(st.book, pocket, { placeId: v('res-from'), amountEgp: egp('res-amount'), date: today(), note: v('res-note'), entryId: nowStamp('rs') });
  }, 'debt', { id: p.id }, '✓ اتحجز المبلغ للدين'),
  'deliver-debt': (p) => change((st) => {
    const debt = findBy(st.d.debts, p.id, 'الدين');
    const pocket = debtPocket(st.d, debt.id);
    const amount = Math.min(pocket ? balanceOf(st.book, pocket.accountId) : 0, remainingOf(st.book, debt));
    if (amount <= 0) throw new Error('مفيش فلوس محجوزة للدين ده');
    payDebt(st.book, debt, {
      amountEgp: amount / 100, placeId: pocket.accountId, date: today(), entryId: nowStamp('dl'), memo: `سلّمت لـ ${debt.person} من المحجوز`,
    });
  }, 'debt', { id: p.id }, '✓ اتسلّم المحجوز ونزل من الدين'),
  'add-installment': (p) => change((st) => {
    addInstallment(findBy(st.d.debts, p.id, 'الدين'), { dueDate: v('inst-date'), amountEgp: egp('inst-amount') });
  }, 'debt', { id: p.id }),
};
