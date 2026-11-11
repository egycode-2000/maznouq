// الالتزامات: jam'iyas, bills of every kind, and fixed debts you pay in installments.
import {
  esc, money, egpValue, bar, pick, placePick, moreFields, item, page, retireButton, archivedBlock, calcBtn, photoBtn,
} from './common.js';
import { billAmountFor, MONTHLY_KINDS, isDueMonth } from '../bills.js';
import { addMonths, progress, nextInstallment, dueDateOf, previewJamiya } from '../obligations.js';
import { remainingThisMonth, debtPaidPercent } from '../reports.js';
import { personBalance, wording, jamPosition } from '../people.js';
import { cashOf, defaultPlace } from '../places.js';
import { showDate, showMonth } from '../format.js';

export const KIND_LABEL = {
  monthly: 'ثابت كل شهر', variable: 'فاتورة متغيرة', periodic: 'كل كام شهر', dated: 'مرة واحدة بتاريخ', open: 'من غير موعد',
};
const STATUS_LABEL = { paid: 'اتدفع', unpaid: 'لسه', unsure: 'مش متأكد' };

export function jamPositionText(balance) {
  if (balance > 0) return `ليك في الجمعية ${money(balance)}`;
  if (balance < 0) return `عليك للجمعية ${money(-balance)}`;
  return 'خالص';
}

function billLine(b, month) {
  const repeating = MONTHLY_KINDS.includes(b.kind);
  const period = repeating ? month : 'once';
  const dueNow = !repeating || isDueMonth(b, month);
  const paid = Boolean(b.paid[period]);
  let when = 'من غير موعد';
  if (repeating) when = b.kind === 'periodic' ? `كل ${b.everyMonths} شهور يوم ${b.dueDay}` : `يوم ${b.dueDay} من كل شهر`;
  if (b.kind === 'dated') when = showDate(b.dueDate);
  let status = paid ? 'اتدفع' : 'لسه';
  if (repeating && !dueNow) status = 'مش مستحق الشهر ده';
  const amount = repeating ? billAmountFor(b, month) : b.amount;
  return item({
    go: 'bill', params: { id: b.id }, title: b.name,
    right: `${b.kind === 'variable' ? 'حوالي ' : ''}${money(amount)}`, sub: `${when} · ${status}`,
  });
}

export function duesScreen(ctx, p, flash) {
  const { d, book, month } = ctx;
  const rem = remainingThisMonth(book, d, month);
  const jams = d.jamiyas.map((j) => {
    const pr = progress(j);
    const next = nextInstallment(j);
    return item({
      go: 'jam', params: { id: j.id }, title: j.name, right: jamPositionText(jamPosition(book, j)), percent: pr.percent,
      sub: `${pr.paid} من ${pr.total} · القسط ${money(j.monthly)}${next ? ` · الجاي ${showDate(next.date)}` : ' · خلصت'}`,
    });
  }).join('');
  const group = (kind) => d.bills.filter((b) => b.kind === kind).map((b) => billLine(b, month)).join('');
  const owed = d.debts.filter((x) => x.direction === 'out').map((x) => item({
    go: 'debt', params: { id: x.id }, title: x.person, right: wording(personBalance(book, x)), percent: debtPaidPercent(book, x),
  })).join('');
  const section = (title, rows) => (rows ? `<div class="sect">${title}</div>${rows}` : '');
  const empty = !d.bills.length && !d.jamiyas.length && !owed;
  return page({
    title: 'الالتزامات', sub: `الباقي عليك الشهر ده: ${money(rem.total)}`, tab: 'dues', flash, help: 'dues',
    body: `
      <div class="quick">
        <button class="btn2" data-go="bill-new">+ التزام</button>
        <button class="btn2" data-go="jam-new">+ جمعية</button>
        <button class="btn2" data-go="debt-new" data-dir="out">+ دين عليك</button>
      </div>
      ${empty ? '<p class="hint">مفيش التزامات لسه. ضيف الإيجار أو الجمعية أو أي قسط.</p>' : ''}
      ${section('الجمعيات', jams)}
      ${Object.keys(KIND_LABEL).map((k) => section(KIND_LABEL[k], group(k))).join('')}
      ${section('ديون عليك', owed)}
      ${archivedBlock(ctx.archived, 'bill', 'التزامات ملغية')}`,
  });
}

