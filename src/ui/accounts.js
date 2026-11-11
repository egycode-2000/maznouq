// الحسابات: everyone you have money with. Running accounts (رايح جاي) and fixed debts (دين ثابت).
import {
  esc, money, bar, pick, placePick, amountCard, moreFields, item, page, retireButton, archivedBlock, calcBtn, photoBtn,
} from './common.js';
import { peopleList, peopleTotals, personBalance, wording, runningStatement, runningStatementText } from '../people.js';
import { scheduleStatus, statementText, reservePlan, whatsappLink } from '../debts.js';
import { debtReport, debtsReport, debtReserve, debtPaidPercent } from '../reports.js';
import { cashOf, defaultPlace } from '../places.js';
import { showDate } from '../format.js';
import { jamPositionText } from './dues.js';

const KIND_TAG = { running: 'حساب جاري', debt: 'دين ثابت', jamiya: 'جمعية' };

function personRow(r) {
  const go = r.kind === 'running' ? 'person' : r.kind;
  return item({
    go, params: { id: r.id }, title: r.name,
    right: r.kind === 'jamiya' ? jamPositionText(r.balance) : wording(r.balance),
    sub: KIND_TAG[r.kind],
  });
}

export function accountsScreen(ctx, p, flash) {
  const { d, book } = ctx;
  const list = peopleList(book, d);
  const totals = peopleTotals(book, d);
  const mine = list.filter((r) => r.balance > 0);
  const theirs = list.filter((r) => r.balance < 0);
  const clear = list.filter((r) => r.balance === 0 && r.kind !== 'jamiya');
  return page({
    title: 'الحسابات', sub: 'كل حد بينك وبينه فلوس', tab: 'accounts', flash, help: 'accounts',
    body: `
      <div class="quick">
        <button class="btn" data-go="person-new">+ حساب جاري</button>
        <button class="btn2" data-go="debt-new" data-dir="out">+ دين عليك</button>
        <button class="btn2" data-go="debt-new" data-dir="in">+ سلّفت حد</button>
      </div>
      <div class="sect row"><span>ليك عند الناس</span><b>${money(totals.owedToMe)}</b></div>
      ${mine.map(personRow).join('') || '<p class="hint">مفيش حد عليه ليك.</p>'}
      <div class="sect row"><span>عليك للناس</span><b>${money(totals.iOwe)}</b></div>
      ${theirs.map(personRow).join('') || '<p class="hint">مفيش عليك لحد.</p>'}
      ${clear.length ? `<details class="card"><summary>خالص (${clear.length})</summary>${clear.map(personRow).join('')}</details>` : ''}
      ${archivedBlock(ctx.archived, 'person', 'حسابات ملغية', (x) => x.person)}
      <button class="linkbtn" data-go="debts-report">تقرير الديون كله</button>`,
  });
}

// ---------- Running account (رايح جاي) ----------
const SIDE_OPEN = [{ id: 'none', name: 'مفيش رصيد قديم' }, { id: 'him', name: 'هو عليه ليا' }, { id: 'me', name: 'أنا عليا له' }];

export function personNewScreen(ctx, p, flash) {
  return page({
    title: 'حساب جاري جديد', sub: 'لحد بينكم رايح جاي', back: 'accounts', tab: 'accounts', flash, help: 'person-new',
    body: `
      <label class="lbl">اسمه</label>
      <input id="pn-name" class="field" data-autofocus />
      <label class="lbl">رقم الواتساب (اختياري)</label>
      <input id="pn-phone" class="field" inputmode="tel" placeholder="01xxxxxxxxx" />
      <div class="lbl">فيه رصيد من قبل البرنامج؟</div>
      ${pick('pn-side', SIDE_OPEN, 'none')}
      <input id="pn-open" class="field" inputmode="decimal" placeholder="الرصيد القديم بالجنيه" />
      <p class="hint">الرصيد القديم مش بيلمس الكاش.</p>
      <button class="btn" data-do="save-person">افتح الحساب</button>`,
  });
}

