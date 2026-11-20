// «ابدأ من الأول»: a new start keeping the names, as in the approved «وثيقة الحسابات».
// Nothing is deleted (rule 9). For each money place you write what is really in it now; the difference from
// its balance in the app is one settlement entry today against «رصيد البداية» (not income, not spending).
// Everything before is a closed period (rule 22): it stays in the log, without undo or edit, and the month
// that holds the new start counts only what comes after it (ledger.countsIn).
// People, debts and jam'iyas stay as they are: real money does not vanish with a fresh start.
// Open borrows between drawers are closed as settled, with no money moving: the balances were set by counting.
import { postEntry, balanceOf } from './ledger.js';
import { placeList } from './places.js';
import { leftOf } from './borrows.js';
import { addDays } from './daily.js';

export const RESTART_KINDS = ['cash', 'wallet', 'drawer'];

// targets: { [placeAccountId]: piasters }. A place not in targets keeps its balance.
export function newStart(book, d, { targets = {}, date }) {
  const index = book.entries.length;
  book.period = { date, index };
  d.period = { date, index };
  let moved = 0;
  placeList(d, book).filter((p) => RESTART_KINDS.includes(p.kind)).forEach((p, i) => {
    if (!(p.id in targets)) return;
    const target = targets[p.id];
    if (!Number.isInteger(target) || target < 0) throw new Error(`اكتب اللي في ${p.name} فعلا (صفر أو أكتر)`);
    const diff = target - balanceOf(book, p.id);
    if (diff === 0) return;
    postEntry(book, {
      id: `restart-${date}-${index}-${i}`, date, memo: `تسوية بداية جديدة: ${p.name}`,
      lines: diff > 0
        ? [{ account: p.id, debit: diff }, { account: 'opening', credit: diff }]
        : [{ account: 'opening', debit: -diff }, { account: p.id, credit: -diff }],
    });
    moved += 1;
  });
  let closed = 0;
  for (const b of d.borrows) {
    if (leftOf(b) > 0) {
      b.settled = date;
      b.repaid = b.amount;
      closed += 1;
    }
  }
  // Daily splits start again from today, with no missed days carried over.
  for (const t of d.templates) if (t.daily) t.lastDone = addDays(date, -1);
  return { settled: moved, closedBorrows: closed };
}
