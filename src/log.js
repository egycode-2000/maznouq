// سجل الحركات: every entry, newest first, with what it was, where money moved, and its note.
// An entry can be undone (عكس) from here when nothing else depends on it.
// Payments that change a status (a bill month, a jam'iya month, a payout) are undone from their own screen,
// so their status goes back to «لسه» together with the money.
import { isReversed } from './ledger.js';

// Entry id prefixes written by the app, and whether the log may undo them.
const UNDO_HERE = ['exp-', 'inc-', 'tr-', 'sp-', 'gd-', 'gw-', 'dp-', 'rs-', 'dl-', 'pe-', 'put-', 'dy-', 'cover-', 'cnt-', 'ub-', 'us-'];
const OWN_SCREEN = {
  'pb-': 'من شاشة الالتزام', 'jp-': 'من شاشة الجمعية', 'jr-': 'من شاشة الجمعية', 'jam-': 'من شاشة الجمعية',
};

export function undoRule(book, entry) {
  if (entry.reversalOf) return { can: false, why: 'دي حركة عكس' };
  if (isReversed(book, entry.id)) return { can: false, why: 'اتعكست' };
  if (UNDO_HERE.some((p) => entry.id.startsWith(p))) return { can: true, why: '' };
  const own = Object.keys(OWN_SCREEN).find((p) => entry.id.startsWith(p));
  if (own) return { can: false, why: `تتعكس ${OWN_SCREEN[own]}` };
  return { can: false, why: 'رصيد بداية' };
}

// The amount of an entry: what moved (the debit side total).
export const entryAmount = (entry) => entry.lines.reduce((s, l) => s + l.debit, 0);

// Entries that can be edited from the log: the same questions open again with the old answers.
export const canEdit = (entry) => ['exp-', 'inc-'].some((p) => entry.id.startsWith(p));

// edits: { [newEntryId]: { prevAmount, hide: [oldEntryId, itsReversalId] } } — an edited entry shows once.
export function logRows(book, { search = '', month = '', edits = {} } = {}) {
  const hidden = new Set(Object.values(edits).flatMap((e) => e.hide));
  const words = String(search).trim().toLowerCase();
  const name = (id) => book.accounts.get(id)?.name ?? id;
  return [...book.entries]
    .map((e, order) => ({ e, order }))
    .filter(({ e }) => !hidden.has(e.id) && (!month || e.date.startsWith(month)))
    .map(({ e, order }) => ({
      id: e.id,
      date: e.date,
      order,
      memo: e.memo,
      note: e.note ?? '',
      amount: entryAmount(e),
      to: e.lines.filter((l) => l.debit > 0).map((l) => name(l.account)),
      from: e.lines.filter((l) => l.credit > 0).map((l) => name(l.account)),
      undo: undoRule(book, e),
      edit: canEdit(e) && undoRule(book, e).can,
      editedFrom: edits[e.id]?.prevAmount ?? null,
      reversal: Boolean(e.reversalOf),
    }))
    .filter((r) => !words || [r.memo, r.note, ...r.to, ...r.from, String(r.amount / 100)].join(' ').toLowerCase().includes(words))
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
}
