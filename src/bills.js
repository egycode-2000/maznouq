// الالتزامات: money you pay out on a schedule. Paying one is an expense.
// Kinds:
//  monthly  (ثابت كل شهر): rent and the like, with increases from a chosen month.
//  variable (فاتورة متغيرة): electricity, water, gas. A due day each month; the amount is written when paid.
//  periodic (كل كام شهر): car licence, insurance, school fees. Every N months.
//  dated    (مرة واحدة بتاريخ) and open (من غير موعد).
// Monthly, variable and periodic bills can be paid for any month: a past month or a month ahead.
import { addAccount, postEntry, reverseEntry, renameAccount, toPiasters } from './ledger.js';

export const BILL_KINDS = ['monthly', 'variable', 'periodic', 'dated', 'open'];
export const MONTHLY_KINDS = ['monthly', 'variable', 'periodic'];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

const monthIndex = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

export function billAmountFor(bill, month) {
  let amount = bill.amount;
  const sorted = [...(bill.increases ?? [])].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  for (const inc of sorted) if (inc.fromMonth <= month) amount = inc.amount;
  return amount;
}

// Whether a bill is due in a given month (for the kinds that repeat).
export function isDueMonth(bill, month) {
  if (!MONTHLY_KINDS.includes(bill.kind) || bill.startMonth > month) return false;
  if (bill.kind !== 'periodic') return true;
  return (monthIndex(month) - monthIndex(bill.startMonth)) % bill.everyMonths === 0;
}

