// Reviewing what was recorded: «مراجعة النهارده» (one day, line by line) and the statement of one spending
// category (كشف وجه الصرف). Every number comes from reports.js (dayReport, categoryStatement, limitStatus).
import { esc, money, limitBar, page, photoBtn } from './common.js';
import { dayReport, categoryStatement, categoryMonths, categoryStatementText } from '../reports.js';
import { showDate, showMonth, formatMoney } from '../format.js';
import { addMonths } from '../obligations.js';
import { addDays } from '../daily.js';
import { whatsappLink } from '../debts.js';

const DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const dayName = (iso) => DAYS[new Date(`${iso}T12:00:00`).getDay()];

// One recorded move on its own card, with «عدّل» and «اعكس» when allowed.
function entryCard(ctx, r, { income = false, showDay = true } = {}) {
  const amount = r.amount < 0 ? `تم تنزيل ${money(-r.amount)}` : money(r.amount);
  return `
    <div class="card entry">
      <div class="row"><b>${esc(r.title)}</b><b class="${income && r.amount > 0 ? 'in' : ''}">${amount}</b></div>
      ${r.sub ? `<div class="row small"><span>${esc(r.sub)}</span><span>${showDay && r.date !== ctx.today ? showDate(r.date) : ''}</span></div>` : ''}
      ${r.editedFrom !== null ? `<details class="edited"><summary>اتعدّلت</summary><span class="hint">كانت ${money(r.editedFrom)} قبل التعديل.</span></details>` : ''}
      ${r.note ? `<span class="hint">ملحوظة: ${esc(r.note)}</span>` : ''}
      ${photoBtn(ctx.d, r.id)}
      ${r.undo.can ? `<div class="acts">
        ${r.edit ? `<button class="linkbtn" data-do="edit-entry" data-id="${esc(r.id)}">عدّل</button>` : '<span></span>'}
        <button class="linkbtn danger" data-do="undo-entry" data-id="${esc(r.id)}">اعكس الحركة دي</button>
      </div>` : (r.cancelled ? '' : `<span class="hint">${esc(r.undo.why)}</span>`)}
    </div>`;
}

const section = (title, list, html) => (list.length
  ? `<div class="secthead"><b>${title}</b><span>${list.length}</span></div>${html}` : '');

export function todayScreen(ctx, p, flash) {
  const day = p.day || ctx.today;
  const r = dayReport(ctx.book, ctx.d, day);
  const isToday = day === ctx.today;
  const label = isToday ? 'النهارده' : (day === addDays(ctx.today, -1) ? 'إمبارح' : showDate(day));
  return page({
    title: `مراجعة ${label}`, sub: 'كل اللي اتسجل، بند بند', back: 'home', tab: 'home', flash, help: 'today',
    body: `
      <div class="daybar">
        <button data-go="today" data-day="${addDays(day, -1)}">‹ قبله</button>
        <b>${dayName(day)} ${showDate(day).replace(/ \d{4}$/, '')}</b>
        <button data-go="today" data-day="${addDays(day, 1)}" ${isToday ? 'class="off" disabled' : ''}>بعده ›</button>
      </div>
      <div class="card">
        <div class="row"><span><i class="dot" style="background:var(--teal)"></i>دخل اليوم</span><b class="in">${money(r.totals.income)}</b></div>
        <div class="row"><span><i class="dot" style="background:var(--danger)"></i>مصروف اليوم</span><b class="neg">${money(r.totals.expense)}</b></div>
        <div class="row small"><span>${r.count} حركات</span><span>${r.count ? 'راجعهم واحدة واحدة' : ''}</span></div>
      </div>
      ${r.count ? '' : `<p class="hint">مفيش حاجة اتسجلت ${isToday ? 'النهارده' : 'اليوم ده'}.</p>`}
      ${section('الدخل', r.income, r.income.map((x) => entryCard(ctx, x, { income: true })).join(''))}
      ${section('المصروف', r.expense, r.expense.map((x) => entryCard(ctx, x)).join(''))}
      ${section('تحويل وتوزيع', r.other, r.other.map((x) => entryCard(ctx, x)).join(''))}
      <p class="hint">«عدّل» بتفتح نفس الأسئلة بإجاباتك. التحويل والتوزيع بيتعكسوا بس، وتسجّلهم تاني صح.</p>`,
  });
}

