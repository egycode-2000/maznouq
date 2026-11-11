// Debts both ways. direction 'in' = someone owes me (receivable, asset).
// direction 'out' = I owe someone (payable, liability).
// Repayments are cash movements, never income or expense.
import { addAccount, postEntry, balanceOf, toPiasters } from './ledger.js';
import { formatMoney, showDate } from './format.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPENING = 'opening';

// Adds months to a YYYY-MM-DD date and keeps the day (clamped to the month's last day).
export function addMonthsToDate(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const pad = (x) => String(x).padStart(2, '0');
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(day)}`;
}

// Equal monthly installments in piasters. The last one absorbs the rounding.
export function planMonthly({ totalEgp, count, firstDate }) {
  const total = toPiasters(Number(totalEgp));
  const n = Number(count);
  if (total <= 0) throw new Error('إجمالي الدين لازم يكون أكبر من صفر');
  if (!Number.isInteger(n) || n < 1 || n > 120) throw new Error('عدد الأقساط لازم يكون من 1 لـ 120');
  if (!DATE_RE.test(firstDate)) throw new Error('تاريخ أول قسط لازم يكون YYYY-MM-DD');
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => ({
    dueDate: addMonthsToDate(firstDate, i),
    amount: i === n - 1 ? total - base * (n - 1) : base,
  }));
}

export function createDebt(book, {
  id, person, phone = '', direction, totalEgp, installments = [], startDate, moveNow, walletId, placeId, note = '',
}) {
  const place = placeId ?? walletId;
  if (!id) throw new Error('الدين لازم يكون ليه معرّف');
  const name = String(person ?? '').trim();
  if (name.length < 2) throw new Error('اكتب اسم الشخص');
  if (!['in', 'out'].includes(direction)) throw new Error('اختار: عليه لي ولا عليا له');
  if (!DATE_RE.test(startDate)) throw new Error('التاريخ لازم يكون YYYY-MM-DD');
  const total = toPiasters(Number(totalEgp));
  if (total <= 0) throw new Error('المبلغ لازم يكون أكبر من صفر');
  const sum = installments.reduce((s, i) => s + i.amount, 0);
  if (installments.length && sum !== total) {
    throw new Error('مجموع الأقساط لازم يساوي إجمالي الدين بالظبط');
  }
  if (moveNow && !place) throw new Error('اختار المكان اللي الفلوس خرجت منه أو دخلت فيه');

  const accountId = `debt-${id}`;
  addAccount(book, {
    id: accountId,
    name: `دين: ${name}`,
    type: direction === 'in' ? 'asset' : 'liability',
  });

  // Money moved now goes through the wallet. Money from before the app is booked to opening equity.
  const other = moveNow ? place : OPENING;
  const lines = direction === 'in'
    ? [{ account: accountId, debit: total }, { account: other, credit: total }]
    : [{ account: other, debit: total }, { account: accountId, credit: total }];
  postEntry(book, { id: `debt-open-${id}`, date: startDate, memo: `دين: ${name}`, note, lines });

  return {
    id,
    person: name,
    phone: String(phone ?? '').replace(/\D/g, ''),
    direction,
    accountId,
    total,
    startDate,
    installments: installments.map((x, i) => ({ id: `i${i}`, dueDate: x.dueDate, amount: x.amount })),
  };
}

export function addInstallment(debt, { dueDate, amountEgp }) {
  if (!DATE_RE.test(dueDate)) throw new Error('تاريخ القسط لازم يكون YYYY-MM-DD');
  const amount = toPiasters(Number(amountEgp));
  if (amount <= 0) throw new Error('مبلغ القسط لازم يكون أكبر من صفر');
  const sum = debt.installments.reduce((s, i) => s + i.amount, 0);
  if (sum + amount > debt.total) throw new Error('مجموع الأقساط أكبر من إجمالي الدين');
  debt.installments.push({ id: `i${debt.installments.length}`, dueDate, amount });
  debt.installments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function remainingOf(book, debt) {
  return balanceOf(book, debt.accountId);
}

// Any payment reduces the debt. It is applied to installments in order.
export function payDebt(book, debt, { amountEgp, walletId, placeId, date, entryId, note = '', memo = null }) {
  const place = placeId ?? walletId;
  const remaining = remainingOf(book, debt);
  if (remaining <= 0) throw new Error('الدين ده خلص');
  const amount = toPiasters(Number(amountEgp));
  if (amount <= 0) throw new Error('المبلغ لازم يكون أكبر من صفر');
  if (amount > remaining) throw new Error(`المبلغ أكبر من الباقي (${formatMoney(remaining)})`);
  if (!place) throw new Error('اختار المكان');
  const lines = debt.direction === 'in'
    ? [{ account: place, debit: amount }, { account: debt.accountId, credit: amount }]
    : [{ account: debt.accountId, debit: amount }, { account: place, credit: amount }];
  postEntry(book, {
    id: entryId, date, note, lines,
    memo: memo ?? (debt.direction === 'in' ? `استلمت من ${debt.person}` : `دفعت لـ ${debt.person}`),
  });
}

// Each installment is paid once the cumulative payments reach its cumulative amount.
export function scheduleStatus(book, debt, today) {
  const paidSoFar = debt.total - remainingOf(book, debt);
  let cumulative = 0;
  return debt.installments.map((it) => {
    cumulative += it.amount;
    const paid = paidSoFar >= cumulative;
    return { ...it, paid, overdue: !paid && it.dueDate < today };
  });
}

// Statement rows with running balance. Payments are written as «تم تنزيل X».
export function statementRows(book, debt) {
  const rows = [];
  let running = 0;
  for (const entry of book.entries) {
    for (const line of entry.lines) {
      if (line.account !== debt.accountId) continue;
      // delta = change in what is still owed, from the point of view of the debt's direction.
      const net = line.debit - line.credit;
      const delta = debt.direction === 'in' ? net : -net;
      running += delta;
      rows.push({ date: entry.date, memo: entry.memo, delta, balance: running });
    }
  }
  return rows;
}

// Wording used in statements and messages: متبقى عليه / له عندنا / خالص.
export function balanceWording(debt, remaining) {
  if (remaining <= 0) return 'خالص';
  return debt.direction === 'in' ? `متبقى عليه ${formatMoney(remaining)}` : `له عندنا ${formatMoney(remaining)}`;
}

export function statementText(book, debt) {
  const remaining = remainingOf(book, debt);
  const lines = [`كشف حساب: ${debt.person}`, ''];
  for (const row of statementRows(book, debt)) {
    const sign = row.delta < 0 ? `تم تنزيل ${formatMoney(-row.delta)}` : `زاد ${formatMoney(row.delta)}`;
    lines.push(`${showDate(row.date)}: ${sign}`);
  }
  lines.push('', balanceWording(debt, remaining));
  return lines.join('\n');
}

export function whatsappLink(phone, text) {
  let p = String(phone ?? '').replace(/\D/g, '');
  if (p.startsWith('0')) p = `20${p.slice(1)}`;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

function dayNumber(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(isoDate, n) {
  const dt = new Date((dayNumber(isoDate) + n) * 86400000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// Equal installments every N days (e.g. 1,000 every 20 days). The last one absorbs the rounding.
export function planEvery({ totalEgp, count, everyDays, firstDate }) {
  const total = toPiasters(Number(totalEgp));
  const n = Number(count);
  const step = Number(everyDays);
  if (total <= 0) throw new Error('إجمالي الدين لازم يكون أكبر من صفر');
  if (!Number.isInteger(n) || n < 1 || n > 120) throw new Error('عدد الأقساط لازم يكون من 1 لـ 120');
  if (!Number.isInteger(step) || step < 1 || step > 365) throw new Error('عدد الأيام بين الأقساط لازم يكون من 1 لـ 365');
  if (!DATE_RE.test(firstDate)) throw new Error('تاريخ أول قسط لازم يكون YYYY-MM-DD');
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => ({
    dueDate: addDays(firstDate, i * step),
    amount: i === n - 1 ? total - base * (n - 1) : base,
  }));
}

// How much should be set aside for the next installment by today.
// The period runs from the previous installment (or the debt's start) to the next due date.
export function reservePlan(book, debt, reserved, today) {
  const paidSoFar = debt.total - remainingOf(book, debt);
  let cumulative = 0;
  let previous = debt.startDate;
  for (const it of debt.installments) {
    cumulative += it.amount;
    if (paidSoFar < cumulative) {
      const need = cumulative - paidSoFar;
      const days = Math.max(1, dayNumber(it.dueDate) - dayNumber(previous));
      const elapsed = Math.min(days, Math.max(0, dayNumber(today) - dayNumber(previous)));
      const expected = Math.min(need, Math.round((need * elapsed) / days));
      return {
        dueDate: it.dueDate,
        need,
        perDay: Math.ceil(need / days),
        expected,
        reserved,
        gap: Math.max(0, expected - reserved),
        daysLeft: dayNumber(it.dueDate) - dayNumber(today),
      };
    }
    previous = it.dueDate;
  }
  return null;
}