export function personScreen(ctx, p, flash) {
  const { d, book, places } = ctx;
  const acc = d.people.find((x) => x.id === p.id) ?? ctx.archived?.person?.find((x) => x.id === p.id);
  if (!acc) return accountsScreen(ctx, p, flash);
  const balance = personBalance(book, acc);
  const rows = runningStatement(book, acc);
  const text = runningStatementText(book, acc);
  const side = p.side === 'took' ? 'took' : 'gave';
  return page({
    title: acc.person, sub: 'حساب جاري', back: 'accounts', tab: 'accounts', flash, help: 'person',
    body: `
      <div class="card"><div class="big small-big ${balance < 0 ? 'neg' : ''}">${esc(wording(balance))}</div></div>
      <div class="seg">
        <button data-go="person" data-id="${esc(acc.id)}" data-side="gave" class="${side === 'gave' ? 'on' : ''}">اديته</button>
        <button data-go="person" data-id="${esc(acc.id)}" data-side="took" class="${side === 'took' ? 'on' : ''}">خدت منه</button>
      </div>
      ${amountCard(side === 'gave' ? 'اديته كام؟' : 'خدت منه كام؟', { quick: false })}
      <div class="lbl">${side === 'gave' ? 'من فين؟' : 'دخلت فين؟'}</div>
      ${placePick(places, 'place', defaultPlace(d, places))}
      ${moreFields(ctx.today)}
      <button class="btn" data-do="person-move" data-id="${esc(acc.id)}" data-side="${side}">سجّل</button>
      <div class="card">
        <div class="lbl">كشف الحساب</div>
        <table class="stmt-table">
          <tr><th>التاريخ</th><th>الحركة</th><th>الرصيد بعدها</th></tr>
          ${rows.map((r) => `<tr><td>${showDate(r.date)}</td><td>${r.delta > 0 ? `اديته ${money(r.delta)}` : `خدت منه ${money(-r.delta)}`}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}${photoBtn(d, r.id)}</td><td>${esc(wording(r.balance))}</td></tr>`).join('') || '<tr><td colspan="3">مفيش حركات لسه.</td></tr>'}
        </table>
      </div>
      <div class="card">
        <div class="lbl">واتساب</div>
        ${acc.phone ? `
          <a class="btn2" href="${esc(whatsappLink(acc.phone, `${acc.person}، ${wording(balance)}`))}" target="_blank" rel="noopener">ابعت الرصيد</a>
          <a class="btn2" href="${esc(whatsappLink(acc.phone, text))}" target="_blank" rel="noopener">ابعت كشف الحساب</a>
          <p class="hint">الرسالة بتتفتح في واتساب وإنت اللي بتبعتها.</p>`
    : '<p class="hint">ضيف رقمه من «تعديل» عشان تبعت.</p>'}
      </div>
      <details class="card">
        <summary>تعديل</summary>
        <input id="pe-name" class="field" value="${esc(acc.person)}" />
        <input id="pe-phone" class="field" inputmode="tel" value="${esc(acc.phone)}" placeholder="رقم الواتساب" />
        <button class="btn2" data-do="save-person-edit" data-id="${esc(acc.id)}">احفظ</button>
        ${retireButton('person', acc.id, 'الحساب')}
      </details>`,
  });
}

// ---------- Fixed debt (دين ثابت) ----------
const DIR_OPTIONS = [{ id: 'out', name: 'عليا لحد' }, { id: 'in', name: 'ليا عند حد' }];

export function debtNewScreen(ctx, p, flash) {
  const dir = p.dir === 'in' ? 'in' : 'out';
  return page({
    title: 'دين ثابت', sub: 'مبلغ معروف بيتسدد', back: 'accounts', tab: 'accounts', flash, help: 'debt-new',
    body: `
      ${pick('dn-dir', DIR_OPTIONS, dir)}
      <label class="lbl">اسم الشخص</label>
      <input id="dn-person" class="field" data-autofocus />
      <label class="lbl">المبلغ كله بالجنيه</label>
      <div class="row"><input id="dn-total" class="field grow" inputmode="decimal" />${calcBtn('dn-total')}</div>
      <label class="lbl">رقم الواتساب (اختياري)</label>
      <input id="dn-phone" class="field" inputmode="tel" placeholder="01xxxxxxxxx" />
      <div class="lbl">الدين ده من إمتى؟</div>
      ${pick('dn-move', [{ id: 'no', name: 'من قبل البرنامج' }, { id: 'yes', name: 'دلوقتي، والفلوس اتحركت' }], 'no')}
      <div class="lbl">لو دلوقتي: الفلوس خرجت من / دخلت في</div>
      ${placePick(ctx.places, 'place', cashOf(ctx.d)?.id)}
      <div class="lbl">بيتسدد إزاي؟</div>
      ${pick('dn-plan', [{ id: 'free', name: 'بتواريخ حرة' }, { id: 'monthly', name: 'قسط كل شهر' }, { id: 'days', name: 'قسط كل عدد أيام' }], 'free')}
      <details class="card">
        <summary>تفاصيل الأقساط والتاريخ</summary>
        <label class="lbl">عدد الأقساط</label>
        <input id="dn-count" class="field" inputmode="numeric" placeholder="مثلا: 3" />
        <label class="lbl">كل كام يوم؟ (لو «كل عدد أيام»)</label>
        <input id="dn-days" class="field" inputmode="numeric" placeholder="مثلا: 20" />
        <label class="lbl">تاريخ أول قسط</label>
        <input id="dn-first" class="field" type="date" value="${ctx.today}" />
        <label class="lbl">تاريخ الدين</label>
        <input id="dn-start" class="field" type="date" value="${ctx.today}" />
        <input id="dn-note" class="field" placeholder="ملحوظة (اختياري)" />
      </details>
      <button class="btn" data-do="save-debt">احفظ الدين</button>`,
  });
}

