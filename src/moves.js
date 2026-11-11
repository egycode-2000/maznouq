// Everyday money movements. Amounts come in as EGP numbers and are stored as integer piasters.
// A "place" is any account money sits in: the cash, a wallet, or a drawer (درج) inside a safe (خزنة).
// Every function accepts placeId; walletId is still accepted for older callers.
import { addAccount, postEntry, balanceOf, renameAccount, toPiasters } from './ledger.js';
import { formatMoney } from './format.js';

function piasters(egp, label = 'المبلغ') {
  const amount = toPiasters(Number(egp));
  if (amount <= 0) throw new Error(`${label} لازم يكون أكبر من صفر`);
  return amount;
}

const placeOf = (args) => args.placeId ?? args.walletId;

// Income lands in a place: the cash by default, or a wallet, or straight into a drawer ("من بره").
export function recordIncome(book, args) {
  const { sourceId, amountEgp, date, payer = '', note = '', entryId } = args;
  const placeId = placeOf(args);
  const amount = piasters(amountEgp);
  if (!placeId) throw new Error('اختار الفلوس دخلت فين');
  if (!sourceId) throw new Error('اختار مصدر الدخل');
  const who = String(payer).trim();
  postEntry(book, {
    id: entryId, date, note,
    memo: `دخل${who ? ` من ${who}` : ''}`,
    lines: [{ account: placeId, debit: amount }, { account: sourceId, credit: amount }],
  });
}

// Spending from any place: the cash, a wallet or a drawer (e.g. 50 from the charity drawer).
export function recordExpense(book, args) {
  const { categoryId, amountEgp, date, note = '', entryId, memo = 'مصروف' } = args;
  const placeId = placeOf(args);
  const amount = piasters(amountEgp);
  if (!placeId) throw new Error('اختار صرفت منين');
  if (!categoryId) throw new Error('اختار التصنيف');
  postEntry(book, {
    id: entryId, date, note, memo,
    lines: [{ account: categoryId, debit: amount }, { account: placeId, credit: amount }],
  });
}

// Moving money between your own places is neither income nor expense.
// A fee (e.g. turning wallet money into cash: 1,000 leaves, 990 arrives, 10 is the fee) is an expense.
export function transfer(book, {
  fromId, toId, amountEgp, feeEgp = 0, feeAccountId = null, date, entryId, memo = 'تحويل', note = '',
}) {
  const amount = piasters(amountEgp);
  const fee = Number(feeEgp) > 0 ? toPiasters(Number(feeEgp)) : 0;
  if (!fromId || !toId) throw new Error('اختار هتحوّل منين ولفين');
  if (fromId === toId) throw new Error('المكانين لازم يكونوا مختلفين');
  if (fee >= amount) throw new Error('الخصم لازم يكون أقل من المبلغ');
  if (fee > 0 && !feeAccountId) throw new Error('حساب الرسوم مش موجود');
  if (balanceOf(book, fromId) < amount) throw new Error('الرصيد في المكان اللي بتحوّل منه مش كفاية');
  const lines = [{ account: toId, debit: amount - fee }];
  if (fee > 0) lines.push({ account: feeAccountId, debit: fee });
  lines.push({ account: fromId, credit: amount });
  postEntry(book, {
    id: entryId, date, note, lines,
    memo: fee > 0 ? `${memo} (خصم ${formatMoney(fee)})` : memo,
  });
  return { arrived: amount - fee, fee };
}

// A drawer (درج) keeps money aside for one purpose, named by the user. It may have a goal, and it may hold
// a unit other than money (unit: 'جرام دهب'). kind 'debt' is money reserved for a debt (محجوز لدين).
export function createGoal(book, {
  id, name, note = '', photo = '', targetEgp = 0, kind = 'other', debtId = null, safeId = null, unit = '', targetQty = 0,
}) {
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) throw new Error('اكتب اسم الدرج');
  const cleanUnit = String(unit ?? '').trim();
  const target = !cleanUnit && Number(targetEgp) > 0 ? toPiasters(Number(targetEgp)) : 0;
  addAccount(book, { id: `goal-${id}`, name: `درج: ${cleanName}`, type: 'asset' });
  return {
    id, name: cleanName, note: String(note).trim(), photo, target, accountId: `goal-${id}`, kind, debtId, safeId,
    unit: cleanUnit || null, targetQty: cleanUnit && Number(targetQty) > 0 ? Math.round(Number(targetQty) * 1000) : 0,
  };
}

