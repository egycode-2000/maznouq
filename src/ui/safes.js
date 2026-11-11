// الخزن والأدراج، والكاش والمحافظ.
import {
  esc, money, egpValue, bar, pick, placePick, amountCard, moreFields, item, page, retireButton, archivedBlock, calcBtn,
} from './common.js';
import { moneyPicture, safeSummary, cashOf, defaultPlace } from '../places.js';
import { borrowsOf, leftOf } from '../borrows.js';
import { showQty } from '../units.js';

// What a drawer holds: money, or something counted in a unit the user names (جرام دهب، دولار، سهم).
const HOLDS = [{ id: 'money', name: 'فلوس (جنيه)' }, { id: 'unit', name: 'حاجة تانية (دهب، دولار، أسهم...)' }];
const qtyValue = (q) => (q ? String(q / 1000) : '');

export function safesScreen(ctx, p, flash) {
  const { d, book } = ctx;
  const pic = moneyPicture(d, book);
  return page({
    title: 'الخزن والأدراج', sub: `إجمالي الخزن: ${money(pic.safesTotal)}`, back: p.back ?? 'more', tab: 'more', flash, help: 'safes',
    body: `
      ${pic.safes.map((s) => item({
        go: 'safe', params: { id: s.id }, title: s.name, right: money(s.total),
        sub: [s.note ? `المكان: ${s.note}` : '', `${s.drawers.length} أدراج`].filter(Boolean).join(' · '),
      })).join('') || '<p class="hint">مفيش خزن لسه. الخزنة مكان بتشيل فيه فلوس، وجواها أدراج.</p>'}
      <div class="card">
        <div class="lbl">خزنة جديدة</div>
        <input id="sf-name" class="field" placeholder="مثلا: خزنة البيت أو درج العربية" />
        <input id="sf-note" class="field" placeholder="فين بالظبط؟ (اختياري)" />
        <button class="btn" data-do="add-safe">اعمل الخزنة</button>
      </div>
      ${archivedBlock(ctx.archived, 'safe', 'خزن ملغية')}`,
  });
}

export function safeScreen(ctx, p, flash) {
  const { d, book, places } = ctx;
  const safe = d.safes.find((s) => s.id === p.id);
  if (!safe) return safesScreen(ctx, p, flash);
  const s = safeSummary(d, book, safe);
  const drawerRows = s.drawers.map((g) => (g.units ? item({
    go: 'drawer', params: { id: g.id }, title: g.name, right: `${showQty(g.units.qty)} ${g.unit}`,
    percent: g.units.percent,
    sub: [`اتدفع فيهم ${money(g.units.cost)}`, g.units.target ? `الهدف ${showQty(g.units.target)} ${g.unit}` : '', 'مش داخل في إجمالي الخزنة'].filter(Boolean).join(' · '),
  }) : item({
    go: g.kind === 'debt' && g.debtId ? 'debt' : 'drawer', params: { id: g.kind === 'debt' && g.debtId ? g.debtId : g.id },
    title: g.name, right: money(g.balance),
    percent: g.target ? Math.floor((g.balance * 100) / g.target) : null,
    sub: [g.target ? `الهدف ${money(g.target)}` : '', g.kind === 'debt' ? 'محجوز لدين' : ''].filter(Boolean).join(' · '),
  }))).join('');
  const moneyDrawers = s.drawers.filter((g) => !g.units);
  return page({
    title: safe.name, sub: `في الخزنة: ${money(s.total)}`, back: 'safes', tab: 'more', flash, help: 'safe',
    body: `
      ${drawerRows || '<p class="hint">الخزنة فاضية. ضيف أدراجها تحت.</p>'}
      <button class="btn2" data-go="drawer-new" data-safe="${esc(safe.id)}">+ درج جديد في الخزنة دي</button>
      ${moneyDrawers.length ? `
      <details class="card" ${p.put ? 'open' : ''}>
        <summary>حط في الأدراج</summary>
        ${moneyDrawers.map((g) => `
          <div class="split-row" data-kind="drawer">
            <span class="split-name"><b>${esc(g.name)}</b><small>فيه ${money(g.balance)}</small></span>
            <input class="field split-val put-val" id="put-${esc(g.accountId)}" data-target="${esc(g.accountId)}" inputmode="decimal" placeholder="0" />
          </div>`).join('')}
        <b id="put-total"></b>
        <div class="lbl">الفلوس دي جاية منين؟</div>
        ${placePick(places, 'put-from', cashOf(d)?.id, { only: ['cash', 'wallet'] })}
        <label class="check"><input type="checkbox" id="put-outside" /> من بره (فلوس جديدة، تتسجل دخل)</label>
        <input id="put-payer" class="field" placeholder="من مين؟ (لو من بره)" />
        ${moreFields(ctx.today, { date: 'put-date', noteId: 'put-note' })}
        <button class="btn" data-do="put-drawers" data-id="${esc(safe.id)}">حط</button>
      </details>` : ''}
      <details class="card">
        <summary>تعديل الخزنة</summary>
        <input id="sfe-name" class="field" value="${esc(safe.name)}" />
        <input id="sfe-note" class="field" value="${esc(safe.note ?? '')}" placeholder="فين بالظبط؟" />
        <button class="btn2" data-do="save-safe" data-id="${esc(safe.id)}">احفظ</button>
        ${retireButton('safe', safe.id, 'الخزنة')}
      </details>
      ${archivedBlock(ctx.archived, 'goal', 'أدراج ملغية')}`,
  });
}