function chart(months) {
  const { list, limit } = months;
  const top = Math.max(limit, ...list.map((m) => m.spent), 1) * 1.15;
  const h = 80;
  const cols = list.map((m, i) => `
    <div class="col"><b>${m.spent ? formatMoney(m.spent).replace(' ج.م', '') : ''}</b>
      <i class="${i === list.length - 1 ? 'now' : ''} ${limit && m.spent > limit ? 'over' : ''}" style="height:${Math.max(3, Math.round((m.spent * h) / top))}px"></i>
      <small>${showMonth(m.month).split(' ')[0]}</small></div>`).join('');
  return `
    <div class="card">
      <div class="row"><span class="lbl">آخر ${list.length} شهور</span>${limit ? `<span class="hint" style="color:var(--danger)">الخط المتقطع = الحد ${money(limit)}</span>` : ''}</div>
      <div class="chart">${limit ? `<div class="limline" style="bottom:${Math.round((limit * h) / top) + 22}px"></div>` : ''}${cols}</div>
    </div>`;
}

export function categoryScreen(ctx, p, flash) {
  const { d, book } = ctx;
  const cat = d.categories.find((c) => c.id === p.id) ?? ctx.archived?.category?.find((c) => c.id === p.id);
  if (!cat) return page({ title: 'كشف وجه الصرف', back: 'categories', tab: 'more', body: '<p class="hint">وجه الصرف مش موجود.</p>' });
  const month = p.m || ctx.month;
  const st = categoryStatement(book, d, cat.id, month);
  const lim = st.limit;
  return page({
    title: `كشف: ${cat.name}`, sub: `كل اللي اتصرف على ${cat.name}`, back: 'categories', tab: 'more', flash, help: 'category',
    body: `
      <div class="daybar">
        <button data-go="category" data-id="${esc(cat.id)}" data-m="${addMonths(month, -1)}">‹ ${showMonth(addMonths(month, -1)).split(' ')[0]}</button>
        <b>${showMonth(month)}</b>
        <button data-go="category" data-id="${esc(cat.id)}" data-m="${addMonths(month, 1)}" ${month >= ctx.month ? 'class="off" disabled' : ''}>${showMonth(addMonths(month, 1)).split(' ')[0]} ›</button>
      </div>
      <div class="card">
        <div class="row"><span>صرفت ${month === ctx.month ? 'الشهر ده' : 'في الشهر ده'}</span><b class="${lim.level === 'over' ? 'neg' : ''}">${money(st.total)}</b></div>
        ${lim.limit ? `
          <div class="row small"><span>الحد</span><span>${money(lim.limit)}</span></div>
          ${limitBar(lim.percent, d.settings.limitWarn)}
          ${lim.level === 'over' ? `<span class="hint" style="color:var(--danger)">عدّيت الحد بـ ${money(lim.over)}. خلي بالك الشهر الجاي.</span>` : ''}
          ${lim.level === 'near' ? `<span class="hint" style="color:var(--warn-text)">قرّبت من الحد: فاضل ${money(lim.limit - lim.spent)}.</span>` : ''}`
        : '<span class="hint">مالوش حد. تقدر تحطله حد من شاشة «أوجه الصرف».</span>'}
      </div>
      ${chart(categoryMonths(book, d, cat.id, month))}
      <div class="secthead"><b>الحركات (${st.rows.length})</b><span>الأحدث فوق</span></div>
      ${st.rows.map((r) => entryCard(ctx, { ...r, title: showDate(r.date) }, { showDay: false })).join('') || '<p class="hint">مفيش مصروف على الوجه ده في الشهر ده.</p>'}
      ${st.rows.length ? `<a class="btn2" href="${esc(whatsappLink('', categoryStatementText(book, d, cat.id, month)))}" target="_blank" rel="noopener">ابعت الكشف على الواتساب</a>` : ''}`,
  });
}
