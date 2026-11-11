// Money in and out: expense, income, transfer, split, saved splits (daily too), the log, borrows,
// budgets and spending categories.
import {
  esc, money, egpValue, bar, pick, placePick, amountCard, moreFields, noteField, dateField, item, page,
  retireButton, archivedBlock, photoBtn,
} from './common.js';
import { incomeFrom, spentIn, openBorrows, monthTotals } from '../reports.js';
import { pendingDays, dailyTotal } from '../daily.js';
import { logRows } from '../log.js';
import { leftOf } from '../borrows.js';
import { cashOf, defaultPlace } from '../places.js';
import { showDate } from '../format.js';

// «دخل متفرق» is always offered for money with no regular source (a gift, money found, ...).
export const MISC_SOURCE = { id: 's-misc', name: 'دخل متفرق' };
export const OUTSIDE = '__outside';

function sourcesWithMisc(ctx) {
  const known = [...ctx.d.sources, ...(ctx.archived?.source ?? [])].some((s) => s.id === MISC_SOURCE.id);
  return known ? ctx.d.sources : [...ctx.d.sources, MISC_SOURCE];
}

const lastPlace = (ctx) => defaultPlace(ctx.d, ctx.places);

// ---------- Expense ----------
export function expenseScreen(ctx, p, flash) {
  const { d, places } = ctx;
  const from = p.from ?? lastPlace(ctx);
  const cats = d.categories.length
    ? pick('category', d.categories, d.settings.lastCategory)
    : '<p class="hint">مفيش أوجه صرف. ضيف من المزيد ← أوجه الصرف.</p><input type="hidden" id="category" value="" />';
  return page({
    title: 'مصروف جديد', sub: 'المبلغ، على إيه، ومنين. وخلاص', back: p.back ?? 'home', flash, help: 'expense',
    body: `
      ${amountCard('صرفت كام؟')}
      <div class="lbl">على إيه؟</div>
      ${cats}
      <div class="lbl">منين؟</div>
      ${placePick(places, 'from', from)}
      <div class="card warn-card" id="cover" hidden>
        <b id="cover-text"></b>
        <span class="hint">تكمّلهم منين؟</span>
        ${placePick(places, 'cover', cashOf(d)?.id)}
        <label class="check"><input type="checkbox" id="cover-back" checked /> هرجّعهم للمكان ده بعدين (سلفة)</label>
      </div>
      ${moreFields(ctx.today)}
      <button class="btn" data-do="save-expense">سجّل المصروف</button>
      <button class="btn2" data-do="save-expense-more">سجّل وأضيف مصروف تاني</button>`,
  });
}

// ---------- Income ----------
export function incomeScreen(ctx, p, flash) {
  const { d, book, month } = ctx;
  const total = monthTotals(book, month).income;
  const sources = d.sources.map((s) => `
    <div class="card">
      <div class="row"><b>${esc(s.name)}</b><b>${money(incomeFrom(book, s.id, month))}</b></div>
      <span class="hint">${s.kind === 'monthly' ? 'شهري' : 'مفتوح'} · دخل الشهر ده</span>
      <div class="row">
        <button class="btn2 grow" data-go="income-new" data-id="${esc(s.id)}">+ سجّل دخل</button>
        <button class="linkbtn" data-go="source-edit" data-id="${esc(s.id)}">تعديل</button>
      </div>
    </div>`).join('');
  return page({
    title: 'الدخل', sub: `دخل الشهر ده: ${money(total)}`, back: 'more', tab: 'more', flash, help: 'income',
    body: `
      ${sources || '<p class="hint">مفيش مصادر لسه.</p>'}
      <button class="btn2" data-go="source-new">+ مصدر دخل جديد</button>
      ${archivedBlock(ctx.archived, 'source', 'مصادر ملغية')}
      <p class="hint">السداد من الناس وقبض الجمعية مش دخل، بس بيزوّدوا المكان اللي استلمت فيه.</p>`,
  });
}

export function incomeNewScreen(ctx, p, flash) {
  const { d, places } = ctx;
  return page({
    title: 'دخل جديد', back: 'home', flash, help: 'income-new',
    body: `
      ${amountCard('دخلك كام؟')}
      <div class="lbl">من أنهي مصدر؟</div>
      ${pick('sourceId', sourcesWithMisc(ctx), p.id ?? d.settings.lastSource)}
      <div class="lbl">دخلت فين؟</div>
      ${placePick(places, 'to', p.to ?? cashOf(d)?.id)}
      <input id="payer" class="field" placeholder="مين دفع؟ (اختياري)" />
      ${moreFields(ctx.today)}
      <button class="btn" data-do="save-income">سجّل الدخل</button>
      <button class="btn2" data-do="save-income-more">سجّل وأضيف دخل تاني</button>`,
  });
}

