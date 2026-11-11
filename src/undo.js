// Cancelling a recorded move, in one place for every screen (the log, «تراجع», and «عدّل»).
// The entry is reversed, never deleted, and everything that hung on it goes back with it:
// a «هرجّعها» borrow it made, a borrow repayment it was, and the top-up transfer that completed it.
import { reverseEntry, isReversed } from './ledger.js';
import { undoRule, entryAmount } from './log.js';
import { checkUnitsWithout } from './units.js';

export function undoEntry(book, d, entryId, { stamp, date }) {
  const entry = book.entries.find((e) => e.id === entryId);
  if (!entry) throw new Error('الحركة مش موجودة');
  const rule = undoRule(book, entry);
  if (!rule.can) throw new Error(rule.why);
  const borrow = d.borrows.find((b) => b.entryId === entryId);
  if (borrow && borrow.repaid > 0) throw new Error('السلفة دي رجع منها جزء. اعكس الإرجاع الأول');
  checkUnitsWithout(book, d, entryId);

  const rev = stamp('undo');
  reverseEntry(book, entryId, { id: rev, date });
  const touched = [rev];
  if (borrow) d.borrows = d.borrows.filter((b) => b !== borrow);

  const repay = d.repays?.[entryId];
  if (repay) {
    const b = d.borrows.find((x) => x.id === repay.borrowId);
    if (b) b.repaid = Math.max(0, b.repaid - repay.amount);
    delete d.repays[entryId];
  }
  (d.links?.[entryId] ?? []).forEach((linked, i) => {
    if (isReversed(book, linked)) return;
    reverseEntry(book, linked, { id: `${rev}-l${i}`, date });
    touched.push(linked, `${rev}-l${i}`);
  });
  if (d.links) delete d.links[entryId];
  return { amount: entryAmount(entry), touched };
}