// ---------- Bills ----------
export function billNewScreen(ctx, p, flash) {
  const kind = KIND_LABEL[p.kind] ? p.kind : 'monthly';
  const tabs = Object.entries(KIND_LABEL).map(([k, label]) => `
    <button type="button" data-go="bill-new" data-kind="${k}" class="chip ${k === kind ? 'on' : ''}">${label}</button>`).join('');
  const repeating = MONTHLY_KINDS.includes(kind);
  return page({
    title: 'التزام جديد', back: 'dues', tab: 'dues', flash, help: 'bill-new',
    body: `
      <div class="lbl">نوعه</div>
      <div class="chips">${tabs}</div>
      <input type="hidden" id="b-kind" value="${kind}" />
      <label class="lbl">اسمه</label>
      <input id="b-name" class="field" placeholder="${{ monthly: 'مثلا: الإيجار', variable: 'مثلا: الكهربا', periodic: 'مثلا: ترخيص العربية', dated: 'مثلا: مصاريف المدرسة', open: 'مثلا: صيانة' }[kind]}" data-autofocus />
      <label class="lbl">${kind === 'variable' ? 'مبلغ تقريبي (عشان يتحسب في اللي عليك)' : 'المبلغ'} بالجنيه</label>
      <div class="row"><input id="b-amount" class="field grow" inputmode="decimal" />${calcBtn('b-amount')}</div>
      ${repeating ? `
        <label class="lbl">يوم الاستحقاق في الشهر</label>
        <input id="b-day" class="field" inputmode="numeric" value="1" />
        <label class="lbl">أول شهر</label>
        <input id="b-start" class="field" type="month" value="${ctx.month}" />` : ''}
      ${kind === 'periodic' ? `
        <label class="lbl">كل كام شهر؟</label>
        <input id="b-every" class="field" inputmode="numeric" value="12" />` : ''}
      ${kind === 'dated' ? `
        <label class="lbl">تاريخ الاستحقاق</label>
        <input id="b-date" class="field" type="date" value="${ctx.today}" />` : ''}
      ${kind === 'open' ? '<p class="hint">هيفضل محسوب عليك لحد ما تدفعه.</p>' : ''}
      <button class="btn" data-do="save-bill">احفظ الالتزام</button>`,
  });
}

// The month to pay by default: the oldest unpaid month up to now, else this month or the next one due.
function defaultPeriod(b, month) {
  for (let m = b.startMonth; m <= month; m = addMonths(m, 1)) if (isDueMonth(b, m) && !b.paid[m]) return m;
  for (let i = 0; i < 61; i += 1) {
    const m = addMonths(month, i);
    if (isDueMonth(b, m) && !b.paid[m]) return m;
  }
  return month;
}

