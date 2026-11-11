// Every number the screens show is computed here (or in places.js / people.js), never inside a screen.
// One function per number, so the home screen, the lists, the statements, the reports and the
// WhatsApp messages always agree.
import { balanceOf, periodTotals } from './ledger.js';
import { dueItems } from './bills.js';
import { remainingOf, scheduleStatus } from './debts.js';
import { addMonths, dueDateOf } from './obligations.js';
import { moneyPicture } from './places.js';
import { peopleTotals } from './people.js';
import { pendingDays, dailyTotal } from './daily.js';
import { leftOf } from './borrows.js';

const monthStart = (month) => `${month}-01`;
const monthEnd = (month) => `${month}-31`;

export function monthTotals(book, month) {
  return periodTotals(book, monthStart(month), monthEnd(month));
}

// Net flow on one account during a month: spending on a category, or income from a source.
function flow(book, accountId, month, sign) {
  let total = 0;
  for (const e of book.entries) {
    if (e.date < monthStart(month) || e.date > monthEnd(month)) continue;
    for (const l of e.lines) if (l.account === accountId) total += sign * (l.debit - l.credit);
  }
  return total;
}

export const spentIn = (book, categoryId, month) => flow(book, categoryId, month, 1);
export const incomeFrom = (book, sourceId, month) => flow(book, sourceId, month, -1);

export function debtPocket(d, debtId) {
  return (d.goals ?? []).find((g) => g.kind === 'debt' && g.debtId === debtId && !g.archived) ?? null;
}

export function debtReserve(book, d, debtId) {
  const pocket = debtPocket(d, debtId);
  return pocket ? balanceOf(book, pocket.accountId) : 0;
}

// Share of a fixed debt already paid, 0 to 100.
export function debtPaidPercent(book, debt) {
  return Math.floor(((debt.total - remainingOf(book, debt)) * 100) / debt.total);
}

// Jam'iya months not paid yet whose due month is this month or earlier.
function jamiyaDue(j, month) {
  const rows = [];
  j.status.forEach((s, i) => {
    if (s === 'unpaid' && addMonths(j.startMonth, i) <= month) rows.push({ index: i, date: dueDateOf(j, i) });
  });
  return rows;
}

// What still has to go out by the end of this month: bills, jam'iya months and debts you owe.
// Money already set aside in a debt's drawer covers that debt's installments.
export function remainingThisMonth(book, d, month) {
  const bills = dueItems(d.bills, month).reduce((s, i) => s + i.amount, 0);
  const jamiya = d.jamiyas.reduce((s, j) => s + jamiyaDue(j, month).length * j.monthly, 0);
  const debtsOut = d.debts
    .filter((x) => x.direction === 'out')
    .reduce((s, x) => {
      const rows = scheduleStatus(book, x, monthEnd(month));
      const due = rows.filter((r) => !r.paid && r.dueDate <= monthEnd(month)).reduce((t, r) => t + r.amount, 0);
      const partPaid = x.total - remainingOf(book, x) - rows.filter((r) => r.paid).reduce((t, r) => t + r.amount, 0);
      return s + Math.max(0, due - partPaid - debtReserve(book, d, x.id));
    }, 0);
  return { bills, jamiya, debtsOut, total: bills + jamiya + debtsOut };
}

function dayPlus(isoDate, days) {
  const [y, m, dd] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + days));
  const pad = (x) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// Things that need attention soon: overdue, or due within their reminder window.