export const hasGoal = (g) => (g.unit ? g.targetQty > 0 : g.target > 0);

export function editGoal(book, goal, { name, targetEgp, note, safeId, targetQty }) {
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) throw new Error('اكتب اسم الدرج');
  renameAccount(book, goal.accountId, `درج: ${cleanName}`);
  goal.name = cleanName;
  if (goal.unit) goal.targetQty = Number(targetQty) > 0 ? Math.round(Number(targetQty) * 1000) : 0;
  else goal.target = Number(targetEgp) > 0 ? toPiasters(Number(targetEgp)) : 0;
  goal.note = String(note ?? '').trim();
  if (safeId) goal.safeId = safeId;
}

export function depositGoal(book, goal, args) {
  const { amountEgp, date, entryId, note = '' } = args;
  const placeId = placeOf(args);
  const amount = piasters(amountEgp);
  if (!placeId) throw new Error('اختار الفلوس جاية منين');
  if (balanceOf(book, placeId) < amount) throw new Error('الرصيد في المكان ده مش كفاية');
  postEntry(book, {
    id: entryId, date, note, memo: `حطيت في درج: ${goal.name}`,
    lines: [{ account: goal.accountId, debit: amount }, { account: placeId, credit: amount }],
  });
}

export function withdrawGoal(book, goal, args) {
  const { amountEgp, date, entryId, note = '' } = args;
  const placeId = placeOf(args);
  const amount = piasters(amountEgp);
  if (!placeId) throw new Error('اختار الفلوس رايحة فين');
  if (balanceOf(book, goal.accountId) < amount) throw new Error('المبلغ أكبر من اللي في الدرج');
  postEntry(book, {
    id: entryId, date, note, memo: `سحبت من درج: ${goal.name}`,
    lines: [{ account: placeId, debit: amount }, { account: goal.accountId, credit: amount }],
  });
}

// Works out a split of `amount` piasters. Each row is { id, mode: 'amt' | 'pct', value }.
// 'amt' values are EGP, 'pct' values are percentages of the amount. Empty rows are skipped.
export function planSplit(amount, rows) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('اكتب المبلغ اللي هتوزّعه');
  const lines = [];
  for (const row of rows) {
    const value = Number(row.value);
    if (!value) continue;
    if (!Number.isFinite(value) || value < 0) throw new Error('القيم لازم تكون أرقام موجبة');
    if (row.mode === 'pct' && value > 100) throw new Error('النسبة ما تزيدش عن 100');
    const part = row.mode === 'pct' ? Math.round((amount * value) / 100) : toPiasters(value);
    if (part > 0) lines.push({ id: row.id, amount: part });
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  if (total > amount) throw new Error(`التوزيع أكبر من المبلغ بـ ${formatMoney(total - amount)}`);
  return { lines, total, rest: amount - total };
}

// Posts a split from one place. Each line is { amount, accountId, type: 'pocket' | 'expense', name }.
// Drawer lines move money aside; expense lines are spent right away (e.g. صدقات).
// With outsideSourceId the money comes from outside (income) straight into the drawers.
export function applySplit(book, args) {
  const { lines, date, idPrefix, note = '', outsideSourceId = null, payer = '' } = args;
  const placeId = placeOf(args);
  if (!outsideSourceId && !placeId) throw new Error('اختار الفلوس جاية منين');
  if (!lines.length) throw new Error('اكتب مبلغ أو نسبة في سطر واحد على الأقل');
  const total = lines.reduce((s, l) => s + l.amount, 0);
  if (!outsideSourceId) {
    const have = balanceOf(book, placeId);
    if (total > have) throw new Error(`المكان ده فيه ${formatMoney(have)} بس`);
  }
  const who = String(payer).trim();
  lines.forEach((line, i) => {
    const from = outsideSourceId ?? placeId;
    let memo = line.type === 'expense' ? `مصروف: ${line.name}` : `حطيت في درج: ${line.name}`;
    if (outsideSourceId) memo = `دخل من بره${who ? ` (${who})` : ''} ← ${line.name}`;
    postEntry(book, {
      id: `${idPrefix}-${i}`, date, note, memo,
      lines: [{ account: line.accountId, debit: line.amount }, { account: from, credit: line.amount }],
    });
  });
  return total;
}
