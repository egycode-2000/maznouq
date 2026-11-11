// عدّ الفلوس: you count what is really in a place, and the difference is recorded,
// so the app matches your pocket again. Short: an expense. Extra: income from outside.
import { postEntry, toPiasters } from './ledger.js';
import { formatMoney } from './format.js';

// Egyptian notes and coins, for counting by denomination.
export const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1, 0.5];

export function countTotal(counts) {
  return DENOMINATIONS.reduce((s, value, i) => s + Math.round(value * 100) * (Number(counts[i]) || 0), 0);
}

export function countDifference(recorded, countedPiasters) {
  return countedPiasters - recorded;
}

// Records the difference. categoryId for a shortage, sourceId for extra money.
export function recordCount(book, { placeId, placeName, recorded, countedEgp, categoryId, sourceId, date, entryId, note = '' }) {
  const counted = toPiasters(Number(countedEgp));
  if (!(counted >= 0)) throw new Error('اكتب اللي عدّيته');
  const diff = countDifference(recorded, counted);
  if (diff === 0) return 0;
  const memo = `عدّ ${placeName}: ${diff < 0 ? `ناقص ${formatMoney(-diff)}` : `زيادة ${formatMoney(diff)}`}`;
  const lines = diff < 0
    ? [{ account: categoryId, debit: -diff }, { account: placeId, credit: -diff }]
    : [{ account: placeId, debit: diff }, { account: sourceId, credit: diff }];
  postEntry(book, { id: entryId, date, memo, note, lines });
  return diff;
}