export function debtScreen(ctx, p, flash) {
  const { d, book, today, places } = ctx;
  const x = d.debts.find((y) => y.id === p.id);
  if (!x) return accountsScreen(ctx, p, flash);
  const balance = personBalance(book, x);
  const rem = Math.abs(balance);
  const r = debtReport(book, d, x);
  const rows = scheduleStatus(book, x, today).map((s) => `
    <div class="row small ${s.overdue ? 'neg' : ''}"><span>${showDate(s.dueDate)} · ${s.paid ? 'اتدفع' : s.overdue ? 'متأخر' : 'لسه'}</span><b>${money(s.amount)}</b></div>`).join('');
  const planned = x.installments.reduce((s, it) => s + it.amount, 0);
  const statement = statementText(book, x);

  let reserveCard = '';
  if (x.direction === 'out' && rem > 0) {
    const reserved = debtReserve(book, d, x.id);
    const rp = reservePlan(book, x, reserved, today);
    reserveCard = `
      <div class="card">
        <div class="row"><span class="lbl">محجوز للدين ده (لسه ماتسلّمش)</span><b class="big small-big">${money(reserved)}</b></div>
        ${rp ? `
          ${bar(Math.floor((reserved * 100) / rp.need))}
          <div class="row small"><span>القسط الجاي ${showDate(rp.dueDate)}</span><span>${money(rp.need)}</span></div>
          <div class="row small"><span>المطلوب تحجزه في اليوم</span><span>${money(rp.perDay)}</span></div>
          <div class="row small ${rp.gap > 0 ? 'neg' : ''}"><span>المفروض تكون حاجز لحد النهارده</span><span>${money(rp.expected)}</span></div>
          ${rp.gap > 0 ? `<p class="hint">ناقصك ${money(rp.gap)} عشان تبقى ماشي على الخطة.</p>` : '<p class="hint">ماشي على الخطة.</p>'}` : ''}
        <div class="amount-row">
          <input id="res-amount" class="amount" inputmode="decimal" placeholder="${rp ? rp.perDay / 100 : 0}" />
          <span>ج.م</span>${calcBtn('res-amount')}
        </div>
        ${placePick(places, 'res-from', cashOf(d)?.id, { only: ['cash', 'wallet'] })}
        <input id="res-note" class="field" placeholder="ملحوظة (اختياري)" />
        <button class="btn2" data-do="reserve-debt" data-id="${esc(x.id)}">احجز المبلغ ده للدين</button>
        ${reserved > 0 ? `
          <button class="btn" data-do="deliver-debt" data-id="${esc(x.id)}">سلّمت المحجوز (${money(Math.min(reserved, rem))})</button>
          <p class="hint">«سلّمت» بتطلّع الفلوس من المحجوز وتنزّلها من الدين.</p>` : '<p class="hint">المحجوز بيخرج من الكاش ويتشال في درج لحد ما تسلّمه.</p>'}
      </div>`;
  }

  return page({
    title: x.person, sub: x.direction === 'in' ? 'ليك عنده' : 'عليك ليه', back: 'accounts', tab: 'accounts', flash, help: 'debt',
    body: `
      <div class="card">
        <div class="big small-big">${esc(wording(balance))}</div>
        ${bar(debtPaidPercent(book, x))}
        <div class="row small"><span>أصل الدين</span><span>${money(r.total)}</span></div>
        <div class="row small"><span>${x.direction === 'in' ? 'رجعلك' : 'اتسلّم'}</span><span>${money(r.paid)}</span></div>
        ${x.direction === 'out' ? `<div class="row small"><span>محجوز ولسه ماتسلّمش</span><span>${money(r.reserved)}</span></div>` : ''}
        <div class="row total"><span>الباقي</span><b>${money(r.remaining)}</b></div>
      </div>
      ${reserveCard}
      ${rem > 0 ? `
      <details class="card">
        <summary>${x.direction === 'in' ? 'استلمت منه' : 'دفعت له على طول (من غير حجز)'}</summary>
        <div class="row"><input id="pay-amount" class="field grow" inputmode="decimal" placeholder="المبلغ" />${calcBtn('pay-amount')}</div>
        ${placePick(places, 'place', cashOf(d)?.id)}
        ${moreFields(today)}
        <button class="btn" data-do="pay-debt" data-id="${esc(x.id)}">سجّل</button>
        <p class="hint">السداد مش دخل ولا مصروف، وبيتطبق على الأقساط بالترتيب.</p>
      </details>` : ''}
      ${x.installments.length ? `<div class="card"><div class="lbl">الأقساط</div>${rows}</div>` : ''}
      ${rem > 0 && planned < x.total ? `
      <details class="card">
        <summary>ضيف قسط بتاريخ</summary>
        <input id="inst-date" class="field" type="date" value="${today}" />
        <input id="inst-amount" class="field" inputmode="decimal" placeholder="المبلغ بالجنيه" />
        <button class="btn2" data-do="add-installment" data-id="${esc(x.id)}">+ أضف القسط</button>
      </details>` : ''}
      <div class="card">
        <div class="lbl">التقرير: كان كذا، وحصل كذا، وبقى كذا</div>
        <table class="stmt-table">
          <tr><th>التاريخ</th><th>اللي حصل</th><th>الباقي</th></tr>
          ${r.steps.map((s) => `<tr><td>${showDate(s.date)}</td><td>${esc(s.what)} ${money(s.amount)}${s.note ? `<br><small>${esc(s.note)}</small>` : ''}${photoBtn(d, s.id)}${x.direction === 'out' && s.reserved ? `<br><small>المحجوز: ${money(s.reserved)}</small>` : ''}</td><td>${money(s.left)}</td></tr>`).join('')}
        </table>
      </div>
      <div class="card">
        <div class="lbl">واتساب</div>
        ${x.phone ? `
          <a class="btn2" href="${esc(whatsappLink(x.phone, `${x.person}، ${wording(balance)}`))}" target="_blank" rel="noopener">ابعت الباقي</a>
          <a class="btn2" href="${esc(whatsappLink(x.phone, statement))}" target="_blank" rel="noopener">ابعت كشف الحساب</a>
          <p class="hint">الرسالة بتتفتح في واتساب وإنت اللي بتبعتها.</p>`
    : '<p class="hint">ضيف الرقم من «تعديل البيانات».</p>'}
      </div>
      <details class="card">
        <summary>تعديل البيانات</summary>
        <input id="de-person" class="field" value="${esc(x.person)}" />
        <input id="de-phone" class="field" inputmode="tel" value="${esc(x.phone)}" placeholder="رقم الواتساب" />
        <button class="btn2" data-do="save-debt-edit" data-id="${esc(x.id)}">احفظ التعديل</button>
      </details>`,
  });
}

