// Money taken out of a drawer (درج) that should go back to it later (سلفة).
// fromId: the place (account id) that lent the money. toId: the place that took it.
// entryId: the ledger entry that moved the money, so undoing that entry also removes the borrow.
// These are notes for the user; the ledger itself only sees normal moves between accounts.

export function addBorrow(d, { id, fromId, toId = null, amount, date, note = '', entryId = null }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('مبلغ السلفة لازم يكون أكبر من صفر');
  if (fromId === toId) throw new Error('الدرج مينفعش يستلف من نفسه');
  d.borrows.push({ id, fromId, toId, amount, repaid: 0, date, note: String(note).trim(), entryId });
}

export const leftOf = (b) => b.amount - b.repaid;

// Borrows that are still open and touch this drawer: what is owed to it, and what it owes.
export function borrowsOf(d, drawerId) {
  const open = d.borrows.filter((b) => leftOf(b) > 0);
  return {
    owedToIt: open.filter((b) => b.fromId === drawerId),
    itOwes: open.filter((b) => b.toId === drawerId),
  };
}

// Returns how much of `amount` went to the borrow (never more than what is left).
export function repayBorrow(d, id, amount) {
  const b = d.borrows.find((x) => x.id === id);
  if (!b) throw new Error('السلفة دي مش موجودة');
  const used = Math.min(leftOf(b), amount);
  b.repaid += used;
  return used;
}