export function billScreen(ctx, p, flash) {
  const { d, month, places } = ctx;
  const b = d.bills.find((x) => x.id === p.id);
  if (!b) return duesScreen(ctx, p, flash);
  const repeating = MONTHLY_KINDS.includes(b.kind);
  const period = repeating ? (p.month && p.month !== 'once' ? p.month : defaultPeriod(b, month)) : 'once';
  const paid = b.paid[period];
  const amount = repeating ? billAmountFor(b, period) : b.amount;
  const late = [];
  if (repeating) for (let m = b.startMonth; m < month; m = addMonths(m, 1)) if (isDueMonth(b, m) && !b.paid[m]) late.push(m);
  const history = Object.entries(b.paid).sort((x, y) => y[0].localeCompare(x[0])).slice(0, 12);
  const increases = b.increases.map((i) => `<div class="row small"><span>من ${showMonth(i.fromMonth)}</span><b>${money(i.amount)}</b></div>`).join('');
  return page({
    title: b.name, sub: KIND_LABEL[b.kind], back: 'dues', tab: 'dues', flash, help: 'bill',
    body: `
      ${late.length ? `<div class="card warn-card"><b>شهور فاتت ومش متسجلة: ${late.length}</b>
        <div class="chips">${late.map((m) => `<button class="chip ${m === period ? 'on' : ''}" data-go="bill" data-id="${esc(b.id)}" data-month="${m}">${showMonth(m)}</button>`).join('')}</div></div>` : ''}
      <div class="card">
        ${repeating ? `
          <label class="lbl" for="bill-period">بتدفع شهر</label>
          <input id="bill-period" class="field" type="month" value="${period}" data-go-on-change="bill" data-id="${esc(b.id)}" />` : ''}
        ${paid ? `
          <div class="row"><span>اتدفع ${showDate(paid.date)}</span><b>${money(paid.amount)}</b></div>
          <button class="btn2" data-do="undo-bill" data-id="${esc(b.id)}" data-month="${period}">اعكس الدفع ده</button>`
    : `
          <label class="lbl" for="bill-amount">${b.kind === 'variable' ? 'مبلغ الفاتورة' : 'المبلغ'}</label>
          <div class="row"><input id="bill-amount" class="field grow" inputmode="decimal" value="${b.kind === 'variable' ? '' : egpValue(amount)}" placeholder="${b.kind === 'variable' ? `حوالي ${egpValue(amount)}` : ''}" />${calcBtn('bill-amount')}</div>
          <div class="lbl">هتدفع منين؟</div>
          ${placePick(places, 'from', defaultPlace(d, places))}
          ${moreFields(ctx.today)}
          <button class="btn" data-do="pay-bill" data-id="${esc(b.id)}" data-month="${period}">دفعت</button>`}
      </div>
      ${history.length ? `<details class="card"><summary>اللي اتدفع (${history.length})</summary>
        ${history.map(([per, r]) => `<div class="row small"><span>${per === 'once' ? showDate(r.date) : showMonth(per)} ${photoBtn(d, r.entryId)}</span><span>${money(r.amount)}</span></div>`).join('')}</details>` : ''}
      ${b.kind === 'monthly' ? `
      <details class="card">
        <summary>زيادة المبلغ من شهر معين</summary>
        ${increases || '<p class="hint">مفيش زيادات مسجلة.</p>'}
        <label class="lbl">الزيادة تبدأ من شهر</label>
        <input id="inc-from" class="field" type="month" value="${month}" />
        <label class="lbl">المبلغ الجديد بالجنيه</label>
        <input id="inc-amount" class="field" inputmode="decimal" />
        <button class="btn2" data-do="add-increase" data-id="${esc(b.id)}">سجّل الزيادة</button>
      </details>` : ''}
      <details class="card">
        <summary>تعديل البيانات</summary>
        <label class="lbl">الاسم</label>
        <input id="be-name" class="field" value="${esc(b.name)}" />
        <label class="lbl">${b.kind === 'variable' ? 'المبلغ التقريبي' : 'المبلغ الأساسي'} بالجنيه</label>
        <input id="be-amount" class="field" inputmode="decimal" value="${egpValue(b.amount)}" />
        ${repeating ? `<label class="lbl">يوم الاستحقاق</label><input id="be-day" class="field" inputmode="numeric" value="${b.dueDay}" />` : ''}
        ${b.kind === 'periodic' ? `<label class="lbl">كل كام شهر</label><input id="be-every" class="field" inputmode="numeric" value="${b.everyMonths}" />` : ''}
        ${b.kind === 'dated' ? `<label class="lbl">تاريخ الاستحقاق</label><input id="be-date" class="field" type="date" value="${esc(b.dueDate)}" />` : ''}
        <p class="hint">اللي اتدفع قبل كده بيفضل بمبلغه القديم.</p>
        <button class="btn2" data-do="save-bill-edit" data-id="${esc(b.id)}">احفظ التعديل</button>
        ${retireButton('bill', b.id, 'الالتزام')}
      </details>`,
  });
}

