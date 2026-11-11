// Double-entry ledger for ماليتي.
// Rules:
//  - Money is stored as integer piasters (1 EGP = 100 piasters). No floats are stored.
//  - Every entry has lines whose debits equal credits.
//  - Posted entries are frozen. Corrections are made with a reversing entry, never by editing.
//  - Balances are never stored; they are computed from the lines.

export const ACCOUNT_TYPES = ['asset', 'liability', 'income', 'expense', 'equity'];

// Normal side: assets and expenses grow on debit; liabilities, income and equity grow on credit.
const DEBIT_NORMAL = new Set(['asset', 'expense']);

export function toPiasters(egp) {
  if (typeof egp !== 'number' || !Number.isFinite(egp)) {
    throw new TypeError('amount must be a finite number');
  }
  return Math.round(egp * 100);
}

export function createBook() {
  return { accounts: new Map(), entries: [] };
}

export function addAccount(book, { id, name, type }) {
  if (!id || !name) throw new Error('account needs id and name');
  if (!ACCOUNT_TYPES.includes(type)) throw new Error(`unknown account type: ${type}`);
  if (book.accounts.has(id)) throw new Error(`account already exists: ${id}`);
  const account = Object.freeze({ id, name, type });
  book.accounts.set(id, account);
  return account;
}

function validateLines(book, lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('an entry needs at least two lines');
  }
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    if (!book.accounts.has(line.account)) throw new Error(`unknown account: ${line.account}`);
    const { debit = 0, credit = 0 } = line;
    if (!Number.isInteger(debit) || !Number.isInteger(credit)) {
      throw new Error('amounts must be integer piasters');
    }
    if (debit < 0 || credit < 0) throw new Error('amounts cannot be negative');
    if ((debit > 0) === (credit > 0)) {
      throw new Error('each line needs exactly one of debit or credit');
    }
    debitTotal += debit;
    creditTotal += credit;
  }
  if (debitTotal !== creditTotal) {
    throw new Error(`entry does not balance: debit ${debitTotal} vs credit ${creditTotal}`);
  }
}

export function postEntry(book, { id, date, memo = '', note = '', lines }) {
  if (!id || !date) throw new Error('entry needs id and date (YYYY-MM-DD)');
  if (book.entries.some((e) => e.id === id)) throw new Error(`entry already exists: ${id}`);
  validateLines(book, lines);
  const entry = Object.freeze({
    id,
    date,
    memo,
    note: String(note ?? '').trim(),
    lines: Object.freeze(lines.map((l) => Object.freeze({
      account: l.account,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
    }))),
    reversalOf: null,
  });
  book.entries.push(entry);
  return entry;
}

export function reverseEntry(book, entryId, { id, date, memo, note = '' }) {
  const original = book.entries.find((e) => e.id === entryId);
  if (!original) throw new Error(`no entry to reverse: ${entryId}`);
  if (original.reversalOf) throw new Error('cannot reverse a reversal');
  if (isReversed(book, entryId)) throw new Error('الحركة دي اتعكست قبل كده');
  const entry = postEntry(book, {
    id,
    date,
    memo: memo ?? `عكس: ${original.memo}`,
    note,
    lines: original.lines.map((l) => ({
      account: l.account,
      debit: l.credit,
      credit: l.debit,
    })),
  });
  const reversed = Object.freeze({ ...entry, reversalOf: entryId });
  book.entries[book.entries.length - 1] = reversed;
  return reversed;
}

// Balance of one account, as a positive number in its normal direction.
// asOf is optional; when given, only entries dated on or before it count (YYYY-MM-DD).
export function balanceOf(book, accountId, asOf = null) {
  const account = book.accounts.get(accountId);
  if (!account) throw new Error(`unknown account: ${accountId}`);
  let debit = 0;
  let credit = 0;
  for (const entry of book.entries) {
    if (asOf !== null && entry.date > asOf) continue;
    for (const line of entry.lines) {
      if (line.account !== accountId) continue;
      debit += line.debit;
      credit += line.credit;
    }
  }
  return DEBIT_NORMAL.has(account.type) ? debit - credit : credit - debit;
}

// Income and expenses for a period, used for the monthly surplus or deficit.
export function periodTotals(book, fromDate, toDate) {
  let income = 0;
  let expense = 0;
  for (const entry of book.entries) {
    if (entry.date < fromDate || entry.date > toDate) continue;
    for (const line of entry.lines) {
      const account = book.accounts.get(line.account);
      if (account.type === 'income') income += line.credit - line.debit;
      if (account.type === 'expense') expense += line.debit - line.credit;
    }
  }
  return { income, expense, surplus: income - expense };
}

// Renames an account. Entries are untouched: they point to the account id, not its name.
export function renameAccount(book, id, name) {
  const account = book.accounts.get(id);
  if (!account) throw new Error(`unknown account: ${id}`);
  const clean = String(name ?? '').trim();
  if (clean.length < 2) throw new Error('الاسم لازم يكون حرفين على الأقل');
  book.accounts.set(id, Object.freeze({ ...account, name: clean }));
  return clean;
}

export function accountHasEntries(book, id) {
  return book.entries.some((e) => e.lines.some((l) => l.account === id));
}

// Removes an account that was never used. Accounts with entries can never be removed.
export function removeAccount(book, id) {
  if (!book.accounts.has(id)) throw new Error(`unknown account: ${id}`);
  if (accountHasEntries(book, id)) throw new Error('الحساب عليه حركات، ينفع يتلغى بس مش يتمسح');
  book.accounts.delete(id);
}

export function isReversed(book, entryId) {
  return book.entries.some((e) => e.reversalOf === entryId);
}
