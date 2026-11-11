// Where money sits. The single source for every balance shown on screen.
// الكاش: the money in your pocket (one place). المحافظ: Vodafone Cash, InstaPay, bank.
// الخزنة: a place that keeps money aside, and each خزنة has أدراج (drawers), one per purpose.
// Money stays counted as long as it sits in one of these places, until it is recorded as spent.
import { balanceOf } from './ledger.js';
import { formatMoney } from './format.js';
import { isUnit, unitSummary } from './units.js';

export const cashOf = (d) => d.wallets.find((w) => w.kind === 'cash') ?? d.wallets[0];

// Every place money can move from or to, with its balance. `id` is the ledger account.
export function placeList(d, book) {
  const cash = cashOf(d);
  const list = [];
  if (cash) list.push({ id: cash.id, name: cash.name, kind: 'cash', balance: balanceOf(book, cash.id) });
  for (const w of d.wallets) {
    if (w === cash) continue;
    list.push({ id: w.id, name: w.name, kind: 'wallet', feePct: w.feePct ?? 0, balance: balanceOf(book, w.id) });
  }
  for (const s of d.safes) {
    for (const g of d.goals.filter((x) => x.safeId === s.id)) {
      list.push({
        id: g.accountId, name: g.name, kind: isUnit(g) ? 'unit' : 'drawer', drawerId: g.id, safeId: s.id, safeName: s.name,
        balance: balanceOf(book, g.accountId), target: g.target ?? 0,
      });
    }
  }
  return list;
}

export function placeById(d, book, id) {
  return placeList(d, book).find((p) => p.id === id) ?? null;
}

// The safe with its drawers and its total.
export function safeSummary(d, book, safe) {
  const drawers = d.goals.filter((g) => g.safeId === safe.id).map((g) => ({
    ...g, balance: balanceOf(book, g.accountId), units: isUnit(g) ? unitSummary(book, d, g) : null,
  }));
  // The safe's total counts money only. Gold and the like are listed by quantity, apart.
  return { ...safe, drawers, total: drawers.filter((g) => !g.units).reduce((s, g) => s + g.balance, 0) };
}

// Everything you have: cash, each wallet, each safe with its drawers, and the grand total.
export function moneyPicture(d, book) {
  const places = placeList(d, book);
  const cash = places.find((p) => p.kind === 'cash') ?? { balance: 0 };
  const wallets = places.filter((p) => p.kind === 'wallet');
  const safes = d.safes.map((s) => safeSummary(d, book, s));
  const walletsTotal = wallets.reduce((s, w) => s + w.balance, 0);
  const safesTotal = safes.reduce((s, x) => s + x.total, 0);
  const units = safes.flatMap((s) => s.drawers.filter((g) => g.units).map((g) => ({
    id: g.id, name: g.name, unit: g.unit, safeName: s.name, ...g.units,
  })));
  return {
    units,
    unitsCost: units.reduce((s, u) => s + u.cost, 0),
    cash: cash.balance,
    wallets,
    walletsTotal,
    safes,
    safesTotal,
    total: cash.balance + walletsTotal + safesTotal,
  };
}

// The fee suggested when money leaves a wallet for the cash (e.g. 1% of 1,000 = 10). Always editable.
export function suggestedFee(d, fromId, toId, amount) {
  const from = d.wallets.find((w) => w.id === fromId);
  const cash = cashOf(d);
  if (!from || from === cash || toId !== cash?.id || !from.feePct) return 0;
  return Math.round((amount * from.feePct) / 100);
}

// One rule for every payment, used by every screen that pays:
//  - a drawer (درج) can never go below zero: it only holds what was put in it;
//  - the cash and the wallets may go below zero (as agreed: warn, do not block).
// Returns a warning to show after saving, or '' when all is fine.
export function checkSpend(d, book, placeId, amount) {
  const place = placeById(d, book, placeId);
  if (!place) throw new Error('اختار هتدفع منين');
  if (place.kind === 'drawer' && place.balance < amount) {
    throw new Error(`${place.name} فيه ${formatMoney(Math.max(0, place.balance))} بس. اختار مكان تاني`);
  }
  return place.balance < amount ? ` (تنبيه: ${place.name} بقى بالسالب)` : '';
}

// The place offered first next time: only the cash or a wallet, never a drawer.
export function rememberPlace(d, book, placeId) {
  const place = placeById(d, book, placeId);
  if (place && place.kind !== 'drawer') d.settings.lastPlace = placeId;
}

// The place a form offers first: the last cash or wallet used, else the cash.
export function defaultPlace(d, places) {
  const last = places.find((p) => p.id === d.settings.lastPlace);
  return last && last.kind !== 'drawer' ? last.id : cashOf(d)?.id;
}