// ---------- Jam'iya: questions one after the other ----------
export const JAM_STEPS = ['name', 'members', 'monthly', 'payDay', 'currentNumber', 'currentPaid', 'received', 'detail', 'summary'];

export function jamWizardScreen(ctx, p, flash) {
  const a = ctx.jamDraft ?? {};
  const step = Math.min(Math.max(Number(p.step ?? 0), 0), JAM_STEPS.length - 1);
  const key = JAM_STEPS[step];
  const dots = JAM_STEPS.map((_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('');
  const input = (label, attrs, value, hint = '') => `
    <label class="lbl big-q" for="jq">${label}</label>
    <input id="jq" class="field big-field" ${attrs} value="${esc(value ?? '')}" data-autofocus />
    ${hint ? `<p class="hint">${hint}</p>` : ''}`;
  const choice = (label, options, value) => `
    <div class="lbl big-q">${label}</div>
    ${pick('jq', options, value)}`;
  let body = '';
  if (key === 'name') body = input('اسم الجمعية إيه؟', 'placeholder="مثلا: جمعية الشغل"', a.name);
  if (key === 'members') body = input('الجمعية كام نفر؟', 'inputmode="numeric" placeholder="مثلا: 25"', a.members, 'عدد الأنفار هو عدد الشهور.');
  if (key === 'monthly') body = input('بتدفع كام في الشهر؟', 'inputmode="decimal" placeholder="مثلا: 1000"', a.monthly);
  if (key === 'payDay') body = input('بتدفعها يوم كام في الشهر؟', 'inputmode="numeric" placeholder="مثلا: 10"', a.payDay ?? '1', 'لو أول الشهر اكتب 1.');
  if (key === 'currentNumber') body = input('إحنا دلوقتي في الشهر كام من الجمعية؟', 'inputmode="numeric"', a.currentNumber ?? '1', `من 1 لـ ${esc(a.members ?? '')}. لو لسه بادئة اكتب 1.`);
  if (key === 'currentPaid') body = choice('قسط الشهر ده اتدفع؟', [{ id: 'no', name: 'لسه' }, { id: 'yes', name: 'أيوه اتدفع' }], a.currentPaid ?? 'no');
  if (key === 'received') body = choice('قبضت الجمعية؟', [{ id: 'no', name: 'لسه ما قبضتش' }, { id: 'before', name: 'أيوه قبضت' }], a.received ?? 'no');
  if (key === 'detail') {
    body = a.received === 'before'
      ? input('قبضت كام؟', 'inputmode="decimal"', a.payout ?? String((Number(a.monthly) || 0) * (Number(a.members) || 0)), 'عادة القسط × عدد الأنفار. غيّره لو مختلف.')
      : input('إنت النفر الكام؟ (دورك)', 'inputmode="numeric" placeholder="اختياري"', a.turn, 'لو مش عارف سيبها فاضية، وتقدر تكتبها بعدين.');
  }
  if (key === 'summary') {
    let pv = null;
    let problem = '';
    try {
      pv = previewJamiya({
        members: a.members, monthly: a.monthly, currentNumber: a.currentNumber, currentPaid: a.currentPaid === 'yes',
        received: a.received, payoutEgp: a.received === 'before' ? a.payout : null, turn: a.received === 'no' ? a.turn : null, thisMonth: ctx.month,
      });
    } catch (e) {
      problem = e.message;
    }
    body = pv ? `
      <div class="card">
        <div class="lbl">${esc(a.name)}</div>
        <div class="row"><span>الأنفار</span><b>${pv.totalMonths}</b></div>
        <div class="row"><span>القسط</span><b>${money(pv.amount)} يوم ${esc(a.payDay)}</b></div>
        <div class="row"><span>من</span><b>${showMonth(pv.startMonth)} لـ ${showMonth(pv.endMonth)}</b></div>
        <div class="row"><span>اتدفع لحد دلوقتي</span><b>${pv.paidBefore} شهر</b></div>
        <div class="row"><span>فاضل</span><b>${pv.unpaid} أقساط = ${money(pv.unpaid * pv.amount)}</b></div>
        ${pv.turnMonth ? `<div class="row"><span>دورك</span><b>شهر ${pv.myTurn} (${showMonth(pv.turnMonth)})</b></div>` : ''}
        <div class="row total"><span>وضعك</span><b>${jamPositionText(pv.position)}</b></div>
        <p class="hint">اللي فات بيتسجل وضع بداية، ومش بيلمس الكاش ولا أي محفظة.</p>
      </div>` : `<div class="error">${esc(problem)}</div><p class="hint">ارجع وصحّح الإجابة.</p>`;
  }
  const last = key === 'summary';
  return page({
    title: 'جمعية جديدة', sub: `سؤال ${step + 1} من ${JAM_STEPS.length}`, back: step ? null : 'dues', tab: 'dues', flash, help: 'jam-new',
    body: `
      <div class="steps light">${dots}</div>
      ${body}
      <div class="spacer"></div>
      <button class="btn" data-do="${last ? 'jam-create' : 'jam-next'}" data-step="${step}">${last ? 'احفظ الجمعية' : 'التالي'}</button>
      ${step ? `<button class="btn2" data-do="jam-prev" data-step="${step}">السؤال اللي فات</button>` : ''}`,
  });
}

export function jamScreen(ctx, p, flash) {
  const { d, book, places } = ctx;
  const j = d.jamiyas.find((x) => x.id === p.id) ?? d.jamiyas[Number(p.idx)];
  if (!j) return duesScreen(ctx, p, flash);
  const pr = progress(j);
  const position = jamPosition(book, j);
  const next = nextInstallment(j);
  const month = p.month !== undefined && p.month !== '' ? Number(p.month) : (next ? next.index : null);
  const chips = j.status.map((s, m) => {
    const cls = s === 'paid' ? 'on' : s === 'unsure' ? 'warn' : 'unpaid';
    return `<button class="chip ${cls} ${m === month ? 'sel' : ''}" data-go="jam" data-id="${esc(j.id)}" data-month="${m}">${m + 1}</button>`;
  }).join('');
  let panel = '';
  if (month !== null && j.status[month] !== undefined) {
    const s = j.status[month];
    panel = `
      <div class="card">
        <div class="row"><span class="lbl">شهر ${month + 1} · ${showMonth(addMonths(j.startMonth, month))}</span><span>${STATUS_LABEL[s]}</span></div>
        <span class="hint">معاده ${showDate(dueDateOf(j, month))}</span>
        ${s === 'unpaid' ? `
          <div class="lbl">هتدفع منين؟</div>
          ${placePick(places, 'from', defaultPlace(d, places))}
          ${moreFields(ctx.today)}
          <button class="btn" data-do="jam-pay" data-id="${esc(j.id)}" data-month="${month}">دفعت ${money(j.monthly)}</button>` : ''}
        ${s === 'unsure' ? '<p class="hint">حدد الأول: الشهر ده اتدفع ولا لأ؟</p>' : ''}
        <details>
          <summary>تغيير حالة الشهر</summary>
          <button class="btn2" data-do="jam-mark" data-id="${esc(j.id)}" data-month="${month}" data-status="paid">اتدفع قبل البرنامج (من غير ما يلمس الكاش)</button>
          <button class="btn2" data-do="jam-mark" data-id="${esc(j.id)}" data-month="${month}" data-status="unsure">مش متأكد</button>
          <button class="btn2" data-do="jam-mark" data-id="${esc(j.id)}" data-month="${month}" data-status="unpaid">مش مدفوع</button>
        </details>
      </div>`;
  }
  const receive = j.received
    ? `<div class="card"><div class="row"><span class="lbl">اتقبضت</span><b>${money(j.received.payout)}</b></div>
         <span class="hint">${j.received.preApp ? 'قبل البرنامج' : `بتاريخ ${showDate(j.received.date)}`}</span>
         <button class="linkbtn danger" data-do="jam-unreceive" data-id="${esc(j.id)}">اعكس القبض</button></div>`
    : `<details class="card">
         <summary>استلمت الجمعية؟</summary>
         <label class="lbl">المبلغ اللي استلمته</label>
         <div class="row"><input id="jam-payout" class="field grow" inputmode="decimal" value="${egpValue(j.payout)}" />${calcBtn('jam-payout')}</div>
         <div class="lbl">استلمته فين؟</div>
         ${placePick(places, 'to', cashOf(d)?.id)}
         <p class="hint">القبض مش دخل. بعده الأقساط الباقية تبقى عليك للجمعية.</p>
         <button class="btn" data-do="jam-receive" data-id="${esc(j.id)}">سجّل القبض</button>
       </details>`;
  return page({
    title: j.name, sub: `${pr.paid} من ${pr.total} اتدفعوا${pr.unsure ? ` · ${pr.unsure} مش متأكد` : ''}`,
    back: 'dues', tab: 'dues', flash, help: 'jam',
    body: `
      <div class="card">
        <div class="big small-big">${jamPositionText(position)}</div>
        ${bar(pr.percent)}
        <div class="row small"><span>فاضل ${pr.total - pr.paid} أقساط</span><span>${money(pr.remainingAmount)}</span></div>
        ${next ? `<div class="row small"><span>القسط الجاي: شهر ${next.index + 1}</span><span>${showDate(next.date)}</span></div>` : '<p class="hint">كل الأقساط اتدفعت.</p>'}
        ${!j.received && j.turn ? `<div class="row small"><span>دورك</span><span>شهر ${j.turn} (${showMonth(addMonths(j.startMonth, j.turn - 1))})</span></div>` : ''}
      </div>
      <div class="months">${chips}</div>
      <p class="hint">أخضر اتدفع · أصفر مش متأكد · رمادي لسه. التنبيه قبل المعاد بـ ${j.remindDays} أيام.</p>
      ${panel}
      ${receive}
      <details class="card">
        <summary>تعديل بيانات الجمعية</summary>
        <label class="lbl">الاسم</label><input id="je-name" class="field" value="${esc(j.name)}" />
        <label class="lbl">يوم الدفع</label><input id="je-day" class="field" inputmode="numeric" value="${j.payDay}" />
        <label class="lbl">التنبيه قبلها بكام يوم</label><input id="je-remind" class="field" inputmode="numeric" value="${j.remindDays}" />
        ${j.received ? '' : `<label class="lbl">مبلغ القبض المتوقع</label><input id="je-payout" class="field" inputmode="decimal" value="${egpValue(j.payout)}" />`}
        <label class="lbl">دورك (النفر الكام)</label><input id="je-turn" class="field" inputmode="numeric" value="${j.turn ?? ''}" />
        <label class="lbl">مين ماسك الجمعية</label><input id="je-holder" class="field" value="${esc(j.holder)}" />
        <label class="lbl">رقمه</label><input id="je-phone" class="field" inputmode="tel" value="${esc(j.phone)}" />
        <button class="btn2" data-do="save-jam-edit" data-id="${esc(j.id)}">احفظ التعديل</button>
      </details>`,
  });
}