export function drawerNewScreen(ctx, p, flash) {
  const { d } = ctx;
  return page({
    title: 'درج جديد', back: 'safe', backParams: { id: p.safe ?? '' }, tab: 'more', flash, help: 'drawer',
    body: `
      <label class="lbl">اسم الدرج (سمّيه زي ما تحب)</label>
      <input id="g-name" class="field" placeholder="مثلا: الصدقات، العربية، دهب" data-autofocus />
      <div class="lbl">في أنهي خزنة؟</div>
      ${pick('g-safe', d.safes, p.safe)}
      <div class="lbl">هتشيل فيه إيه؟</div>
      ${pick('g-holds', HOLDS, 'money')}
      <label class="lbl">لو حاجة تانية: اسم الوحدة</label>
      <input id="g-unit" class="field" placeholder="مثلا: جرام دهب، دولار، سهم" />
      <label class="lbl">ليه هدف؟ اكتبه (أو سيبه فاضي لو مالوش هدف)</label>
      <input id="g-target" class="field" inputmode="decimal" placeholder="بالجنيه، أو بعدد الوحدات لو حاجة تانية" />
      <label class="lbl">ملحوظة (اختياري)</label>
      <input id="g-note" class="field" />
      <label class="lbl">صورة للمكان (اختياري)</label>
      <input id="g-photo" class="field file" type="file" accept="image/*" capture="environment" />
      <p class="hint">الدرج اللي مالوش هدف (زي الصدقات) لما تصرف منه بيتسجل باسمه على طول. المحجوز لدين بيتعمل من شاشة الدين نفسه.</p>
      <button class="btn" data-do="save-drawer">احفظ الدرج</button>`,
  });
}

// Editing a drawer: the same fields for both kinds.
function drawerEdit(ctx, g) {
  const { d } = ctx;
  return `
      <details class="card">
        <summary>تعديل الدرج</summary>
        <label class="lbl">الاسم</label>
        <input id="g-name" class="field" value="${esc(g.name)}" />
        <div class="lbl">الخزنة</div>
        ${pick('g-safe', d.safes, g.safeId)}
        <label class="lbl">${g.unit ? `الهدف (كام ${esc(g.unit)})` : 'الهدف بالجنيه'} · سيبه فاضي لو مالوش هدف</label>
        <input id="g-target" class="field" inputmode="decimal" value="${g.unit ? qtyValue(g.targetQty) : egpValue(g.target)}" />
        <label class="lbl">ملحوظة</label>
        <input id="g-note" class="field" value="${esc(g.note)}" />
        <label class="lbl">${g.photo ? 'صوّر المكان تاني' : 'صورة للمكان'}</label>
        <input id="g-photo" class="field file" type="file" accept="image/*" capture="environment" />
        <button class="btn2" data-do="update-drawer" data-id="${esc(g.id)}">احفظ التعديل</button>
        ${retireButton('goal', g.id, 'الدرج')}
      </details>`;
}

