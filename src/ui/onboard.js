// الإعداد خطوة خطوة: one question per screen, in the round style. The order and the checks are in src/onboard.js.
import { esc, money, circle, circles, note, footer, ICONS } from './common.js';
import { ONBOARD_STEPS } from '../onboard.js';
import { parseMoneyInput } from '../format.js';
import { toPiasters } from '../ledger.js';

const TITLES = {
  name: 'اسمك إيه؟',
  cash: 'معاك كام كاش دلوقتي؟',
  wallets: 'عندك محافظ؟',
  walletAmounts: 'فيها كام؟',
  sources: 'فلوسك بتيجي منين؟',
  categories: 'بتصرف في إيه؟',
  drawers: 'بتشيل فلوس لحاجة؟',
  drawerAmounts: 'فيهم كام دلوقتي؟',
  bills: 'عليك التزامات كل شهر؟',
  billAmounts: 'كام وإمتى؟',
  people: 'فيه حد ليك أو عليك فلوس؟',
  jam: 'داخل جمعية؟',
  lock: 'تحب تقفل البرنامج برقم سري؟',
  review: 'راجع وابدأ',
};
const HINTS = {
  wallets: 'اختار كل اللي عندك (فودافون كاش، إنستاباي، بنك...). مفيش؟ دوس «التالي».',
  sources: 'اختار اللي ينطبق عليك، أو اكتب غيره.',
  categories: 'الأبواب المتعلّم عليها هي الأكتر شيوعا. شيل اللي مش محتاجه وزوّد اللي ناقص. تقدر تحط لكل باب حد شهري بعدين.',
  drawers: 'كل حاجة هتبقى «درج» جوه «خزنتي»: فلوس متشالة لغرض. ولو مفيش، دوس «مش دلوقتي».',
  drawerAmounts: 'اكتب اللي متشال لكل غرض دلوقتي. لو لسه هتبدأ سيبه فاضي.',
  bills: 'اختار اللي بتدفعه كل شهر، والبرنامج يفكّرك بيه.',
  billAmounts: 'اللي بيتغير كل شهر (كهربا، مية) اكتب متوسطه.',
  people: 'فلوس بينك وبين حد من قبل البرنامج: ليك عنده ولا عليك له. ومفيش حاجة بتتخصم من الكاش.',
  jam: 'لو أيوه، أول ما تخلّص هتفتحلك أسئلة الجمعية.',
  lock: 'لو أيوه، أول ما تخلّص هتفتحلك الإعدادات تعمل الرقم.',
};

const egp = (text) => {
  try { return toPiasters(parseMoneyInput(String(text ?? ''))); } catch { return 0; }
};
const chosen = (list) => list.filter((x) => x.on);

function multi(draft, list, { lastRing = 4 } = {}) {
  return `
    ${circles(draft[list].map((x, i) => circle({
      label: x.name, ring: i, on: x.on, attrs: `data-do="ob-toggle" data-list="${list}" data-i="${i}"`,
      inner: x.on ? '✓' : '+',
    })))}
    <div class="limit-row">
      <input id="ob-own" class="field" placeholder="غيرها؟ اكتب الاسم" />
      <button class="btn2 mini-btn" data-do="ob-add" data-list="${list}">+ زوّد</button>
    </div>`;
}

function amounts(list, items, { day = false } = {}) {
  return items.map(({ x, i }) => `
    <div class="card line-row">
      <span class="split-name"><b>${esc(x.name)}</b></span>
      <input class="field split-val" data-ob-amt="${list}:${i}" inputmode="decimal" placeholder="0" value="${esc(x.amount)}" />
      ${day ? `<input class="field split-val day-val" data-ob-day="${list}:${i}" inputmode="numeric" placeholder="يوم" value="${esc(x.day)}" />` : ''}
    </div>`).join('');
}