export function debtsReportScreen(ctx, p, flash) {
  const { d, book } = ctx;
  const { rows, ...totals } = debtsReport(book, d);
  const sum = (dir, key) => totals[dir][key];
  const table = (dir, title) => {
    const list = rows.filter((r) => r.debt.direction === dir);
    if (!list.length) return '';
    return `
      <div class="sect">${title}</div>
      <div class="card">
        <table class="stmt-table">
          <tr><th>الاسم</th><th>الأصل</th><th>اتسدد</th>${dir === 'out' ? '<th>محجوز</th>' : ''}<th>الباقي</th></tr>
          ${list.map((r) => `<tr data-go="debt" data-id="${esc(r.debt.id)}"><td>${esc(r.debt.person)}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td>${dir === 'out' ? `<td>${money(r.reserved)}</td>` : ''}<td><b>${money(r.remaining)}</b></td></tr>`).join('')}
          <tr class="total"><td>الإجمالي</td><td>${money(sum(dir, 'total'))}</td><td>${money(sum(dir, 'paid'))}</td>${dir === 'out' ? `<td>${money(sum(dir, 'reserved'))}</td>` : ''}<td><b>${money(sum(dir, 'remaining'))}</b></td></tr>
        </table>
      </div>`;
  };
  return page({
    title: 'تقرير الديون', back: 'accounts', tab: 'accounts', flash, help: 'debt',
    body: `${table('out', 'عليك للناس') + table('in', 'ليك عند الناس') || '<p class="hint">مفيش ديون ثابتة.</p>'}
      <p class="hint">الحسابات الجارية ليها كشف لوحدها في شاشة كل شخص.</p>`,
  });
}

