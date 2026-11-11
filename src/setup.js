// First-run setup: turns the user's answers into a ledger book.
// Pure functions only (no DOM, no storage), so they can be tested in Node.

import { createBook, addAccount, postEntry, toPiasters } from './ledger.js';

const OPENING_ACCOUNT = 'opening';

export function validateName(name) {
  const clean = String(name ?? '').trim();
  if (clean.length < 2) throw new Error('الاسم لازم يكون حرفين على الأقل');
  if (clean.length > 30) throw new Error('الاسم أطول من 30 حرف');
  return clean;
}

function assertDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('تاريخ البداية لازم يكون YYYY-MM-DD');
}

// wallets:        [{ id, name, opening }]  opening in EGP, may be 0
// incomeSources:  [{ id, name, kind: 'monthly' | 'open' }]
// categories:     [{ id, name }]
export function buildInitialBook({ wallets = [], incomeSources = [], categories = [], openingDate }) {
  assertDate(openingDate);
  if (wallets.length === 0) throw new Error('لازم تضيف مكان واحد على الأقل لفلوسك');

  const book = createBook();
  const used = new Set([OPENING_ACCOUNT]);
  const claim = (id) => {
    if (!id) throw new Error('كل عنصر لازم يكون ليه معرّف');
    if (used.has(id)) throw new Error(`تكرار في الاسم: ${id}`);
    used.add(id);
  };

  addAccount(book, { id: OPENING_ACCOUNT, name: 'رصيد البداية', type: 'equity' });

  for (const w of wallets) {
    claim(w.id);
    addAccount(book, { id: w.id, name: w.name, type: 'asset' });
    const amount = toPiasters(w.opening ?? 0);
    if (amount < 0) throw new Error('الرصيد الابتدائي ما يكونش بالسالب');
    if (amount > 0) {
      postEntry(book, {
        id: `open-${w.id}`,
        date: openingDate,
        memo: 'رصيد البداية',
        lines: [
          { account: w.id, debit: amount },
          { account: OPENING_ACCOUNT, credit: amount },
        ],
      });
    }
  }

  const sources = incomeSources.map((s) => {
    claim(s.id);
    if (!['monthly', 'open'].includes(s.kind)) throw new Error('نوع المصدر لازم يكون شهري أو مفتوح');
    addAccount(book, { id: s.id, name: s.name, type: 'income' });
    return { id: s.id, name: s.name, kind: s.kind };
  });

  const cats = categories.map((c) => {
    claim(c.id);
    addAccount(book, { id: c.id, name: c.name, type: 'expense' });
    return { id: c.id, name: c.name };
  });

  return { book, sources, categories: cats, openingDate };
}

// Turns a book into plain data that can be stored and read back.
export function snapshotBook(book) {
  return {
    accounts: [...book.accounts.values()].map((a) => ({ ...a })),
    entries: book.entries.map((e) => ({
      id: e.id,
      date: e.date,
      memo: e.memo,
      note: e.note ?? '',
      reversalOf: e.reversalOf,
      lines: e.lines.map((l) => ({ account: l.account, debit: l.debit, credit: l.credit })),
    })),
  };
}

export function restoreBook(snapshot) {
  const book = createBook();
  for (const a of snapshot.accounts) addAccount(book, a);
  for (const e of snapshot.entries) {
    // Restored entries were validated when first posted, so they go in as stored.
    book.entries.push(Object.freeze({
      id: e.id,
      date: e.date,
      memo: e.memo,
      note: e.note ?? '',
      reversalOf: e.reversalOf ?? null,
      lines: Object.freeze(e.lines.map((l) => Object.freeze({ ...l }))),
    }));
  }
  return book;
}