const KIND_OPTIONS = [{ id: 'monthly', name: 'شهري' }, { id: 'open', name: 'مفتوح' }];

export function sourceNewScreen(ctx, p, flash) {
  return page({
    title: 'مصدر دخل جديد', back: 'income', tab: 'more', flash,
    body: `
      <label class="lbl">اسم المصدر</label>
      <input id="src-name" class="field" placeholder="مثلا: السنتر" data-autofocus />
      <div class="lbl">النوع</div>
      ${pick('src-kind', KIND_OPTIONS, 'monthly')}
      <button class="btn" data-do="save-source">احفظ المصدر</button>`,
  });
}

export function sourceEditScreen(ctx, p, flash) {
  const s = ctx.d.sources.find((x) => x.id === p.id);
  if (!s) return incomeScreen(ctx, p, flash);
  return page({
    title: 'تعديل مصدر الدخل', back: 'income', tab: 'more', flash,
    body: `
      <label class="lbl">اسم المصدر</label>
      <input id="src-name" class="field" value="${esc(s.name)}" />
      <div class="lbl">النوع</div>
      ${pick('src-kind', KIND_OPTIONS, s.kind)}
      <p class="hint">التعديل بيغيّر الاسم في كل الحركات القديمة كمان.</p>
      <button class="btn" data-do="save-source-edit" data-id="${esc(s.id)}">احفظ التعديل</button>
      ${retireButton('source', s.id, 'المصدر')}`,
  });
}

// ---------- Transfer and withdrawing cash ----------
export function transferScreen(ctx, p, flash) {
  const { d, places } = ctx;
  if (places.length < 2) {
    return page({
      title: 'تحويل', back: 'home', flash, help: 'transfer',
      body: '<p class="hint">التحويل محتاج مكانين على الأقل.</p><button class="btn2" data-go="wallets">ضيف محفظة</button>',
    });
  }
  const cash = cashOf(d);
  const from = p.from ?? places.find((x) => x.kind === 'wallet')?.id ?? places[0].id;
  const to = p.to ?? (from === cash?.id ? places.find((x) => x.id !== from)?.id : cash?.id);
  return page({
    title: 'تحويل وسحب كاش', sub: 'نقل بين أماكنك، مش صرف', back: p.back ?? 'home', flash, help: 'transfer',
    body: `
      ${amountCard('هتحوّل كام؟', { quick: false })}
      <div class="lbl">من</div>
      ${placePick(places, 'from', from)}
      <div class="lbl">إلى</div>
      ${placePick(places, 'to', to)}
      <div class="card">
        <label class="lbl" for="fee">الخصم (رسوم التحويل)</label>
        <input id="fee" class="field" inputmode="decimal" placeholder="0" />
        <span class="hint" id="fee-hint">لو محفظة ليها نسبة خصم وإنت بتسحب كاش، الخصم بيتكتب لوحده وتقدر تغيّره.</span>
        <b id="arrive"></b>
      </div>
      <label class="check"><input type="checkbox" id="tr-borrow" /> سلفة هترجع للمكان اللي خدت منه</label>
      ${moreFields(ctx.today)}
      <button class="btn" data-do="save-transfer">حوّل</button>`,
  });
}