// A drawer that holds units: what is in it, what was paid for it, and buying and selling.
function unitDrawerScreen(ctx, g, flash) {
  const { d, book, places } = ctx;
  const safe = safeSummary(d, book, d.safes.find((s) => s.id === g.safeId) ?? { id: g.safeId });
  const u = safe.drawers.find((x) => x.id === g.id).units;
  return page({
    title: g.name, sub: `في الدرج: ${showQty(u.qty)} ${g.unit}${u.target ? ` من ${showQty(u.target)}` : ''}`,
    back: 'safe', backParams: { id: g.safeId }, tab: 'more', flash, help: 'drawer-unit',
    body: `
      <div class="card">
        ${u.percent === null ? '' : bar(u.percent)}
        <div class="row"><span>اللي في الدرج</span><b>${showQty(u.qty)} ${esc(g.unit)}</b></div>
        <div class="row"><span>اتدفع فيهم</span><b>${money(u.cost)}</b></div>
        ${u.qty ? `<div class="row small"><span>متوسط الـ ${esc(g.unit)}</span><span>${money(u.avg)}</span></div>` : ''}
        <p class="hint">ده مش داخل في «إجمالي فلوسك»، بيتكتب لوحده بالكمية.</p>
      </div>
      <div class="card">
        <div class="lbl">اشتريت</div>
        <input id="ub-qty" class="field" inputmode="decimal" placeholder="كام ${esc(g.unit)}؟" />
        <div class="amount-row"><input id="ub-paid" class="field grow" inputmode="decimal" placeholder="دفعت كام بالجنيه؟" />${calcBtn('ub-paid')}</div>
        <div class="lbl">دفعت منين؟</div>
        ${placePick(places, 'ub-place', defaultPlace(d, places), { only: ['cash', 'wallet', 'drawer'] })}
        <button class="btn" data-do="buy-units" data-id="${esc(g.id)}">سجّل الشراء</button>
      </div>
      ${u.qty ? `
      <details class="card">
        <summary>بعت</summary>
        <input id="us-qty" class="field" inputmode="decimal" placeholder="بعت كام ${esc(g.unit)}؟" />
        <div class="amount-row"><input id="us-got" class="field grow" inputmode="decimal" placeholder="قبضت كام بالجنيه؟" />${calcBtn('us-got')}</div>
        <div class="lbl">الفلوس دخلت فين؟</div>
        ${placePick(places, 'us-place', cashOf(d)?.id, { only: ['cash', 'wallet', 'drawer'] })}
        <button class="btn2" data-do="sell-units" data-id="${esc(g.id)}">سجّل البيع</button>
        <p class="hint">البرنامج بيقولك كسبت ولا خسرت، بالمقارنة بمتوسط اللي دفعته.</p>
      </details>` : ''}
      ${g.photo ? `<img class="photo" src="${g.photo}" alt="صورة المكان" />` : ''}
      ${g.note ? `<p class="hint">${esc(g.note)}</p>` : ''}
      ${drawerEdit(ctx, g)}
      <p class="hint">لو سجّلت شراء أو بيع غلط، اعكسه من المزيد ← سجل الحركات.</p>`,
  });
}

