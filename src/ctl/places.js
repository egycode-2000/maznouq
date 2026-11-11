// Actions for الخزن والأدراج and الكاش والمحافظ.
import { change, today, v, egp, piasters, checked, nowStamp, findBy, miscSource, withPhoto } from './core.js';
import { addAccount, postEntry, renameAccount, toPiasters } from '../ledger.js';
import { createGoal, editGoal, depositGoal, withdrawGoal, applySplit } from '../moves.js';
import { formatMoney } from '../format.js';
import { rememberPlace, checkSpend } from '../places.js';
import { buyUnits, sellUnits } from '../units.js';

const dateOr = (id) => v(id) || today();
let doneMsg = '';

// Photo of a place: resized to 800px and stored as a small JPEG.
export async function photoToDataUrl(file, maxSide = 800, quality = 0.7) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('الصورة مش مقبولة'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const photoIn = async (id) => {
  const file = document.getElementById(id)?.files?.[0];
  return file ? photoToDataUrl(file) : null;
};

const feePct = (id) => {
  const n = egp(id);
  if (n < 0 || n > 50) throw new Error('نسبة الخصم لازم تكون من 0 لـ 50');
  return n;
};

export const placeActions = {
  'add-safe': () => change((st) => {
    const name = String(v('sf-name')).trim();
    if (name.length < 2) throw new Error('اكتب اسم الخزنة');
    st.d.safes.push({ id: nowStamp('safe'), name, note: v('sf-note').trim() });
  }, 'safes', {}, '✓ اتعملت الخزنة. ادخلها وضيف أدراجها'),
  'save-safe': (p) => change((st) => {
    const s = findBy(st.d.safes, p.id, 'الخزنة');
    const name = String(v('sfe-name')).trim();
    if (name.length < 2) throw new Error('اكتب اسم الخزنة');
    s.name = name;
    s.note = v('sfe-note').trim();
  }, 'safe', { id: p.id }),

  'save-drawer': async () => {
    const photo = (await photoIn('g-photo')) ?? '';
    const safeId = v('g-safe');
    return change((st) => {
      if (!st.d.safes.some((s) => s.id === safeId)) throw new Error('اختار الخزنة');
      const unit = v('g-holds') === 'unit' ? String(v('g-unit')).trim() : '';
      if (v('g-holds') === 'unit' && unit.length < 2) throw new Error('اكتب اسم الوحدة (مثلا: جرام دهب)');
      st.d.goals.push(createGoal(st.book, {
        id: nowStamp('g'), name: v('g-name'), note: v('g-note'), photo, safeId, unit,
        targetEgp: unit ? 0 : egp('g-target'), targetQty: unit ? egp('g-target') : 0,
      }));
    }, 'safe', { id: safeId }, '✓ اتضاف الدرج');
  },
  'update-drawer': async (p) => {
    const photo = await photoIn('g-photo');
    return change((st) => {
      const g = findBy(st.d.goals, p.id, 'الدرج');
      editGoal(st.book, g, { name: v('g-name'), targetEgp: egp('g-target'), targetQty: egp('g-target'), note: v('g-note'), safeId: v('g-safe') });
      if (photo) g.photo = photo;
    }, 'drawer', { id: p.id });
  },
  'deposit-drawer': (p) => change((st) => {
    const g = findBy(st.d.goals, p.id, 'الدرج');
    const entryId = nowStamp('gd');
    depositGoal(st.book, g, { placeId: v('place'), amountEgp: egp('amount'), date: dateOr('date'), note: v('note'), entryId });
    withPhoto(st, entryId);
    rememberPlace(st.d, st.book, v('place'));
  }, 'drawer', { id: p.id }, '✓ اتحط في الدرج'),
  'withdraw-drawer': (p) => change((st) => {
    const g = findBy(st.d.goals, p.id, 'الدرج');
    const entryId = nowStamp('gw');
    withdrawGoal(st.book, g, { placeId: v('place'), amountEgp: egp('amount'), date: dateOr('date'), note: v('note'), entryId });
    withPhoto(st, entryId);
  }, 'drawer', { id: p.id }, '✓ اتسحب من الدرج'),

  // A drawer that holds units (gold, dollars...): buying moves money into it, selling brings money back.
  'buy-units': (p) => change((st) => {
    const g = findBy(st.d.goals, p.id, 'الدرج');
    const entryId = nowStamp('ub');
    checkSpend(st.d, st.book, v('ub-place'), toPiasters(egp('ub-paid')));
    buyUnits(st.book, st.d, g, { qty: egp('ub-qty'), paidEgp: egp('ub-paid'), placeId: v('ub-place'), date: today(), entryId });
    doneMsg = `✓ اتسجل الشراء: ${v('ub-qty')} ${g.unit}`;
  }, 'drawer', { id: p.id }, () => doneMsg),
  'sell-units': (p) => change((st) => {
    const g = findBy(st.d.goals, p.id, 'الدرج');
    const ensure = (id, name, type, list, extra = {}) => {
      if (st.book.accounts.has(id)) return id;
      addAccount(st.book, { id, name, type });
      list.push({ id, name, ...extra });
      return id;
    };
    const r = sellUnits(st.book, st.d, g, {
      qty: egp('us-qty'), receivedEgp: egp('us-got'), placeId: v('us-place'), date: today(), entryId: nowStamp('us'),
      gainId: ensure('s-gain', 'مكسب بيع', 'income', st.d.sources, { kind: 'open' }),
      lossId: ensure('e-loss', 'خسارة بيع', 'expense', st.d.categories),
    });
    doneMsg = r.diff === 0 ? '✓ اتسجل البيع، لا مكسب ولا خسارة'
      : r.diff > 0 ? `✓ اتسجل البيع. كسبت ${formatMoney(r.diff)}` : `✓ اتسجل البيع. خسرت ${formatMoney(-r.diff)}`;
  }, 'drawer', { id: p.id }, () => doneMsg),

  // One amount per drawer, from the cash or a wallet, or new money from outside (counted as income).
  'put-drawers': (p) => change((st) => {
    const lines = [...document.querySelectorAll('.put-val')]
      .map((el) => ({ accountId: el.dataset.target, amount: toPiasters(egp(el.id)) }))
      .filter((l) => l.amount > 0)
      .map((l) => ({ ...l, type: 'pocket', name: st.d.goals.find((g) => g.accountId === l.accountId)?.name ?? 'درج' }));
    const outside = checked('put-outside');
    const idPrefix = nowStamp('put');
    const total = applySplit(st.book, {
      placeId: v('put-from'), lines, date: dateOr('put-date'), idPrefix, note: v('put-note'),
      outsideSourceId: outside ? miscSource(st) : null, payer: v('put-payer'),
    });
    withPhoto(st, `${idPrefix}-0`);
    doneMsg = `✓ اتحط ${formatMoney(total)} في الأدراج${outside ? ' (دخل من بره)' : ''}`;
  }, 'safe', { id: p.id }, () => doneMsg),

  'save-wallets': () => change((st) => {
    for (const w of st.d.wallets) {
      if (document.getElementById(`wn-${w.id}`)) w.name = renameAccount(st.book, w.id, v(`wn-${w.id}`));
      if (document.getElementById(`wf-${w.id}`)) w.feePct = feePct(`wf-${w.id}`);
    }
  }, 'wallets'),
  'add-wallet': () => change((st) => {
    const name = String(v('nw-name')).trim();
    if (name.length < 2) throw new Error('اكتب اسم المحفظة');
    const opening = piasters('nw-open');
    const id = nowStamp('w');
    addAccount(st.book, { id, name, type: 'asset' });
    if (opening > 0) {
      postEntry(st.book, {
        id: `open-${id}`, date: today(), memo: 'رصيد البداية',
        lines: [{ account: id, debit: opening }, { account: 'opening', credit: opening }],
      });
    }
    st.d.wallets.push({ id, name, kind: 'wallet', feePct: feePct('nw-fee') });
  }, 'wallets'),
};