// ---------- Split (وزّع) ----------
function splitRows(ctx, values) {
  const { d, book, places } = ctx;
  const row = (id, name, sub, kind) => {
    const t = values[id] ?? { mode: 'amt', value: '' };
    return `
      <div class="split-row" data-kind="${kind}">
        <span class="split-name"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
        <input class="field split-val" id="sp-${esc(id)}" data-target="${esc(id)}" inputmode="decimal" placeholder="0" value="${esc(t.value || '')}" />
        <button type="button" class="chip mode" data-splitmode="${esc(id)}">${t.mode === 'pct' ? '%' : 'ج.م'}</button>
        <input type="hidden" id="spm-${esc(id)}" value="${t.mode === 'pct' ? 'pct' : 'amt'}" />
      </div>`;
  };
  const drawers = places.filter((x) => x.kind === 'drawer');
  const bySafe = d.safes.map((s) => {
    const rows = drawers.filter((x) => x.safeId === s.id).map((x) => row(x.id, x.name, `فيه ${money(x.balance)}`, 'drawer')).join('');
    return rows ? `<div class="sect">${esc(s.name)}</div><div class="card">${rows}</div>` : '';
  }).join('');
  const usedCats = d.categories.some((c) => values[c.id]?.value);
  return `
    ${bySafe || '<p class="hint">مفيش أدراج لسه. اعمل خزنة وأدراجها من المزيد ← الخزن.</p>'}
    <details class="card" ${usedCats ? 'open' : ''}>
      <summary>مصروف على طول (زي الصدقات اللي بتطلعها في ساعتها)</summary>
      ${d.categories.map((c) => row(c.id, c.name, 'بيتسجل مصروف على طول', 'expense')).join('') || '<p class="hint">مفيش أوجه صرف.</p>'}
    </details>`;
}

export function splitScreen(ctx, p, flash) {
  const { d, places } = ctx;
  const tpl = d.templates.find((t) => t.id === p.tpl) ?? null;
  const values = Object.fromEntries((tpl?.rows ?? []).map((r) => [r.target, r]));
  const from = p.from ?? tpl?.sourceId ?? cashOf(d)?.id;
  const amount = p.amount ?? '';
  const saved = d.templates.filter((t) => !t.daily);
  return page({
    title: 'وزّع الفلوس', sub: 'رقم أو نسبة قصاد كل درج', back: p.back ?? 'home', flash, help: 'split',
    body: `
      ${saved.length ? `
      <div class="lbl">تقسيمة محفوظة</div>
      <div class="chips">${saved.map((t) => `<button type="button" class="chip ${t.id === tpl?.id ? 'on' : ''}" data-go="split" data-tpl="${esc(t.id)}" data-amount="${esc(amount)}" data-back="${esc(p.back ?? 'home')}">${esc(t.name)}</button>`).join('')}</div>` : ''}
      ${amountCard('المبلغ اللي هتوزّعه', { id: 'split-amount', value: amount, quick: false })}
      <div class="lbl">الفلوس جاية منين؟</div>
      ${placePick(places, 'split-from', from, { only: ['cash', 'wallet', 'drawer'] })}
      <label class="check"><input type="checkbox" id="split-outside" ${p.outside ? 'checked' : ''} /> فلوس جديدة من بره (تتسجل دخل)</label>
      <input id="split-payer" class="field" placeholder="من مين؟ (لو من بره)" />
      ${splitRows(ctx, values)}
      <div class="card split-summary" id="split-summary"></div>
      <input id="split-save-name" class="field" placeholder="احفظها كتقسيمة باسم (اختياري)" value="${esc(tpl && !tpl.daily ? tpl.name : '')}" />
      ${noteField('split-note')}
      <button class="btn" data-do="do-split" data-tpl="${esc(tpl?.id ?? '')}">وزّع</button>
      <button class="btn2" data-go="${esc(p.back ?? 'home')}">تخطّي</button>`,
  });
}

// ---------- Saved splits and the daily split ----------
export function templatesScreen(ctx, p, flash) {
  const { d, today } = ctx;
  const rows = d.templates.map((t) => item({
    go: 'template', params: { id: t.id }, title: t.name,
    right: t.daily ? `${money(dailyTotal(t))} كل يوم` : 'تقسيمة',
    sub: t.daily ? (t.active ? (pendingDays(t, today) ? `مستني ${pendingDays(t, today)} يوم` : 'اتأكدت النهارده') : 'موقّفة') : `${t.rows.length} سطور`,
  })).join('');
  return page({
    title: 'التقسيمات', back: 'more', tab: 'more', flash, help: 'templates',
    body: `${rows || '<p class="hint">مفيش تقسيمات لسه.</p>'}
      <button class="btn" data-go="template" data-daily="1">+ تقسيم يومي</button>
      <button class="btn2" data-go="template">+ تقسيمة عادية</button>`,
  });
}

