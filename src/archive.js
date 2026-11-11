// Cancelling items (إلغاء). Rule: an item with no movements is deleted for good;
// an item with movements is only hidden (archived), so its history and all totals stay untouched.
import { balanceOf, accountHasEntries, removeAccount } from './ledger.js';

// kind -> where it lives in the saved data, its ledger account, and its Arabic label.
export const KINDS = {
  source: { list: 'sources', account: (x) => x.id, label: 'المصدر' },
  category: { list: 'categories', account: (x) => x.id, label: 'التصنيف' },
  wallet: { list: 'wallets', account: (x) => x.id, label: 'المحفظة' },
  bill: { list: 'bills', account: (x) => x.accountId, label: 'الالتزام' },
  goal: { list: 'goals', account: (x) => x.accountId, label: 'الدرج' },
  person: { list: 'people', account: (x) => x.accountId, label: 'الحساب' },
  safe: { list: 'safes', account: () => null, label: 'الخزنة' },
};

function find(d, kind, id) {
  const def = KINDS[kind];
  if (!def) throw new Error('نوع غير معروف');
  const item = d[def.list].find((x) => x.id === id);
  if (!item) throw new Error(`${def.label} مش موجود`);
  return { def, item };
}

// Returns 'deleted' or 'archived'.
export function retire(book, d, kind, id) {
  const { def, item } = find(d, kind, id);
  const accountId = def.account(item);

  if (kind === 'wallet') {
    if (item.kind === 'cash') throw new Error('الكاش مينفعش يتلغى');
    if (balanceOf(book, accountId) !== 0) throw new Error('المحفظة فيها رصيد. حوّله لمكان تاني الأول');
  }
  if (kind === 'goal' && balanceOf(book, accountId) !== 0) {
    throw new Error('الدرج فيه فلوس. اسحبها الأول');
  }
  if (kind === 'person' && balanceOf(book, accountId) !== 0) {
    throw new Error('الحساب لسه مش خالص. لازم الرصيد يبقى صفر الأول');
  }
  if (kind === 'safe') {
    const drawers = d.goals.filter((g) => g.safeId === id);
    if (drawers.some((g) => !g.archived)) throw new Error('الخزنة فيها أدراج. الغي الأدراج أو انقلها لخزنة تانية الأول');
    if (!drawers.length) {
      d.safes = d.safes.filter((x) => x.id !== id);
      return 'deleted';
    }
    item.archived = true;
    return 'archived';
  }
  if (kind === 'category') delete d.budgets?.[id];

  if (!accountHasEntries(book, accountId)) {
    removeAccount(book, accountId);
    d[def.list] = d[def.list].filter((x) => x.id !== id);
    return 'deleted';
  }
  item.archived = true;
  return 'archived';
}

export function restore(d, kind, id) {
  const { item } = find(d, kind, id);
  delete item.archived;
}

// What the screens show: active items only, with the cancelled ones listed separately.
// A wallet that holds money is always shown, even if it was cancelled before.
export function viewData(d, book) {
  const archived = {};
  const view = { ...d };
  for (const [kind, def] of Object.entries(KINDS)) {
    const hidden = (x) => x.archived && !(kind === 'wallet' && balanceOf(book, x.id) !== 0);
    archived[kind] = d[def.list].filter(hidden);
    view[def.list] = d[def.list].filter((x) => !hidden(x));
  }
  return { d: view, archived };
}
