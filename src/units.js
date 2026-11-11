// Drawers that hold something other than money: grams of gold, dollars, shares...
// The user names the unit. The drawer's ledger balance is what was paid for what it holds (its cost),
// and the quantity is the sum of its buy and sell moves, skipping moves whose entry was undone.
// Quantities are kept as whole thousandths (5.25 grams = 5250) so sums never drift.
import { postEntry, balanceOf, isReversed, toPiasters } from './ledger.js';

export const isUnit = (g) => Boolean(g?.unit);
export const showQty = (q) => String(q / 1000);

function toQty(value) {
  const n = Math.round(Number(value) * 1000);
  if (!(n > 0)) throw new Error('اكتب الكمية');
  return n;
}

export function unitQty(book, d, g) {
  return (d.unitMoves ?? [])
    .filter((m) => m.drawerId === g.id && !isReversed(book, m.entryId))
    .reduce((s, m) => s + m.qty, 0);
}

// Everything the screens show about a unit drawer, from one place.
export function unitSummary(book, d, g) {
  const qty = unitQty(book, d, g);
  const cost = balanceOf(book, g.accountId);
  const target = g.targetQty ?? 0;
  return {
    qty,
    cost,
    avg: qty > 0 ? Math.round((cost * 1000) / qty) : 0, // piasters per one unit
    target,
    percent: target > 0 ? Math.min(100, Math.floor((qty * 100) / target)) : null,
  };
}

// Buying: money leaves a place, and the drawer holds more units. Not an expense: you still own it.
export function buyUnits(book, d, g, { qty, paidEgp, placeId, date, entryId, note = '' }) {
  const q = toQty(qty);
  const paid = toPiasters(Number(paidEgp));
  if (!(paid > 0)) throw new Error('اكتب دفعت كام');
  if (!placeId) throw new Error('اختار دفعت منين');
  postEntry(book, {
    id: entryId, date, note, memo: `اشتريت ${showQty(q)} ${g.unit} (${g.name})`,
    lines: [{ account: g.accountId, debit: paid }, { account: placeId, credit: paid }],
  });
  d.unitMoves.push({ entryId, drawerId: g.id, qty: q });
}

// Selling: the money received lands in a place. What was sold leaves the drawer at its average cost,
// and the difference is a gain or a loss.
export function sellUnits(book, d, g, { qty, receivedEgp, placeId, gainId, lossId, date, entryId, note = '' }) {
  const q = toQty(qty);
  const have = unitQty(book, d, g);
  if (q > have) throw new Error(`اللي في الدرج ${showQty(have)} ${g.unit} بس`);
  const received = toPiasters(Number(receivedEgp));
  if (!(received > 0)) throw new Error('اكتب قبضت كام');
  if (!placeId) throw new Error('اختار الفلوس دخلت فين');
  const balance = balanceOf(book, g.accountId);
  const cost = q === have ? balance : Math.round((balance * q) / have);
  const diff = received - cost;
  const lines = [{ account: placeId, debit: received }];
  if (diff < 0) lines.push({ account: lossId, debit: -diff });
  lines.push({ account: g.accountId, credit: cost });
  if (diff > 0) lines.push({ account: gainId, credit: diff });
  postEntry(book, { id: entryId, date, note, memo: `بعت ${showQty(q)} ${g.unit} (${g.name})`, lines });
  d.unitMoves.push({ entryId, drawerId: g.id, qty: -q });
  return { cost, diff };
}

// Undoing an entry must never leave a drawer holding less than nothing.
export function checkUnitsWithout(book, d, entryId) {
  const move = (d.unitMoves ?? []).find((m) => m.entryId === entryId);
  if (!move || move.qty < 0) return;
  const g = { id: move.drawerId };
  if (unitQty(book, d, g) - move.qty < 0) throw new Error('الكمية دي اتباع منها. اعكس البيع الأول');
}
