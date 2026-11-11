// الجمعية (rotating savings), booked through the ledger with one account per jam'iya.
// The account balance is your position in the jam'iya, and it is the only source for that number:
//   positive = ليك في الجمعية (you paid in and have not received yet)
//   negative = عليك للجمعية (you received the payout and still owe the remaining months)
// Rules:
//  - Paying a month is not an expense: money moves from your cash (or any place) into the jam'iya.
//  - Receiving the payout is not income: money moves from the jam'iya into a place.
//  - Anything that happened before the app (months paid, payout received) is booked against the
//    opening balance, so cash and wallets are never touched by the past.
//  - Months are 'paid', 'unpaid' or 'unsure'. 'unsure' counts as not paid until you decide.

import { addAccount, postEntry, reverseEntry, renameAccount, toPiasters } from './ledger.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const OPENING = 'opening';
const STATUSES = ['paid', 'unpaid', 'unsure'];
const pad = (n) => String(n).padStart(2, '0');

export function addMonths(yyyyMm, n) {
  if (!MONTH_RE.test(yyyyMm)) throw new Error('الشهر لازم يكون بالشكل YYYY-MM');
  const [y, m] = yyyyMm.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

function lastDay(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// The date month number `index` (0-based) is due.
export function dueDateOf(j, index) {
  const month = addMonths(j.startMonth, index);
  return `${month}-${pad(Math.min(j.payDay ?? 1, lastDay(month)))}`;
}

function checkIndex(j, index) {
  if (!Number.isInteger(index) || index < 0 || index >= j.totalMonths) {
    throw new Error('الشهر ده مش موجود في الجمعية');
  }
}

function int(value, label, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} لازم يكون من ${min} لـ ${max}`);
  return n;
}

// Works out what the setup answers mean, before anything is saved (used by the summary screen too).
export function previewJamiya({ members, monthly, currentNumber = 1, currentPaid = false, received = 'no', payoutEgp = null, turn = null, thisMonth }) {
  const totalMonths = int(members, 'عدد الأنفار', 2, 120);
  const amount = toPiasters(Number(monthly));
  if (!(amount > 0)) throw new Error('القسط لازم يكون أكبر من صفر');
  const now = int(currentNumber, 'رقم الشهر الحالي', 1, totalMonths);
  if (!MONTH_RE.test(thisMonth)) throw new Error('الشهر الحالي لازم يكون YYYY-MM');
  const payout = payoutEgp === null || payoutEgp === '' ? amount * totalMonths : toPiasters(Number(payoutEgp));
  if (!(payout > 0)) throw new Error('مبلغ القبض لازم يكون أكبر من صفر');
  let myTurn = null;
  if (received === 'no' && turn !== null && turn !== '') {
    myTurn = int(turn, 'دورك', 1, totalMonths);
    if (myTurn < now) throw new Error('لو دورك عدّى يبقى إنت قبضت. اختار «قبضت»');
  }
  const paidBefore = now - 1 + (currentPaid ? 1 : 0);
  const startMonth = addMonths(thisMonth, -(now - 1));
  return {
    totalMonths, amount, payout, myTurn, paidBefore,
    unpaid: totalMonths - paidBefore,
    startMonth,
    endMonth: addMonths(startMonth, totalMonths - 1),
    turnMonth: myTurn ? addMonths(startMonth, myTurn - 1) : null,
    // Positive: yours in the jam'iya. Negative: what you still owe it.
    position: paidBefore * amount - (received === 'before' ? payout : 0),
  };
}

// Builds a jam'iya from the setup questions.
//  members: how many people (= how many months). monthly: what you pay each month (EGP).
//  payDay: the day of the month you pay. currentNumber: which month the jam'iya is in now (1 = just started).
//  currentPaid: whether this month's payment is already made. received: 'before' | 'no'.
//  payoutEgp: what you received (or will receive). turn: your turn number when not received yet.
export function createJamiya(book, {
  id, name, members, monthly, payDay = 1, currentNumber = 1, currentPaid = false,
  received = 'no', payoutEgp = null, turn = null, remindDays = 3, holder = '', phone = '',
  thisMonth, date,
}) {
  if (!id) throw new Error('الجمعية لازم يكون ليها معرّف');
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) throw new Error('اكتب اسم الجمعية');
  const day = int(payDay, 'يوم الدفع', 1, 31);
  const pv = previewJamiya({ members, monthly, currentNumber, currentPaid, received, payoutEgp, turn, thisMonth });
  const { totalMonths, amount, payout, myTurn, paidBefore } = pv;

  const accountId = `jam-${id}`;
  addAccount(book, { id: accountId, name: `جمعية: ${cleanName}`, type: 'asset' });

  const j = {
    id,
    name: cleanName,
    accountId,
    monthly: amount,
    totalMonths,
    startMonth: pv.startMonth,
    payDay: day,
    remindDays: int(remindDays, 'أيام التنبيه', 0, 30),
    payout,
    turn: myTurn,
    holder: String(holder ?? '').trim(),
    phone: String(phone ?? '').replace(/\D/g, ''),
    status: Array.from({ length: totalMonths }, (_, i) => (i < paidBefore ? 'paid' : 'unpaid')),
    how: Object.fromEntries(Array.from({ length: paidBefore }, (_, i) => [i, 'pre'])),
    entries: {},
    received: null,
  };

  // The past, booked against the opening balance in one entry: no cash moves.
  const net = pv.position;
  if (net !== 0) {
    const lines = net > 0
      ? [{ account: accountId, debit: net }, { account: OPENING, credit: net }]
      : [{ account: OPENING, debit: -net }, { account: accountId, credit: -net }];
    postEntry(book, { id: `jam-start-${id}`, date, memo: `وضع الجمعية عند البداية: ${cleanName}`, lines });
  }
  if (received === 'before') j.received = { date, payout, entryId: null, preApp: true };
  return j;
}

export function progress(j) {
  const paid = j.status.filter((s) => s === 'paid').length;
  const unsure = j.status.filter((s) => s === 'unsure').length;
  const unpaid = j.totalMonths - paid - unsure;
  return {
    paid,
    unsure,
    unpaid,
    total: j.totalMonths,
    percent: Math.floor((paid * 100) / j.totalMonths),
    paidAmount: paid * j.monthly,
    remainingAmount: (j.totalMonths - paid) * j.monthly,
  };
}

// The first month that is not paid yet, with its date. null when everything is paid.
export function nextInstallment(j) {
  const index = j.status.findIndex((s) => s !== 'paid');
  return index < 0 ? null : { index, date: dueDateOf(j, index), status: j.status[index] };
}

// Pays one month from any place (cash, wallet or drawer).
export function payMonth(book, j, { index, placeId, date, entryId, note = '' }) {
  checkIndex(j, index);
  if (j.status[index] === 'paid') throw new Error('الشهر ده مدفوع قبل كده');
  if (j.status[index] === 'unsure') throw new Error('حدد الأول: الشهر ده مدفوع ولا لأ؟');
  if (!placeId) throw new Error('اختار هتدفع منين');
  postEntry(book, {
    id: entryId, date, note,
    memo: `قسط جمعية: ${j.name} (شهر ${index + 1})`,
    lines: [
      { account: j.accountId, debit: j.monthly },
      { account: placeId, credit: j.monthly },
    ],
  });
  j.status[index] = 'paid';
  j.how[index] = 'app';
  j.entries[index] = entryId;
}

// Changes a month's state. Months paid from the app are undone with a reversing entry;
// months from before the app are corrected against the opening balance. Cash moves only for app payments.
export function setMonthStatus(book, j, { index, status, date, idPrefix }) {
  checkIndex(j, index);
  if (!STATUSES.includes(status)) throw new Error('الحالة لازم تكون مدفوع أو مش مدفوع أو مش متأكد');
  const current = j.status[index];
  if (current === status) return;
  const prefix = idPrefix ?? `jam-fix-${j.id}-${index}-${book.entries.length}`;

  if (current === 'paid') {
    if (j.how[index] === 'app') {
      reverseEntry(book, j.entries[index], { id: `${prefix}-rev`, date, memo: `عكس قسط جمعية: ${j.name} (شهر ${index + 1})` });
    } else {
      postEntry(book, {
        id: `${prefix}-out`, date, memo: `تصحيح: شهر ${index + 1} مش مدفوع (${j.name})`,
        lines: [{ account: OPENING, debit: j.monthly }, { account: j.accountId, credit: j.monthly }],
      });
    }
    delete j.how[index];
    delete j.entries[index];
  }
  if (status === 'paid') {
    postEntry(book, {
      id: `${prefix}-in`, date, memo: `تصحيح: شهر ${index + 1} اتدفع قبل البرنامج (${j.name})`,
      lines: [{ account: j.accountId, debit: j.monthly }, { account: OPENING, credit: j.monthly }],
    });
    j.how[index] = 'pre';
  }
  j.status[index] = status;
}

// Receiving the payout into a place. Not income.
export function receivePayout(book, j, { placeId, payoutEgp, date, entryId, note = '' }) {
  if (j.received) throw new Error('الجمعية اتقبضت قبل كده');
  if (!placeId) throw new Error('اختار استلمت الفلوس فين');
  const payout = toPiasters(Number(payoutEgp));
  if (payout <= 0) throw new Error('مبلغ القبض لازم يكون أكبر من صفر');
  postEntry(book, {
    id: entryId, date, note, memo: `قبض جمعية: ${j.name}`,
    lines: [{ account: placeId, debit: payout }, { account: j.accountId, credit: payout }],
  });
  j.received = { date, payout, entryId, preApp: false };
}

export function undoReceive(book, j, { id, date }) {
  if (!j.received) throw new Error('الجمعية لسه ما اتقبضتش');
  if (j.received.preApp) {
    postEntry(book, {
      id, date, memo: `تصحيح: الجمعية ما اتقبضتش (${j.name})`,
      lines: [{ account: j.accountId, debit: j.received.payout }, { account: OPENING, credit: j.received.payout }],
    });
  } else {
    reverseEntry(book, j.received.entryId, { id, date, memo: `عكس قبض جمعية: ${j.name}` });
  }
  j.received = null;
}

export function editJamiya(book, j, { name, payDay, remindDays, payoutEgp, turn, holder, phone }) {
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) throw new Error('اكتب اسم الجمعية');
  renameAccount(book, j.accountId, `جمعية: ${cleanName}`);
  j.name = cleanName;
  j.payDay = int(payDay, 'يوم الدفع', 1, 31);
  j.remindDays = int(remindDays, 'أيام التنبيه', 0, 30);
  if (!j.received) {
    const payout = toPiasters(Number(payoutEgp));
    if (!(payout > 0)) throw new Error('مبلغ القبض لازم يكون أكبر من صفر');
    j.payout = payout;
  }
  j.turn = turn === '' || turn === null || turn === undefined ? null : int(turn, 'دورك', 1, j.totalMonths);
  j.holder = String(holder ?? '').trim();
  j.phone = String(phone ?? '').replace(/\D/g, '');
}

// Older saves used other field names; this fills in what is missing.
export function upgradeJamiya(j) {
  const how = j.how ?? {};
  if (!j.how) {
    j.status.forEach((s, i) => {
      if (s === 'paid') how[i] = String(j.entries?.[i] ?? '').startsWith('jam-open') ? 'pre' : 'app';
    });
  }
  return {
    payDay: 1,
    remindDays: 3,
    payout: j.monthly * j.totalMonths,
    turn: null,
    holder: '',
    phone: '',
    entries: {},
    ...j,
    how,
  };
}