export function templateScreen(ctx, p, flash) {
  const { d, places, today } = ctx;
  const t = d.templates.find((x) => x.id === p.id) ?? null;
  const daily = t ? t.daily : Boolean(p.daily);
  const values = Object.fromEntries((t?.rows ?? []).map((r) => [r.target, r]));
  return page({
    title: t ? t.name : (daily ? 'تقسيم يومي جديد' : 'تقسيمة جديدة'), back: 'templates', tab: 'more', flash, help: 'templates',
    body: `
      <label class="lbl">الاسم</label>
      <input id="tp-name" class="field" value="${esc(t?.name ?? '')}" placeholder="${daily ? 'مثلا: يومي العربية' : 'مثلا: دخل السنتر'}" />
      <label class="check"><input type="checkbox" id="tp-daily" ${daily ? 'checked' : ''} /> كل يوم (يسألني كل يوم حطيت ولا لأ)</label>
      <div class="lbl">بتتسحب منين؟</div>
      ${placePick(places, 'tp-source', t?.sourceId ?? cashOf(d)?.id, { only: ['cash', 'wallet'] })}
      ${!t ? `<label class="lbl">تبدأ من يوم</label>${dateField(today, 'tp-start')}` : ''}
      <p class="hint">${daily ? 'التقسيم اليومي بالمبلغ بس.' : 'تقدر تكتب مبلغ أو نسبة من المبلغ اللي هتوزّعه.'}</p>
      ${splitRows(ctx, values)}
      ${t ? `<label class="check"><input type="checkbox" id="tp-active" ${t.active ? 'checked' : ''} /> شغالة</label>` : ''}
      <button class="btn" data-do="save-template" data-id="${esc(t?.id ?? '')}">احفظ</button>
      ${t ? '<button class="linkbtn danger" data-do="delete-template" data-id="' + esc(t.id) + '">امسح التقسيمة</button><p class="hint">مسح التقسيمة مش بيمسح الفلوس اللي اتوزّعت بيها.</p>' : ''}`,
  });
}

export function dailyScreen(ctx, p, flash) {
  const { d, places, today } = ctx;
  const t = d.templates.find((x) => x.id === p.id);
  if (!t) return templatesScreen(ctx, p, flash);
  const days = Math.max(1, pendingDays(t, today));
  const name = (target) => places.find((x) => x.id === target)?.name ?? d.categories.find((c) => c.id === target)?.name ?? 'محذوف';
  return page({
    title: `تقسيم النهارده: ${t.name}`, sub: days > 1 ? `فاتك ${days} أيام` : 'علّم اللي حطيته فعلا', back: 'home', flash, help: 'daily',
    body: `
      <div class="card">
        ${t.rows.map((r, i) => `
          <label class="check-row">
            <input type="checkbox" id="dy-on-${i}" checked />
            <span class="grow">${esc(name(r.target))}</span>
            <input class="field split-val" id="dy-val-${i}" inputmode="decimal" value="${r.value * days}" />
          </label>`).join('')}
      </div>
      <div class="lbl">اتسحبت منين؟</div>
      ${placePick(places, 'dy-from', t.sourceId ?? cashOf(d)?.id, { only: ['cash', 'wallet'] })}
      ${noteField('dy-note')}
      <button class="btn" data-do="confirm-daily" data-id="${esc(t.id)}">أكّد</button>
      <button class="btn2" data-do="skip-daily" data-id="${esc(t.id)}">ماحطيتش حاجة، اتخطى ${days > 1 ? 'الأيام دي' : 'النهارده'}</button>
      <p class="hint">اللي مش متعلّم مش هيتخصم من الكاش.</p>`,
  });
}

// ---------- Log ----------
export function logScreen(ctx, p, flash) {
  const { book } = ctx;
  const rows = logRows(book, { search: p.q ?? '', month: p.m ?? '' }).slice(0, 300);
  return page({
    title: 'سجل الحركات', sub: 'الأحدث فوق', back: 'more', tab: 'more', flash, help: 'log',
    body: `
      <div class="card">
        <input id="log-q" class="field" placeholder="دوّر بكلمة أو مبلغ أو ملحوظة" value="${esc(p.q ?? '')}" />
        <input id="log-m" class="field" type="month" value="${esc(p.m ?? '')}" />
        <button class="btn2" data-do="log-search">دوّر</button>
      </div>
      ${rows.map((r) => `
        <div class="card logrow ${r.reversal ? 'muted' : ''}">
          <div class="row"><b>${esc(r.memo)}</b><b>${money(r.amount)}</b></div>
          <div class="row small"><span>${showDate(r.date)}</span><span>${esc(r.from.join('، '))} ← ${esc(r.to.join('، '))}</span></div>
          ${r.note ? `<span class="hint">ملحوظة: ${esc(r.note)}</span>` : ''}
          ${photoBtn(ctx.d, r.id)}
          ${r.undo.can ? `<button class="linkbtn danger" data-do="undo-entry" data-id="${esc(r.id)}">اعكس الحركة دي</button>` : `<span class="hint">${esc(r.undo.why)}</span>`}
        </div>`).join('') || '<p class="hint">مفيش حركات.</p>'}`,
  });
}

