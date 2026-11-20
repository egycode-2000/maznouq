// Reviewing what was recorded: «مراجعة النهارده» (one day, line by line) and the statement of one spending
// category (كشف وجه الصرف). Every number comes from reports.js (dayReport, categoryStatement, limitStatus).
import { esc, money, egpValue, limitBar, page, photoBtn } from './common.js';
import { dayReport, categoryStatement, categoryMonths, categoryStatementText, monthSummary } from '../reports.js';
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

// ملخص الشهر: income, spending, the top five, limits passed, against last month. Numbers from monthSummary.
export function monthScreen(ctx, p, flash) {
  const { d, book } = ctx;
  const month = p.m || ctx.month;
  const s = monthSummary(book, d, month);
  const surplus = s.totals.income - s.totals.expense;
  const versus = (now, before) => {
    if (!before && !now) return '';
    const diff = now - before;
    if (diff === 0) return 'زي الشهر اللي فات';
    return `${diff > 0 ? 'أكتر' : 'أقل'} من الشهر اللي فات بـ ${money(Math.abs(diff))}`;
  };
  const max = Math.max(1, ...s.top.map((x) => x.spent));
  const isCategory = (id) => d.categories.some((c) => c.id === id);
  return page({
    title: `ملخص ${showMonth(month)}`, sub: 'دخلك ومصروفك وأكتر حاجات صرفت فيها', back: 'home', tab: 'home', flash, help: 'month',
    body: `
      <div class="daybar">
        <button data-go="month" data-m="${addMonths(month, -1)}">‹ ${showMonth(addMonths(month, -1)).split(' ')[0]}</button>
        <b>${showMonth(month)}</b>
        <button data-go="month" data-m="${addMonths(month, 1)}" ${month >= ctx.month ? 'class="off" disabled' : ''}>${showMonth(addMonths(month, 1)).split(' ')[0]} ›</button>
      </div>
      <div class="card">
        <div class="row"><span><i class="dot" style="background:var(--teal)"></i>الدخل</span><b class="in">${money(s.totals.income)}</b></div>
        <span class="hint">${versus(s.totals.income, s.prev.income)}</span>
        <div class="row"><span><i class="dot" style="background:var(--danger)"></i>المصروف</span><b class="neg">${money(s.totals.expense)}</b></div>
        <span class="hint">${versus(s.totals.expense, s.prev.expense)}</span>
        <div class="row total"><span>${surplus < 0 ? 'العجز' : 'الفايض'}</span><b class="${surplus < 0 ? 'neg' : 'in'}">${money(Math.abs(surplus))}</b></div>
        <p class="hint">ده مش ربح. اللي بتشيله في الأدراج وسداد الديون وأقساط الجمعيات مش داخلين فيه.</p>
      </div>
      ${s.top.length ? `
      <div class="secthead"><b>أكتر حاجات صرفت فيها</b><span>من ${money(s.totals.expense)}</span></div>
      <div class="card">
        ${s.top.map((x) => `
          <${isCategory(x.id) ? `button class="topcat link" data-go="category" data-id="${esc(x.id)}" data-m="${month}"` : 'div class="topcat"'}>
            <div class="row"><b>${esc(x.name)}</b><b>${money(x.spent)}</b></div>
            <div class="hbar"><i class="${x.limit.level === 'over' ? 'over' : ''}" style="width:${Math.round((x.spent * 100) / max)}%"></i></div>
            <div class="row small"><span>${s.totals.expense > 0 ? `${Math.round((x.spent * 100) / s.totals.expense)}% من مصروفك` : ''}${x.limit.limit ? ` · ${x.limit.percent}% من حدّه` : ''}</span><span>الشهر اللي فات ${money(x.prevSpent)}</span></div>
          </${isCategory(x.id) ? 'button' : 'div'}>`).join('')}
        ${s.others ? `<div class="row small"><span>باقي الأبواب</span><span>${money(s.others)}</span></div>` : ''}
      </div>` : '<p class="hint">مفيش مصروف في الشهر ده.</p>'}
      ${s.over.length ? `
      <div class="card warn-card">
        <b>عدّوا الحد</b>
        ${s.over.map((x) => `<div class="row small"><span>${esc(x.name)}</span><span>${x.limit.percent}% · زيادة ${money(x.limit.over)}</span></div>`).join('')}
        <span class="hint">خلي بالك منهم الشهر الجاي.</span>
      </div>` : ''}`,
  });
}

// «ابدأ من الأول»: a new start keeping the names, or wiping everything. Both download a backup first.
export function restartScreen(ctx, p, flash) {
  const { places, d } = ctx;
  const list = places.filter((x) => ['cash', 'wallet', 'drawer'].includes(x.kind));
  return page({
    title: 'ابدأ من الأول', sub: 'اختار واحدة من الاتنين', back: 'settings', tab: 'more', flash, help: 'restart',
    body: `
      <div class="card">
        <div class="lbl">١. بداية جديدة بنفس الأسماء</div>
        <p class="hint">الأماكن والأبواب والخزن والناس بيفضلوا. اكتب اللي في كل مكان فعلا دلوقتي، والبرنامج يبدأ منه.
        الحركات القديمة ماتتمسحش: تفضل في السجل «فترة قديمة» تتفرج عليها بس، والشهر ده يتحسب من البداية الجديدة.</p>
        ${list.map((x) => `
          <div class="line-row">
            <span class="split-name"><b>${esc(x.name)}</b><small>${x.safeName ? `${esc(x.safeName)} · ` : ''}في البرنامج ${money(x.balance)}</small></span>
            <input class="field split-val" data-restart="${esc(x.id)}" inputmode="decimal" value="${egpValue(Math.max(0, x.balance))}" />
          </div>`).join('')}
        <p class="hint">الناس والديون والجمعيات بيفضلوا زي ما هم، ودروج الدهب والوحدات بكمياتها.${d.borrows.some((b) => b.amount > b.repaid) ? ' وسلف الأدراج المفتوحة بتتقفل.' : ''}</p>
        <button class="btn" data-do="new-start">نزّل نسخة احتياطية وابدأ من جديد</button>
      </div>
      <div class="card danger-card">
        <div class="lbl">٢. امسح كل حاجة</div>
        <p class="hint">بيمسح البرنامج كله من الجهاز ده، كأنك منزّله جديد، وبيرجعك للتعريف والإعداد. مفيش رجوع غير من النسخة الاحتياطية اللي هتتنزّل الأول.</p>
        <input id="wipe-all-confirm" class="field" placeholder="اكتب كلمة «امسح» للتأكيد" />
        <button class="btn2 danger" data-do="wipe-all">نزّل نسخة احتياطية وامسح كل حاجة</button>
      </div>`,
  });
}
