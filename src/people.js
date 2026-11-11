// الحسابات: every person you have money with, in one place.
// Two kinds share one sign rule, so every screen shows the same number:
//   positive = متبقى عليه (he owes you), negative = له عندنا (you owe him), zero = خالص.
//  - حساب جاري (running): give and take back and forth. Asset account; its balance can go below zero.
//  - دين ثابت (fixed debt): a known amount with installments (see debts.js).
// A jam'iya joins the same totals: money you put in before receiving is yours, after receiving you owe it.
import { addAccount, postEntry, balanceOf, toPiasters } from './ledger.js';
import { formatMoney, showDate } from './format.js';
import { remainingOf } from './debts.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function createRunning(book, { id, person, phone = '', openingEgp = 0, openingSide = 'none', date }) {
  const name = String(person ?? '').trim();
  if (name.length < 2) throw new Error('اكتب اسم الشخص');
  if (!DATE_RE.test(date)) throw new Error('التاريخ لازم يكون YYYY-MM-DD');
  const accountId = `acc-${id}`;
  addAccount(book, { id: accountId, name: `حساب: ${name}`, type: 'asset' });
  const opening = Number(openingEgp) > 0 ? toPiasters(Number(openingEgp)) : 0;
  if (opening > 0 && openingSide !== 'none') {
    // The balance from before the app is booked against the opening, so no cash moves.
    const lines = openingSide === 'him'
      ? [{ account: accountId, debit: opening }, { account: 'opening', credit: opening }]
      : [{ account: 'opening', debit: opening }, { account: accountId, credit: opening }];
    postEntry(book, { id: `acc-open-${id}`, date, memo: `رصيد سابق: ${name}`, lines });
  }
  return { id, person: name, phone: String(phone ?? '').replace(/\D/g, ''), accountId, kind: 'running' };
}

// gave: you handed him money (he owes you more). took: he handed you money.
export function moveRunning(book, acc, { side, placeId, amountEgp, date, note = '', entryId }) {
  const amount = toPiasters(Number(amountEgp));
  if (amount <= 0) throw new Error('المبلغ لازم يكون أكبر من صفر');
  if (!placeId) throw new Error('اختار المكان اللي الفلوس خرجت منه أو دخلت فيه');
  const lines = side === 'gave'
    ? [{ account: acc.accountId, debit: amount }, { account: placeId, credit: amount }]
    : [{ account: placeId, debit: amount }, { account: acc.accountId, credit: amount }];
  postEntry(book, {
    id: entryId, date, note, lines,
    memo: side === 'gave' ? `اديت ${acc.person}` : `خدت من ${acc.person}`,
  });
}

// A jam'iya's position: positive = ليك في الجمعية, negative = عليك للجمعية.
export const jamPosition = (book, j) => balanceOf(book, j.accountId);

// The signed balance for any person entry: running account or fixed debt.
export function personBalance(book, p) {
  if (p.kind === 'running') return balanceOf(book, p.accountId);
  const left = remainingOf(book, p);
  return p.direction === 'in' ? left : -left;
}

export function wording(balance) {
  if (balance > 0) return `متبقى عليه ${formatMoney(balance)}`;
  if (balance < 0) return `له عندنا ${formatMoney(-balance)}`;
  return 'خالص';
}

// Statement lines of a running account, oldest first, with the balance after each line.
export function runningStatement(book, acc) {
  const rows = [];
  let balance = 0;
  for (const e of book.entries) {
    for (const l of e.lines) {
      if (l.account !== acc.accountId) continue;
      const delta = l.debit - l.credit;
      balance += delta;
      rows.push({ id: e.id, date: e.date, memo: e.memo, note: e.note ?? '', delta, balance });
    }
  }
  return rows;
}

export function runningStatementText(book, acc) {
  const lines = [`كشف حساب: ${acc.person}`, ''];
  for (const r of runningStatement(book, acc)) {
    const what = r.delta > 0 ? `اديتك ${formatMoney(r.delta)}` : `خدت منك ${formatMoney(-r.delta)}`;
    lines.push(`${showDate(r.date)}: ${what}${r.note ? ` (${r.note})` : ''} ← ${wording(r.balance)}`);
  }
  lines.push('', `الرصيد: ${wording(balanceOf(book, acc.accountId))}`);
  return lines.join('\n');
}

// Everyone in one list, with jam'iyas, sorted by size. Archived people are hidden by the caller.
export function peopleList(book, d) {
  const rows = [
    ...d.people.map((p) => ({ kind: 'running', id: p.id, name: p.person, balance: personBalance(book, p), ref: p })),
    ...d.debts.map((p) => ({ kind: 'debt', id: p.id, name: p.person, balance: personBalance(book, p), ref: p })),
    ...d.jamiyas.map((j) => ({ kind: 'jamiya', id: j.id, name: `جمعية: ${j.name}`, balance: jamPosition(book, j), ref: j })),
  ];
  return rows.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

// The two totals used on the home screen and the accounts screen.
export function peopleTotals(book, d) {
  const list = peopleList(book, d);
  return {
    owedToMe: list.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0),
    iOwe: list.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0),
  };
}
