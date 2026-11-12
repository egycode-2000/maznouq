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
import { undoRule, canEdit } from './log.js';
import { showDate, showMonth, formatMoney } from './format.js';

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

// ---------- Spending limits (حد أقصى لوجه الصرف) ----------
// One function decides a category's percentage and level. The question «صرفت في إيه؟», the bar after saving,
// «أوجه الصرف», the category statement and the home circle «عدّى الحد» all read it.
// level: 'none' (no limit), 'ok', 'near' (from the warning percentage, 80 by default), 'over' (past 100).
export function limitStatus(book, d, categoryId, month) {
  const limit = d.budgets?.[categoryId] ?? 0;
  const spent = spentIn(book, categoryId, month);
  if (!(limit > 0)) return { spent, limit: 0, percent: null, level: 'none', over: 0 };
  const percent = Math.floor((spent * 100) / limit);
  const warnAt = d.settings?.limitWarn ?? 80;
  return {
    spent, limit, percent, over: Math.max(0, spent - limit),
    level: spent > limit ? 'over' : (percent >= warnAt ? 'near' : 'ok'),
  };
}

export function limitsReport(book, d, month) {
  const rows = d.categories.map((c) => ({ id: c.id, name: c.name, ...limitStatus(book, d, c.id, month) }));
  return { rows, over: rows.filter((r) => r.level === 'over') };
}

// ---------- Statements: what happened on one category in a month, and on one day ----------
// A move and its undo inside the same period cancel out and disappear together, as if it never happened.
// An undo of an older move shows as its own line («اتلغت حركة يوم ...»). So the lines always add up to
// exactly the totals above (spentIn, periodTotals): the same source, nothing re-computed differently.
function inPeriod(book, from, to) {
  const list = book.entries.filter((e) => e.date >= from && e.date <= to);
  const ids = new Set(list.map((e) => e.id));
  const gone = new Set();
  for (const e of list) {
    if (e.reversalOf && ids.has(e.reversalOf)) gone.add(e.id).add(e.reversalOf);
  }
  return list.filter((e) => !gone.has(e.id));
}

const accName = (book, id) => book.accounts.get(id)?.name ?? id;
const typeOf = (book, id) => book.accounts.get(id)?.type;

function rowOf(book, d, e, amount, title, sub) {
  const original = e.reversalOf ? book.entries.find((x) => x.id === e.reversalOf) : null;
  const edit = d.edits?.[e.id];
  return {
    id: e.id, date: e.date, amount, title, note: e.note ?? '',
    sub: original ? `اتلغت حركة يوم ${showDate(original.date)}` : sub,
    cancelled: Boolean(original),
    editedFrom: edit ? edit.prevAmount : null,
    undo: undoRule(book, e),
    edit: canEdit(e) && undoRule(book, e).can,
  };
}

// Where the money of an entry came from and went to, in plain words.
function sides(book, e) {
  const from = e.lines.filter((l) => l.credit > 0 && ['asset', 'liability'].includes(typeOf(book, l.account))).map((l) => accName(book, l.account));
  const to = e.lines.filter((l) => l.debit > 0 && ['asset', 'liability'].includes(typeOf(book, l.account))).map((l) => accName(book, l.account));
  return { from: from.join('، '), to: to.join('، ') };
}

export function categoryStatement(book, d, categoryId, month) {
  const rows = inPeriod(book, `${month}-01`, `${month}-31`)
    .filter((e) => e.lines.some((l) => l.account === categoryId))
    .map((e, order) => {
      const amount = e.lines.filter((l) => l.account === categoryId).reduce((s, l) => s + l.debit - l.credit, 0);
      const { from } = sides(book, e);
      return { ...rowOf(book, d, e, amount, accName(book, categoryId), from ? `من ${from}` : ''), order };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  return { rows, total: spentIn(book, categoryId, month), limit: limitStatus(book, d, categoryId, month) };
}

// The last months of one category, oldest first, for the small chart.
export function categoryMonths(book, d, categoryId, month, count = 6) {
  const list = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const m = addMonths(month, -i);
    list.push({ month: m, spent: spentIn(book, categoryId, m) });
  }
  return { list, limit: d.budgets?.[categoryId] ?? 0 };
}

// مراجعة النهارده: every move of one day, in three groups, each line on its own.
export function dayReport(book, d, day) {
  const income = [];
  const expense = [];
  const other = [];
  inPeriod(book, day, day).forEach((e, order) => {
    const { from, to } = sides(book, e);
    const inc = e.lines.filter((l) => typeOf(book, l.account) === 'income');
    const exp = e.lines.filter((l) => typeOf(book, l.account) === 'expense');
    if (inc.length) {
      const amount = inc.reduce((s, l) => s + l.credit - l.debit, 0);
      income.push({ ...rowOf(book, d, e, amount, inc.map((l) => accName(book, l.account)).join('، '), to ? `نزل في ${to}` : ''), order });
    }
    if (exp.length) {
      const amount = exp.reduce((s, l) => s + l.debit - l.credit, 0);
      expense.push({ ...rowOf(book, d, e, amount, exp.map((l) => accName(book, l.account)).join('، '), from ? `من ${from}` : ''), order });
    }
    if (!inc.length && !exp.length) {
      const amount = e.lines.reduce((s, l) => s + l.debit, 0);
      other.push({ ...rowOf(book, d, e, amount, e.memo, [from && `من ${from}`, to && `إلى ${to}`].filter(Boolean).join(' ← ')), order });
    }
  });
  const newest = (a, b) => b.order - a.order;
  const totals = periodTotals(book, day, day);
  return {
    income: income.sort(newest), expense: expense.sort(newest), other: other.sort(newest),
    totals, count: income.length + expense.length + other.length,
  };
}

// The category statement as a message (WhatsApp): the same lines and the same total as the screen.
export function categoryStatementText(book, d, categoryId, month) {
  const st = categoryStatement(book, d, categoryId, month);
  const name = accName(book, categoryId);
  const lines = [...st.rows].reverse().map((r) => (r.amount < 0
    ? `${showDate(r.date)}: تم تنزيل ${formatMoney(-r.amount)} (${r.sub})`
    : `${showDate(r.date)}: ${formatMoney(r.amount)}${r.sub ? ` ${r.sub}` : ''}${r.note ? ` · ${r.note}` : ''}`));
  const lim = st.limit;
  return [
    `كشف ${name} · ${showMonth(month)}`,
    ...lines,
    `الإجمالي: ${formatMoney(st.total)}`,
    lim.limit ? `الحد: ${formatMoney(lim.limit)} (${lim.percent}%)` : '',
  ].filter(Boolean).join('\n');
}