function stepBody(draft, step) {
  const indexed = (list) => draft[list].map((x, i) => ({ x, i })).filter(({ x }) => x.on);
  switch (step) {
    case 'name':
      return `
        <input id="ob-name" class="field big-field" value="${esc(draft.name)}" placeholder="اكتب اسمك أو لقبك" data-autofocus />
        <p class="hint">الاسم بيظهر في الترحيب بس.</p>
        <details class="card">
          <summary>عندك نسخة احتياطية؟ رجّعها بدل الإعداد</summary>
          <input class="field file" type="file" accept="application/json,.json" data-change="import-setup" />
          <p class="hint">ملفها اسمه بيبدأ بـ maznouq-backup. لو كان عليها رقم سري، هتعمل رقم جديد من الإعدادات.</p>
        </details>`;
    case 'cash':
      return `
        <div class="amt-circle">
          <input id="flow-amount" class="amt-input" inputmode="none" autocomplete="off" placeholder="0" value="${esc(draft.cash)}" data-autofocus ${draft.cash ? 'data-fresh="1"' : ''} />
          <span>ج.م</span>
        </div>
        <div class="keys">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => `<button type="button" class="key" data-key="${k}">${k === 'del' ? '⌫' : k}</button>`).join('')}
        </div>
        <p class="hint">الفلوس اللي في جيبك أو في البيت دلوقتي. مش معاك؟ سيبه صفر.</p>`;
    case 'wallets': case 'sources': case 'categories': case 'drawers': case 'bills':
      return multi(draft, step);
    case 'walletAmounts':
      return amounts('wallets', indexed('wallets'));
    case 'drawerAmounts':
      return amounts('drawers', indexed('drawers'));
    case 'billAmounts':
      return `<div class="row small"><span></span><span>المبلغ · يوم الدفع في الشهر</span></div>${amounts('bills', indexed('bills'), { day: true })}`;
    case 'people':
      return `
        ${draft.people.map((p, i) => `
          <div class="card">
            <div class="row"><input class="field grow" data-ob-pname="${i}" placeholder="الاسم" value="${esc(p.name)}" />
              <button class="linkbtn danger" data-do="ob-person-del" data-i="${i}">شيل</button></div>
            <input class="field" data-ob-pamt="${i}" inputmode="decimal" placeholder="المبلغ" value="${esc(p.amount)}" />
            <div class="seg">
              <button data-do="ob-side" data-i="${i}" data-side="him" class="${p.side !== 'me' ? 'on' : ''}">ليك عنده</button>
              <button data-do="ob-side" data-i="${i}" data-side="me" class="${p.side === 'me' ? 'on' : ''}">عليك له</button>
            </div>
          </div>`).join('')}
        <button class="btn2" data-do="ob-person-add">+ شخص</button>`;
    case 'jam': case 'lock':
      return circles([
        circle({ label: 'أيوه', inner: '✓', ring: 0, on: draft[step] === true, attrs: `data-do="ob-choose" data-q="${step}" data-value="yes"` }),
        circle({ label: 'لأ', inner: '✕', ring: 2, on: draft[step] === false, attrs: `data-do="ob-choose" data-q="${step}" data-value="no"` }),
      ]);
    case 'review': {
      const w = chosen(draft.wallets);
      const g = chosen(draft.drawers);
      const b = chosen(draft.bills);
      return `
        <div class="card">
          <div class="row"><b>${esc(draft.name)}</b><span></span></div>
          <div class="row"><span>الكاش</span><b>${money(egp(draft.cash))}</b></div>
          ${w.map((x) => `<div class="row small sub"><span>${esc(x.name)}</span><span>${money(egp(x.amount))}</span></div>`).join('')}
          ${g.length ? `<div class="row"><span>خزنتي</span><b>${money(g.reduce((s, x) => s + egp(x.amount), 0))}</b></div>
            ${g.map((x) => `<div class="row small sub"><span>${esc(x.name)}</span><span>${money(egp(x.amount))}</span></div>`).join('')}` : ''}
          <div class="row small"><span>مصادر الدخل</span><span>${chosen(draft.sources).map((x) => x.name).join('، ') || 'ولا واحد'}</span></div>
          <div class="row small"><span>أبواب الصرف</span><span>${chosen(draft.categories).length} باب</span></div>
          ${b.map((x) => `<div class="row small"><span>${esc(x.name)} يوم ${esc(x.day)}</span><span>${money(egp(x.amount))}</span></div>`).join('')}
          ${draft.people.map((p) => `<div class="row small"><span>${esc(p.name)}</span><span>${p.side === 'me' ? 'عليك له' : 'ليك عنده'} ${money(egp(p.amount))}</span></div>`).join('')}
        </div>
        <p class="hint">${[draft.jam ? 'بعدها هتفتحلك أسئلة الجمعية.' : '', draft.lock ? 'وبعدها اعمل الرقم السري من الإعدادات.' : ''].join(' ') || 'كل حاجة هنا تتعدّل بعدين.'}</p>
        <button class="btn" data-do="ob-finish">يلا نبدأ</button>`;
    }
    default: return '';
  }
}

// The button under the question: «التالي», and «مش دلوقتي» from the optional ones on.
function nav(step) {
  if (['jam', 'lock', 'review'].includes(step)) return '';
  const optional = ONBOARD_STEPS.indexOf(step) >= ONBOARD_STEPS.indexOf('drawers');
  return `
    <button class="btn" data-do="ob-next">التالي</button>
    ${optional && ['drawers', 'bills', 'people'].includes(step) ? '<button class="btn2" data-do="ob-skip">مش دلوقتي</button>' : ''}`;
}

export function onboardScreen(draft, step, flash = '') {
  const n = ONBOARD_STEPS.indexOf(step);
  const total = ONBOARD_STEPS.length - 1;
  return `
    <section class="phone flow onboard">
      <header class="top">
        <div class="toprow">
          ${n > 0 ? `<button class="backbtn" data-do="ob-back">${ICONS.back}<span>رجوع</span></button>` : '<span></span>'}
        </div>
        <p>إعداد مزنوق · ${n < total ? `سؤال ${n + 1} من ${total}` : 'آخر خطوة'}</p>
        <h1>${esc(TITLES[step])}</h1>
        <div class="obbar"><i style="width:${Math.round(((n + 1) * 100) / (total + 1))}%"></i></div>
      </header>
      <div class="body">
        ${note(flash)}
        ${HINTS[step] ? `<p class="hint">${HINTS[step]}</p>` : ''}
        ${stepBody(draft, step)}
        ${nav(step)}
      </div>
      ${footer()}
    </section>`;
}