export function drawerScreen(ctx, p, flash) {
  const { d, places } = ctx;
  const g = d.goals.find((x) => x.id === p.id);
  if (!g) return safesScreen(ctx, p, flash);
  if (g.unit) return unitDrawerScreen(ctx, g, flash);
  const here = places.find((x) => x.id === g.accountId);
  const bal = here?.balance ?? 0;
  const safe = d.safes.find((s) => s.id === g.safeId);
  const name = (id) => places.find((x) => x.id === id)?.name ?? 'مكان ملغي';
  const { owedToIt, itOwes } = borrowsOf(d, g.accountId);
  return page({
    title: g.name, sub: `في الدرج: ${money(bal)}${g.target ? ` من ${money(g.target)}` : ''}`,
    back: 'safe', backParams: { id: g.safeId }, tab: 'more', flash, help: 'drawer',
    body: `
      ${g.target ? `<div class="card">${bar(Math.floor((bal * 100) / g.target))}</div>` : ''}
      ${owedToIt.map((b) => `
        <div class="card warn-card">
          <b>${b.toId ? `${esc(name(b.toId))} عليه ${money(leftOf(b))} للدرج ده` : `خدت من الدرج ده ${money(leftOf(b))} وقلت هترجّعهم`}</b>
          <button class="btn2" data-go="borrows" data-back="home">رجّع</button>
        </div>`).join('')}
      ${itOwes.map((b) => `<div class="card warn-card"><b>الدرج ده عليه ${money(leftOf(b))} لـ ${esc(name(b.fromId))}</b><button class="btn2" data-go="borrows" data-back="home">رجّع</button></div>`).join('')}
      <button class="btn" data-go="expense" data-from="${esc(g.accountId)}">اصرف من الدرج</button>
      <button class="btn2" data-go="count" data-place="${esc(g.accountId)}" data-back="safes">عدّ اللي في الدرج</button>
      ${amountCard('حط أو اسحب كام؟', { quick: false, focus: false })}
      ${placePick(places, 'place', defaultPlace(d, places), { only: ['cash', 'wallet', 'drawer'], exclude: g.accountId })}
      ${moreFields(ctx.today)}
      <div class="row">
        <button class="btn grow" data-do="deposit-drawer" data-id="${esc(g.id)}">حط في الدرج</button>
        <button class="btn2 grow" data-do="withdraw-drawer" data-id="${esc(g.id)}">اسحب من الدرج</button>
      </div>
      ${g.photo ? `<img class="photo" src="${g.photo}" alt="صورة المكان" />` : ''}
      ${g.note ? `<p class="hint">${esc(g.note)}</p>` : ''}
      ${drawerEdit(ctx, g)}
      ${safe ? '' : '<p class="hint">الخزنة بتاعة الدرج ده اتلغت.</p>'}`,
  });
}

// ---------- Cash and wallets ----------
export function walletsScreen(ctx, p, flash) {
  const { d, places } = ctx;
  const cash = cashOf(d);
  const balanceOfPlace = (id) => places.find((x) => x.id === id)?.balance ?? 0;
  return page({
    title: 'الكاش والمحافظ', back: 'more', tab: 'more', flash, help: 'wallets',
    body: `
      <div class="card">
        <div class="row"><b>الكاش (في جيبك)</b><b>${money(balanceOfPlace(cash.id))}</b></div>
        <input class="field" id="wn-${esc(cash.id)}" value="${esc(cash.name)}" />
      </div>
      ${d.wallets.filter((w) => w !== cash).map((w) => `
        <div class="card">
          <div class="row"><input class="field grow" id="wn-${esc(w.id)}" value="${esc(w.name)}" /><b>${money(balanceOfPlace(w.id))}</b></div>
          <div class="row"><span>خصم السحب كاش %</span><input class="field small-field" id="wf-${esc(w.id)}" inputmode="decimal" value="${w.feePct || ''}" placeholder="0" /></div>
          <div class="row">
            <button class="linkbtn" data-go="transfer" data-from="${esc(w.id)}" data-to="${esc(cash.id)}" data-back="wallets">اسحب كاش</button>
            <button class="linkbtn" data-go="count" data-place="${esc(w.id)}" data-back="wallets">طابق الرصيد</button>
            <button class="linkbtn danger" data-do="retire" data-kind="wallet" data-id="${esc(w.id)}">إلغاء</button>
          </div>
        </div>`).join('')}
      <button class="btn2" data-do="save-wallets">احفظ الأسماء ونسب الخصم</button>
      ${archivedBlock(ctx.archived, 'wallet', 'محافظ ملغية')}
      <div class="card">
        <div class="lbl">محفظة جديدة</div>
        <input id="nw-name" class="field" placeholder="مثلا: إنستاباي" />
        <input id="nw-open" class="field" inputmode="decimal" placeholder="الرصيد الحالي بالجنيه" />
        <input id="nw-fee" class="field" inputmode="decimal" placeholder="خصم السحب كاش % (اختياري)" />
        <button class="btn" data-do="add-wallet">ضيف المحفظة</button>
      </div>
      <p class="hint">الرصيد بيتغير بالحركات بس، عشان الحساب يفضل مظبوط.</p>`,
  });
}