// ---------- Borrows between your places ----------
export function borrowsScreen(ctx, p, flash) {
  const { d, places } = ctx;
  const name = (id) => places.find((x) => x.id === id)?.name ?? 'مكان ملغي';
  const open = openBorrows(d);
  const done = d.borrows.filter((b) => leftOf(b) <= 0);
  return page({
    title: 'السلف بين أماكنك', back: 'more', tab: 'more', flash, help: 'borrows',
    body: `
      ${open.map((b) => `
        <div class="card">
          <div class="row"><b>${esc(name(b.toId))} عليه لـ ${esc(name(b.fromId))}</b><b>${money(leftOf(b))}</b></div>
          <span class="hint">من ${showDate(b.date)}${b.note ? ` · ${esc(b.note)}` : ''}${b.repaid ? ` · رجع منها ${money(b.repaid)}` : ''}</span>
          <div class="row">
            <input class="field grow" id="br-${esc(b.id)}" inputmode="decimal" value="${egpValue(leftOf(b))}" />
            <button class="btn2" data-do="repay-borrow" data-id="${esc(b.id)}">رجّع</button>
          </div>
        </div>`).join('') || '<p class="hint">مفيش سلف مفتوحة.</p>'}
      ${done.length ? `<details class="card"><summary>سلف رجعت (${done.length})</summary>
        ${done.map((b) => `<div class="row small"><span>${esc(name(b.toId))} ← ${esc(name(b.fromId))} · ${showDate(b.date)}</span><span>${money(b.amount)}</span></div>`).join('')}
      </details>` : ''}`,
  });
}

// ---------- Budgets and spending categories ----------
export function budgetsScreen(ctx, p, flash) {
  const { d, book, month } = ctx;
  const rows = d.categories.map((c) => {
    const limit = d.budgets[c.id] ?? 0;
    const spent = spentIn(book, c.id, month);
    return `
      <div class="card">
        <div class="row"><b>${esc(c.name)}</b><span class="${limit && spent > limit ? 'neg' : ''}">${money(spent)}${limit ? ` من ${money(limit)}` : ''}</span></div>
        ${limit ? bar(Math.floor((spent * 100) / limit)) : ''}
        <input class="field" inputmode="decimal" id="bud-${esc(c.id)}" placeholder="الحد الشهري بالجنيه" value="${egpValue(limit)}" />
      </div>`;
  }).join('');
  return page({
    title: 'الميزانية', sub: 'حد لكل وجه صرف في الشهر', back: 'more', tab: 'more', flash, help: 'budgets',
    body: `${rows || '<p class="hint">مفيش أوجه صرف.</p>'}<button class="btn" data-do="save-budgets">احفظ الميزانية</button>`,
  });
}

export function categoriesScreen(ctx, p, flash) {
  const { d } = ctx;
  return page({
    title: 'أوجه الصرف', back: 'more', tab: 'more', flash, help: 'categories',
    body: `
      <div class="card">
        ${d.categories.map((c) => `
          <div class="row">
            <input class="field grow" id="cn-${esc(c.id)}" value="${esc(c.name)}" />
            <button class="linkbtn danger" data-do="retire" data-kind="category" data-id="${esc(c.id)}">إلغاء</button>
          </div>`).join('')}
        ${d.categories.length ? '<button class="btn2" data-do="save-categories">احفظ الأسماء</button>' : '<p class="hint">مفيش أوجه صرف.</p>'}
        <p class="hint">اللي عليه مصاريف بيختفي بس، ومصاريفه تفضل محسوبة.</p>
      </div>
      ${archivedBlock(ctx.archived, 'category', 'أوجه صرف ملغية')}
      <div class="card">
        <div class="lbl">وجه صرف جديد</div>
        <input id="cat-new" class="field" placeholder="مثلا: بنزين" />
        <button class="btn" data-do="add-category">ضيف</button>
      </div>`,
  });
}