function dayIn(bill, month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${pad(Math.min(bill.dueDay, last))}`;
}

function checkDay(dueDay) {
  const day = Number(dueDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('يوم الاستحقاق لازم يكون من 1 لـ 31');
  return day;
}

export function createBill(book, { id, name, kind, amountEgp, dueDay, startMonth, dueDate, everyMonths }) {
  if (!id) throw new Error('الالتزام لازم يكون ليه معرّف');
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) throw new Error('اكتب اسم الالتزام');
  if (!BILL_KINDS.includes(kind)) throw new Error('نوع الالتزام غير معروف');
  const amount = toPiasters(Number(amountEgp));
  if (amount <= 0) {
    throw new Error(kind === 'variable' ? 'اكتب مبلغ تقريبي عشان يتحسب في اللي عليك' : 'المبلغ لازم يكون أكبر من صفر');
  }

  const bill = { id, name: cleanName, kind, amount, accountId: `bill-${id}`, increases: [], paid: {} };
  if (MONTHLY_KINDS.includes(kind)) {
    bill.dueDay = checkDay(dueDay);
    if (!MONTH_RE.test(startMonth)) throw new Error('أول شهر لازم يكون YYYY-MM');
    bill.startMonth = startMonth;
  }
  if (kind === 'periodic') {
    const n = Number(everyMonths);
    if (!Number.isInteger(n) || n < 2 || n > 60) throw new Error('كل كام شهر؟ اكتب رقم من 2 لـ 60');
    bill.everyMonths = n;
  }
  if (kind === 'dated') {
    if (!DATE_RE.test(dueDate)) throw new Error('تاريخ الاستحقاق لازم يكون YYYY-MM-DD');
    bill.dueDate = dueDate;
  }
  addAccount(book, { id: bill.accountId, name: cleanName, type: 'expense' });
  return bill;
}

// Rent-style increase: the new amount applies from fromMonth onward.
export function addIncrease(bill, { fromMonth, amountEgp }) {
  if (bill.kind !== 'monthly') throw new Error('الزيادة بتتسجل للالتزام الثابت كل شهر بس');
  if (!MONTH_RE.test(fromMonth)) throw new Error('شهر الزيادة لازم يكون YYYY-MM');
  if (fromMonth < bill.startMonth) throw new Error('الزيادة لازم تبدأ من أول شهر أو بعده');
  const amount = toPiasters(Number(amountEgp));
  if (amount <= 0) throw new Error('المبلغ الجديد لازم يكون أكبر من صفر');
  if (bill.increases.some((i) => i.fromMonth === fromMonth)) throw new Error('فيه زيادة مسجلة للشهر ده قبل كده');
  bill.increases.push({ fromMonth, amount });
  bill.increases.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
}

// Unpaid items counted in a month. Repeating kinds: that month only. Dated: from its month on. Open: always.
export function dueItems(bills, month) {
  const items = [];
  for (const b of bills) {
    if (MONTHLY_KINDS.includes(b.kind)) {
      if (!isDueMonth(b, month) || b.paid[month]) continue;
      items.push({ bill: b, period: month, amount: billAmountFor(b, month), dueDate: dayIn(b, month) });
    } else if (b.kind === 'dated') {
      if (b.paid.once || b.dueDate.slice(0, 7) > month) continue;
      items.push({ bill: b, period: 'once', amount: b.amount, dueDate: b.dueDate });
    } else if (!b.paid.once) {
      items.push({ bill: b, period: 'once', amount: b.amount, dueDate: null });
    }
  }
  return items;
}

// The next period to pay for a repeating bill, starting at `month`.
export function nextDuePeriod(bill, month) {
  for (let i = 0; i < 61; i += 1) {
    const m = monthAdd(month, i);
    if (isDueMonth(bill, m) && !bill.paid[m]) return m;
  }
  return null;
}

function monthAdd(month, n) {
  const t = monthIndex(month) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

// amountEgp is needed for variable bills and optional for the others (a different amount this time).
export function payBill(book, bill, { period, placeId: place, walletId, date, entryId, amountEgp = null, note = '' }) {
  const placeId = place ?? walletId;
  if (!placeId) throw new Error('اختار هتدفع منين');
  if (MONTHLY_KINDS.includes(bill.kind)) {
    if (!MONTH_RE.test(period)) throw new Error('اختار الشهر اللي بتدفعه');
    if (!isDueMonth(bill, period)) throw new Error('الشهر ده مش من شهور الالتزام');
  } else if (period !== 'once') {
    throw new Error('الدفع ده مش للالتزام ده');
  }
  if (bill.paid[period]) throw new Error('الشهر ده اتدفع قبل كده');
  const typed = amountEgp === null || amountEgp === '' ? null : toPiasters(Number(amountEgp));
  if (bill.kind === 'variable' && !typed) throw new Error('اكتب مبلغ الفاتورة');
  const amount = typed || (MONTHLY_KINDS.includes(bill.kind) ? billAmountFor(bill, period) : bill.amount);
  if (amount <= 0) throw new Error('المبلغ لازم يكون أكبر من صفر');
  const label = period === 'once' ? '' : ` (${period})`;
  postEntry(book, {
    id: entryId, date, note, memo: `التزام: ${bill.name}${label}`,
    lines: [{ account: bill.accountId, debit: amount }, { account: placeId, credit: amount }],
  });
  bill.paid[period] = { entryId, date, amount };
}

// Undo a payment with a reversing entry. The original entry stays in the book.
export function undoBill(book, bill, period, { id, date }) {
  const rec = bill.paid[period];
  if (!rec) throw new Error('مفيش دفع للشهر ده يتعكس');
  reverseEntry(book, rec.entryId, { id, date, memo: `عكس دفع: ${bill.name}` });
  delete bill.paid[period];
}

// Edits the bill's details. Past payments keep the amounts they were paid with.
export function editBill(book, bill, { name, amountEgp, dueDay, dueDate, everyMonths }) {
  const cleanName = renameAccount(book, bill.accountId, name);
  const amount = toPiasters(Number(amountEgp));
  if (amount <= 0) throw new Error('المبلغ لازم يكون أكبر من صفر');
  if (MONTHLY_KINDS.includes(bill.kind)) bill.dueDay = checkDay(dueDay);
  if (bill.kind === 'periodic') {
    const n = Number(everyMonths);
    if (!Number.isInteger(n) || n < 2 || n > 60) throw new Error('كل كام شهر؟ اكتب رقم من 2 لـ 60');
    bill.everyMonths = n;
  }
  if (bill.kind === 'dated') {
    if (!DATE_RE.test(dueDate)) throw new Error('تاريخ الاستحقاق لازم يكون YYYY-MM-DD');
    bill.dueDate = dueDate;
  }
  bill.name = cleanName;
  bill.amount = amount;
}
