// الخزن والأدراج، والكاش والمحافظ.
import {
  esc, money, egpValue, bar, pick, placePick, amountCard, moreFields, item, page, retireButton, archivedBlock,
} from './common.js';
import { moneyPicture, safeSummary, cashOf, defaultPlace } from '../places.js';
import { borrowsOf, leftOf } from '../borrows.js';

const DRAWER_KINDS = [{ id: 'saving', name: 'تحويش بهدف' }, { id: 'other', name: 'درج عادي (صدقات، مصاريف...)' }];

export function safesScreen(ctx, p, flash) {
  const { d, book } = ctx;
  const pic = moneyPicture(d, book);
  return page({
    title: 'الخزن والأدراج', sub: `إجمالي الخزن: ${money(pic.safesTotal)}`, back: 'more', tab: 'more', flash, help: 'safes',
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
  const drawerRows = s.drawers.map((g) => item({
    go: g.kind === 'debt' && g.debtId ? 'debt' : 'drawer', params: { id: g.kind === 'debt' && g.debtId ? g.debtId : g.id },
    title: g.name, right: money(g.balance),
    percent: g.target ? Math.floor((g.balance * 100) / g.target) : null,
    sub: [g.target ? `الهدف ${money(g.target)}` : '', g.kind === 'debt' ? 'محجوز لدين' : ''].filter(Boolean).join(' · '),
  })).join('');
  return page({
    title: safe.name, sub: `في الخزنة: ${money(s.total)}`, back: 'safes', tab: 'more', flash, help: 'safe',
    body: `
      ${drawerRows || '<p class="hint">الخزنة فاضية. ضيف أدراجها تحت.</p>'}
      <button class="btn2" data-go="drawer-new" data-safe="${esc(safe.id)}">+ درج جديد في الخزنة دي</button>
      ${s.drawers.length ? `
      <details class="card" ${p.put ? 'open' : ''}>
        <summary>حط في الأدراج</summary>
        ${s.drawers.map((g) => `
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
      <label class="lbl">اسم الدرج</label>
      <input id="g-name" class="field" placeholder="مثلا: الصدقات" data-autofocus />
      <div class="lbl">النوع</div>
      ${pick('g-kind', DRAWER_KINDS, 'other')}
      <div class="lbl">في أنهي خزنة؟</div>
      ${pick('g-safe', d.safes, p.safe)}
      <label class="lbl">الهدف بالجنيه (اختياري)</label>
      <input id="g-target" class="field" inputmode="decimal" />
      <label class="lbl">ملحوظة عن الفلوس دي (اختياري)</label>
      <input id="g-note" class="field" />
      <label class="lbl">صورة للمكان (اختياري)</label>
      <input id="g-photo" class="field file" type="file" accept="image/*" capture="environment" />
      <p class="hint">المحجوز لدين بيتعمل من شاشة الدين نفسه.</p>
      <button class="btn" data-do="save-drawer">احفظ الدرج</button>`,
  });
}

export function drawerScreen(ctx, p, flash) {
  const { d, book, places } = ctx;
  const g = d.goals.find((x) => x.id === p.id);
  if (!g) return safesScreen(ctx, p, flash);
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
      <button class="btn" data-go="expense" data-from="${esc(g.accountId)}" data-back="home">اصرف من الدرج على طول</button>
      <button class="btn2" data-go="count" data-place="${esc(g.accountId)}" data-back="safes">عدّ اللي في الدرج</button>
      ${itOwes.map((b) => `<div class="card warn-card"><b>الدرج ده عليه ${money(leftOf(b))} لـ ${esc(name(b.fromId))}</b><button class="btn2" data-go="borrows">رجّع</button></div>`).join('')}
      ${owedToIt.map((b) => `<div class="card"><b>${esc(name(b.toId))} عليه ${money(leftOf(b))} للدرج ده</b></div>`).join('')}
      ${amountCard('حط أو اسحب كام؟', { quick: false, focus: false })}
      ${placePick(places, 'place', defaultPlace(d, places), { only: ['cash', 'wallet', 'drawer'], exclude: g.accountId })}
      ${moreFields(ctx.today)}
      <div class="row">
        <button class="btn grow" data-do="deposit-drawer" data-id="${esc(g.id)}">حط في الدرج</button>
        <button class="btn2 grow" data-do="withdraw-drawer" data-id="${esc(g.id)}">اسحب من الدرج</button>
      </div>
      ${g.photo ? `<img class="photo" src="${g.photo}" alt="صورة المكان" />` : ''}
      ${g.note ? `<p class="hint">${esc(g.note)}</p>` : ''}
      <details class="card">
        <summary>تعديل الدرج</summary>
        <label class="lbl">الاسم</label>
        <input id="g-name" class="field" value="${esc(g.name)}" />
        ${g.kind !== 'debt' ? `<div class="lbl">النوع</div>${pick('g-kind', DRAWER_KINDS, g.kind === 'saving' ? 'saving' : 'other')}` : ''}
        <div class="lbl">الخزنة</div>
        ${pick('g-safe', d.safes, g.safeId)}
        <label class="lbl">الهدف بالجنيه</label>
        <input id="g-target" class="field" inputmode="decimal" value="${egpValue(g.target)}" />
        <label class="lbl">ملحوظة</label>
        <input id="g-note" class="field" value="${esc(g.note)}" />
        <label class="lbl">${g.photo ? 'صوّر المكان تاني' : 'صورة للمكان'}</label>
        <input id="g-photo" class="field file" type="file" accept="image/*" capture="environment" />
        <button class="btn2" data-do="update-drawer" data-id="${esc(g.id)}">احفظ التعديل</button>
        ${retireButton('goal', g.id, 'الدرج')}
      </details>
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
