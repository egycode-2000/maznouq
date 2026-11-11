// Actions for the lock (code and fingerprint) and for counting money.
import { session, render, change, today, v, egp, nowStamp, miscSource } from './core.js';
import { makeLock, pinMatches, checkPinFormat, biometricAvailable, registerBiometric } from '../lock.js';
import { recordCount } from '../count.js';
import { placeById } from '../places.js';
import { addAccount } from '../ledger.js';
import { formatMoney, toEnglishDigits } from '../format.js';

const digits = (id) => toEnglishDigits(v(id)).trim();
const currentLock = () => session.ctx?.d.settings.lock ?? null;
let doneMsg = '';

function newPinFromForm() {
  const pin = digits('pin-new');
  checkPinFormat(pin);
  if (pin !== digits('pin-again')) throw new Error('الرقمين مش زي بعض');
  return pin;
}

async function requireCurrent() {
  if (!(await pinMatches(currentLock(), digits('pin-old')))) throw new Error('الرقم الحالي غلط');
}

// Expense account for a shortage nobody remembers, made the first time it is needed.
function countCategory(st) {
  const id = 'e-count';
  if (!st.book.accounts.has(id)) {
    addAccount(st.book, { id, name: 'فرق عدّ', type: 'expense' });
    st.d.categories.push({ id, name: 'فرق عدّ' });
  }
  return id;
}

export const securityActions = {
  'lock-on': async () => {
    const lock = await makeLock(newPinFromForm(), 1);
    session.unlocked = true;
    return change((st) => { st.d.settings.lock = lock; }, 'settings', {}, '✓ القفل اتشغّل. افتكر الرقم كويس، ومفيش طريقة تفتح من غيره');
  },
  'lock-change': async () => {
    await requireCurrent();
    const lock = await makeLock(newPinFromForm(), currentLock().minutes);
    lock.credId = currentLock().credId;
    return change((st) => { st.d.settings.lock = lock; }, 'settings', {}, '✓ الرقم السري اتغيّر');
  },
  'lock-off': async () => {
    await requireCurrent();
    return change((st) => { delete st.d.settings.lock; }, 'settings', {}, '✓ القفل اتوقّف');
  },
  'lock-minutes': () => change((st) => {
    const n = Number(digits('lock-minutes'));
    if (!Number.isInteger(n) || n < 0 || n > 60) throw new Error('اكتب رقم من 0 لـ 60');
    st.d.settings.lock.minutes = n;
  }, 'settings'),
  'bio-on': async () => {
    if (!(await biometricAvailable())) throw new Error('الموبايل ده مش بيدعم البصمة في البرنامج. الرقم السري هيفضل شغال');
    let credId;
    try {
      credId = await registerBiometric(session.ctx?.d.name);
    } catch {
      throw new Error('البصمة ماتسجلتش. جرّب تاني، والرقم السري هيفضل شغال');
    }
    return change((st) => { st.d.settings.lock.credId = credId; }, 'settings', {}, '✓ البصمة اتشغّلت');
  },
  'bio-off': () => change((st) => { st.d.settings.lock.credId = null; }, 'settings', {}, '✓ البصمة اتوقّفت'),
  'lock-now': () => {
    session.unlocked = false;
    session.pin = '';
    return render();
  },

  'save-count': () => change((st) => {
    const placeId = v('count-place');
    const place = placeById(st.d, st.book, placeId);
    if (!place) throw new Error('اختار بتعدّ إيه');
    if (v('count-amount').trim() === '') throw new Error('اكتب اللي عدّيته');
    const cat = v('count-cat') === '__count' ? countCategory(st) : v('count-cat');
    const diff = recordCount(st.book, {
      placeId, placeName: place.name, recorded: place.balance, countedEgp: egp('count-amount'),
      categoryId: cat, sourceId: miscSource(st), date: today(), entryId: nowStamp('cnt'), note: v('count-note'),
    });
    doneMsg = diff === 0 ? `✓ ${place.name} مظبوط، مفيش فرق`
      : `✓ ${place.name} بقى مظبوط (${diff < 0 ? `ناقص ${formatMoney(-diff)}` : `زيادة ${formatMoney(diff)}`} اتسجّل)`;
  }, () => session.route.p.back ?? 'home', {}, () => doneMsg),
};