// Bills and debts: 7 days. Each jam'iya: its own number of days (3 unless changed).
export function dueSoon(book, d, today, days = 7) {
  const limit = dayPlus(today, days);
  const thisMonth = today.slice(0, 7);
  const items = [];
  const seen = new Set();
  for (const month of [thisMonth, addMonths(thisMonth, 1)]) {
    for (const i of dueItems(d.bills, month)) {
      const key = `${i.bill.id}:${i.period}`;
      if (seen.has(key) || !i.dueDate || i.dueDate > limit) continue;
      seen.add(key);
      items.push({
        label: `التزام: ${i.bill.name}`, date: i.dueDate, amount: i.amount, overdue: i.dueDate < today,
        go: 'bill', params: { id: i.bill.id, month: i.period },
      });
    }
  }
  for (const j of d.jamiyas) {
    const jLimit = dayPlus(today, j.remindDays ?? 3);
    j.status.forEach((s, i) => {
      if (s !== 'unpaid') return;
      const date = dueDateOf(j, i);
      if (date > jLimit) return;
      items.push({
        label: `قسط جمعية: ${j.name} (شهر ${i + 1})`, date, amount: j.monthly, overdue: date < today,
        go: 'jam', params: { id: j.id, month: i },
      });
    });
  }
  for (const x of d.debts) {
    for (const r of scheduleStatus(book, x, today)) {
      if (r.paid || r.dueDate > limit) continue;
      items.push({
        label: x.direction === 'in' ? `قسط ليك عند ${x.person}` : `قسط عليك لـ ${x.person}`,
        date: r.dueDate, amount: r.amount, overdue: r.overdue, go: 'debt', params: { id: x.id },
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function openBorrows(d) {
  return d.borrows.filter((b) => leftOf(b) > 0);
}

// Everything the home screen shows, from the functions above.
export function homeSummary(book, d, today) {
  const month = today.slice(0, 7);
  const picture = moneyPicture(d, book);
  const remaining = remainingThisMonth(book, d, month);
  const people = peopleTotals(book, d);
  const daily = d.templates
    .filter((t) => t.daily && t.active)
    .map((t) => ({ template: t, days: pendingDays(t, today), perDay: dailyTotal(t) }))
    .filter((x) => x.days > 0);
  const borrows = openBorrows(d);
  return {
    picture,
    remaining,
    afterDues: picture.total - remaining.total,
    people,
    month: monthTotals(book, month),
    soon: dueSoon(book, d, today),
    daily,
    borrowsTotal: borrows.reduce((s, b) => s + leftOf(b), 0),
    borrowsCount: borrows.length,
  };
}

// A fixed debt from start to now: every step with what was left after it.
export function debtReport(book, d, debt) {
  const pocket = d.goals.find((g) => g.kind === 'debt' && g.debtId === debt.id) ?? null;
  const steps = [];
  let left = 0;
  let reserved = 0;
  for (const e of book.entries) {
    const onDebt = e.lines.find((l) => l.account === debt.accountId);
    const onPocket = pocket ? e.lines.find((l) => l.account === pocket.accountId) : null;
    if (!onDebt && !onPocket) continue;
    let what = e.memo;
    let amount = 0;
    if (onDebt) {
      const change = debt.direction === 'in' ? onDebt.debit - onDebt.credit : onDebt.credit - onDebt.debit;
      left += change;
      amount = Math.abs(change);
      if (change > 0) what = left === change ? 'بداية الدين' : 'زيادة على الدين';
      else if (onPocket) what = 'سلّمت من المحجوز';
      else what = debt.direction === 'in' ? 'استلمت منه' : 'دفعت له';
    }
    if (onPocket) {
      const change = onPocket.debit - onPocket.credit;
      reserved += change;
      if (!onDebt) {
        amount = Math.abs(change);
        what = change > 0 ? 'حجزت للدين' : 'سحبت من المحجوز';
      }
    }
    if (e.reversalOf) what = `عكس: ${what}`;
    steps.push({ id: e.id, date: e.date, what, amount, left, reserved, note: e.note ?? '' });
  }
  const remaining = remainingOf(book, debt);
  return {
    total: debt.total,
    paid: debt.total - remaining,
    reserved: pocket ? balanceOf(book, pocket.accountId) : 0,
    remaining,
    steps,
  };
}

export function debtsReport(book, d) {
  const rows = d.debts.map((x) => ({ debt: x, ...debtReport(book, d, x) }));
  const totals = (dir) => ['total', 'paid', 'reserved', 'remaining'].reduce((t, k) => ({
    ...t, [k]: rows.filter((r) => r.debt.direction === dir).reduce((s, r) => s + r[k], 0),
  }), {});
  return { rows, out: totals('out'), in: totals('in') };
}
