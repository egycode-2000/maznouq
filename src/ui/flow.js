// الأسئلة واحدة واحدة: one question per screen for income, expense, splitting and setting up a daily split.
// The questions and their order come from src/flow.js; this file only draws the current one.
import { esc, money, plain, circle, circles, calcBtn, dateField, noteField, note, footer, ICONS } from './common.js';
import { amountOf, poolOf, restOf, shortOf, linesOf, MISC } from '../flow.js';
import { cashOf, defaultPlace } from '../places.js';
import { openBorrows } from '../reports.js';
import { leftOf } from '../borrows.js';
import { hasGoal } from '../moves.js';

const TITLES = {
  expense: {
    amount: 'صرفت كام؟', from: 'صرفت منين؟', wallet: 'أنهي محفظة؟', fsafe: 'أنهي خزنة؟', fdrawer: 'أنهي درج؟',
    cat: 'صرفت في إيه؟', newcat: 'اسم الباب الجديد', back: 'هترجّعهم للدرج؟', cover: 'تكمّل منين؟',
  },
  income: {
    amount: 'دخلك كام؟', to: 'ينزل فين؟', source: 'جه منين؟', newsource: 'اسم المصدر الجديد', dist: 'هتوزّع منه؟',
    dsafe: 'توزّع على أنهي خزنة؟', ddrawers: 'كام في كل درج؟', dcats: 'صرفت منه كام على طول؟', drepay: 'ترجّع كام للأدراج؟',
    review: 'راجع قبل التسجيل',
  },
  split: {
    from: 'هتوزّع منين؟', wallet: 'أنهي محفظة؟', stpl: 'توزّع إزاي؟', amount: 'هتوزّع كام؟', dsafe: 'توزّع على أنهي خزنة؟',
    ddrawers: 'كام في كل درج؟', dcats: 'صرفت كام على طول؟', drepay: 'ترجّع كام للأدراج؟', review: 'راجع قبل التوزيع',
  },
  daily: {
    name: 'اسم التوزيع اليومي', from: 'بيتسحب منين كل يوم؟', wallet: 'أنهي محفظة؟', dsafe: 'على أنهي خزنة؟',
    ddrawers: 'كام كل يوم في كل درج؟', dcats: 'كام كل يوم مصروف على طول؟', review: 'راجع التوزيع اليومي',
  },
};
const HELP = { expense: 'flow-expense', income: 'flow-income', split: 'flow-split', daily: 'flow-daily' };
const KIND_NAME = { expense: 'مصروف', income: 'دخل', split: 'توزيع', daily: 'توزيع يومي' };

const pickAttr = (value) => `data-do="flow-pick" data-value="${esc(value)}"`;
const nameOf = (ctx, id) => ctx.places.find((x) => x.id === id)?.name ?? '';

// What was answered so far, shown under the question so you never lose your place.
function trail(flow, ctx) {
  const d = flow.data;
  const parts = [d.editOf ? `تعديل ${KIND_NAME[flow.kind]}` : KIND_NAME[flow.kind]];
  if (flow.kind === 'daily' && d.name) parts.push(d.name);
  if (amountOf(flow) && flow.step !== 'amount') parts.push(money(amountOf(flow)));
  const placeId = flow.kind === 'income' ? d.to : d.from;
  const placeStep = flow.kind === 'income' ? 'to' : 'from';
  if (placeId && flow.history.includes(placeStep)) parts.push(`${flow.kind === 'income' ? 'في' : 'من'} ${nameOf(ctx, placeId)}`);
  return parts.join(' · ');
}

function amountStep(flow, ctx) {
  const d = flow.data;
  return `
    <div class="amt-circle">
      <input id="flow-amount" class="amt-input" inputmode="none" autocomplete="off" placeholder="0" value="${esc(d.amount)}" data-autofocus ${d.amount ? 'data-fresh="1"' : ''} />
      <span>ج.م</span>
    </div>
    <div class="keys">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => `<button type="button" class="key" data-key="${k}">${k === 'del' ? '⌫' : k}</button>`).join('')}
    </div>
    <div class="row">
      ${calcBtn('flow-amount')}
      <button class="btn grow" data-do="flow-ok">التالي</button>
    </div>
    ${flow.kind === 'expense' || flow.kind === 'income' ? `
    <details class="card">
      <summary>التاريخ والملحوظة وصورة الفاتورة (اختياري)</summary>
      ${dateField(ctx.today, 'date', d.date || ctx.today)}
      ${noteField('note', d.note)}
      <label class="lbl" for="photo">صورة الفاتورة</label>
      <input id="photo" class="field file" type="file" accept="image/*" />
    </details>` : ''}`;
}

const textStep = (placeholder, value = '') => `
  <input id="flow-text" class="field big-field" placeholder="${esc(placeholder)}" value="${esc(value)}" data-autofocus />
  <button class="btn" data-do="flow-ok">التالي</button>`;

// Where money comes from or lands: the cash, then the wallets, then (for spending) the safes.
function placeStep(flow, ctx, { safes }) {
  const { d, places } = ctx;
  const cash = places.find((x) => x.kind === 'cash');
  const wallets = places.filter((x) => x.kind === 'wallet');
  const chosen = (flow.kind === 'income' ? flow.data.to : flow.data.from) || defaultPlace(d, places);
  const list = [circle({ label: cash.name, sub: money(cash.balance), inner: plain(cash.balance), ring: 2, on: chosen === cash.id, attrs: pickAttr(cash.id) })];
  if (wallets.length && wallets.length <= 2) {
    wallets.forEach((w, i) => list.push(circle({ label: w.name, sub: money(w.balance), inner: plain(w.balance), ring: i, on: chosen === w.id, attrs: pickAttr(w.id) })));
  } else if (wallets.length) {
    list.push(circle({ label: 'محفظة', sub: `${wallets.length} محافظ`, inner: 'م', ring: 0, badge: wallets.length, on: wallets.some((w) => w.id === chosen), attrs: pickAttr('__wallets') }));
  }
  const withMoney = places.filter((x) => x.kind === 'drawer');
  if (safes && withMoney.length) {
    list.push(circle({ label: 'خزنة', sub: 'من درج', inner: 'خ', ring: 4, badge: d.safes.length, on: withMoney.some((x) => x.id === chosen), attrs: pickAttr('__safes') }));
  }
  return circles(list);
}

function listStep(rows) {
  return `<div class="picklist">${rows.map((r) => `
    <button type="button" class="card item ${r.on ? 'sel' : ''}" ${pickAttr(r.value)}>
      <span class="row"><b>${esc(r.title)}</b><b>${esc(r.right ?? '')}</b></span>
      ${r.sub ? `<span class="hint">${esc(r.sub)}</span>` : ''}
    </button>`).join('')}</div>`;
}

function restLine(flow, ctx) {
  const pool = poolOf(flow, ctx);
  if (pool === null) return '';
  const rest = restOf(flow, ctx);
  return `<div class="rest-line">فاضل من الـ ${money(pool)}: <b>${money(rest)}</b></div>`;
}

// One amount next to each drawer (or باب, or borrow) with its own «تأكيد».
function linesStep(flow, ctx, group, rows, emptyText) {
  const bag = group === 'repay' ? flow.data.repays : flow.data.lines;
  return `
    ${restLine(flow, ctx)}
    ${rows.map((r) => `
      <div class="card line-row ${bag[r.id] ? 'done' : ''}">
        <span class="split-name"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span>
        <input class="field split-val" id="fl-${esc(r.id)}" data-line="${esc(r.id)}" data-group="${group}" inputmode="decimal" placeholder="0" value="${esc(bag[r.id] ?? '')}" />
        <button type="button" class="btn2 mini-btn" data-do="flow-line" data-group="${group}" data-id="${esc(r.id)}">${bag[r.id] ? '✓ اتأكد' : 'تأكيد'}</button>
      </div>`).join('') || `<p class="hint">${emptyText}</p>`}
    <div class="row">
      <button class="btn2 grow" data-do="flow-jump" data-step="dsafe">${flow.kind === 'daily' ? 'خزنة تانية' : 'خزنة تانية أو حاجة تانية'}</button>
      <button class="btn grow" data-do="flow-jump" data-step="review">${flow.kind === 'daily' ? 'خلصت' : 'خلصت توزيع'}</button>
    </div>`;
}

function reviewStep(flow, ctx) {
  const d = flow.data;
  const { rows, repays, total } = linesOf(flow, ctx);
  const pool = poolOf(flow, ctx);
  const placeId = flow.kind === 'income' ? d.to : d.from;
  const srcName = d.source === '__new' ? d.newSource : (d.source === MISC ? 'دخل متفرق' : ctx.d.sources.find((s) => s.id === d.source)?.name ?? '');
  const head = {
    income: `<div class="row"><b>دخل من ${esc(srcName)}</b><b>${money(amountOf(flow))}</b></div><div class="row small"><span>نزل في</span><span>${esc(nameOf(ctx, placeId))}</span></div>`,
    split: `<div class="row"><b>توزيع من ${esc(nameOf(ctx, placeId))}</b><b>${money(total)}</b></div>`,
    daily: `<div class="row"><b>${esc(d.name)}</b><b>${money(total)} كل يوم</b></div><div class="row small"><span>بيتسحب من</span><span>${esc(nameOf(ctx, placeId))}</span></div>`,
  }[flow.kind];
  const lines = [
    ...rows.map((r) => `<div class="row"><span>${esc(r.name)} <small class="hint">${esc(r.sub)}</small></span><b>${money(r.amount)}</b></div>`),
    ...repays.map((r) => `<div class="row"><span>رجّعت لـ ${esc(r.name)} <small class="hint">سلفة</small></span><b>${money(r.amount)}</b></div>`),
  ].join('');
  const canName = flow.kind !== 'daily' && rows.length && !d.tplName;
  return `
    <div class="card">
      ${head}
      ${lines ? `<div class="sep"></div>${lines}` : ''}
      ${pool !== null && flow.kind === 'income' ? `<div class="row total"><span>الباقي يفضل في ${esc(nameOf(ctx, placeId))}</span><b>${money(pool - total)}</b></div>` : ''}
      ${flow.kind === 'split' ? `<div class="row total"><span>يفضل في ${esc(nameOf(ctx, placeId))}</span><b>${money(pool - total)}</b></div>` : ''}
      ${d.tplName ? `<span class="hint">بتقسيمة «${esc(d.tplName)}»</span>` : ''}
    </div>
    ${flow.kind === 'daily' ? '<p class="hint">كل يوم هتلاقي دايرة في الرئيسية تسألك «حطيتهم؟». اللي ماتعلّمش عليه مش بيتخصم.</p>' : ''}
    ${canName ? `<input id="flow-save" class="field" placeholder="احفظها كتقسيمة باسم (اختياري)" value="${esc(d.saveName)}" />` : ''}
    <button class="btn" data-do="flow-ok">${{ income: 'سجّل', split: 'وزّع', daily: 'احفظ التوزيع اليومي' }[flow.kind]}</button>
    <button class="btn2" data-do="flow-back">رجوع أعدّل</button>`;
}

function stepBody(flow, ctx) {
  const { d, places } = ctx;
  const f = flow.data;
  const drawers = places.filter((x) => x.kind === 'drawer');
  switch (flow.step) {
    case 'amount': return amountStep(flow, ctx);
    case 'newcat': return textStep('مثلا: بنزين', f.newCat);
    case 'newsource': return textStep('مثلا: دروس خصوصية', f.newSource);
    case 'name': return textStep('مثلا: يومي العربية', f.name);
    case 'from': return placeStep(flow, ctx, { safes: flow.kind === 'expense' });
    case 'to': return placeStep(flow, ctx, { safes: false });
    case 'wallet':
      return listStep(places.filter((x) => x.kind === 'wallet').map((w) => ({ value: w.id, title: w.name, right: money(w.balance), on: f.from === w.id })));
    case 'fsafe':
      return circles(d.safes.map((s, i) => circle({
        label: s.name, sub: `${drawers.filter((x) => x.safeId === s.id).length} أدراج`, ring: i, attrs: pickAttr(s.id),
        on: drawers.some((x) => x.id === f.from && x.safeId === s.id),
      })));
    case 'fdrawer': {
      const mine = drawers.filter((x) => x.safeId === f.safe);
      return `
        ${circles(mine.map((x, i) => circle({ label: x.name, sub: money(x.balance), inner: plain(x.balance), ring: i, on: f.from === x.id, attrs: pickAttr(x.id) })))}
        ${mine.length ? '' : '<p class="hint">الخزنة دي مفيهاش أدراج فيها فلوس.</p>'}
        <label class="check"><input type="checkbox" data-do="flow-other" ${f.other ? 'checked' : ''} /> هصرف من الدرج على حاجة تانية غير اسمه</label>
        <p class="hint">الدرج اللي مالوش هدف (زي الصدقات) بيتسجل مصروفه باسمه على طول. الدرج اللي ليه هدف بيسألك صرفت في إيه وهترجّعهم ولا لأ.</p>`;
    }
    case 'cat': {
      const sel = f.category || d.settings.lastCategory;
      return circles([
        ...d.categories.map((c, i) => circle({ label: c.name, ring: i, on: c.id === sel, attrs: pickAttr(c.id) })),
        circle({ label: 'باب جديد', inner: '+', ring: 4, attrs: pickAttr('__new') }),
      ]);
    }
    case 'back':
      return circles([
        circle({ label: 'أيوه، هرجّعهم', sub: 'تتسجل سلفة للدرج', inner: '↩', ring: 0, on: f.back === 'yes', attrs: pickAttr('yes') }),
        circle({ label: 'لأ، اتصرفوا', sub: 'خلاص', inner: '✓', ring: 2, on: f.back === 'no', attrs: pickAttr('no') }),
      ]);
    case 'cover': {
      const short = shortOf(flow, ctx);
      const from = places.find((x) => x.id === f.from);
      const can = places.filter((x) => x.id !== f.from && x.kind !== 'unit' && x.balance >= short);
      return `
        <div class="card warn-card"><b>${esc(from?.name ?? '')} فيه ${money(Math.max(0, from?.balance ?? 0))}، ناقص ${money(short)}</b></div>
        ${circles(can.map((x, i) => circle({ label: x.name, sub: money(x.balance), inner: plain(x.balance), ring: i, attrs: pickAttr(x.id) })))}
        ${can.length ? '' : '<p class="hint">مفيش مكان فيه الناقص ده. ارجع وغيّر المبلغ أو المكان.</p>'}`;
    }
    case 'source': {
      const known = [...d.sources, ...(ctx.archived?.source ?? [])].some((s) => s.id === MISC);
      const list = known ? d.sources : [...d.sources, { id: MISC, name: 'دخل متفرق' }];
      const sel = f.source || d.settings.lastSource;
      return circles([
        ...list.map((s, i) => circle({ label: s.name, ring: i, on: s.id === sel, attrs: pickAttr(s.id) })),
        circle({ label: 'مصدر جديد', inner: '+', ring: 4, attrs: pickAttr('__new') }),
      ]);
    }
    case 'dist': {
      const place = nameOf(ctx, f.to);
      const saved = d.templates.filter((t) => !t.daily);
      return `
        ${circles([
          circle({ label: `لأ، كله في ${place}`, inner: '✓', ring: 2, attrs: pickAttr('no') }),
          circle({ label: 'أيوه، أوزّع', sub: 'على الأدراج', inner: '÷', ring: 0, attrs: pickAttr('yes') }),
        ])}
        ${saved.length ? `<div class="lbl">أو بتقسيمة محفوظة</div>${listStep(saved.map((t) => ({ value: t.id, title: t.name, sub: `${t.rows.length} سطور` })))}` : ''}`;
    }
    case 'stpl': {
      const saved = d.templates.filter((t) => !t.daily);
      return `
        ${circles([circle({ label: 'أوزّع بنفسي', sub: 'درج درج', inner: '÷', ring: 0, attrs: pickAttr('manual') })])}
        <div class="lbl">أو بتقسيمة محفوظة</div>
        ${listStep(saved.map((t) => ({ value: t.id, title: t.name, sub: `${t.rows.length} سطور` })))}`;
    }
    case 'dsafe': {
      const open = flow.kind === 'daily' ? [] : openBorrows(d).filter((b) => drawers.some((x) => x.id === b.fromId));
      const count = (ids) => ids.filter((id) => f.lines[id]).length;
      const list = [];
      if (open.length) {
        list.push(circle({ label: 'رجّع سلف الأدراج', sub: money(open.reduce((s, b) => s + leftOf(b), 0)), inner: '↩', ring: 1, badge: open.length, on: Object.keys(f.repays).length > 0, attrs: pickAttr('__repay') }));
      }
      d.safes.forEach((s, i) => {
        const ids = drawers.filter((x) => x.safeId === s.id).map((x) => x.id);
        list.push(circle({ label: s.name, sub: `${ids.length} أدراج`, ring: i, badge: count(ids) || '', on: count(ids) > 0, attrs: pickAttr(s.id) }));
      });
      const catIds = d.categories.map((c) => c.id);
      list.push(circle({ label: 'مصروف على طول', sub: 'زي صدقة طلعت في ساعتها', inner: '−', ring: 3, badge: count(catIds) || '', on: count(catIds) > 0, attrs: pickAttr('__cats') }));
      return `
        ${restLine(flow, ctx)}
        ${circles(list)}
        ${d.safes.length ? '' : '<p class="hint">مفيش خزن لسه. اعمل خزنة وأدراجها من المزيد ← الخزن والأدراج.</p>'}
        <button class="btn" data-do="flow-jump" data-step="review">${flow.kind === 'daily' ? 'خلصت' : 'خلصت توزيع'}</button>`;
    }
    case 'ddrawers': {
      const safe = d.safes.find((s) => s.id === f.safe);
      const rows = drawers.filter((x) => x.safeId === f.safe).map((x) => {
        const g = d.goals.find((y) => y.accountId === x.id);
        return { id: x.id, name: x.name, sub: `فيه ${money(x.balance)}${g && hasGoal(g) ? ` · الهدف ${money(g.target)}` : ''}` };
      });
      return `<div class="sect">${esc(safe?.name ?? '')}</div>${linesStep(flow, ctx, 'line', rows, 'الخزنة دي مفيهاش أدراج فلوس. ضيف درج من المزيد ← الخزن والأدراج.')}`;
    }
    case 'dcats':
      return linesStep(flow, ctx, 'line', d.categories.map((c) => ({ id: c.id, name: c.name, sub: 'بيتسجل مصروف على طول' })), 'مفيش أبواب صرف.');
    case 'drepay':
      return linesStep(flow, ctx, 'repay', openBorrows(d).filter((b) => drawers.some((x) => x.id === b.fromId)).map((b) => ({
        id: b.id, name: nameOf(ctx, b.fromId), sub: `مستني يرجعله ${money(leftOf(b))}${b.note ? ` · ${b.note}` : ''}`,
      })), 'مفيش سلف مفتوحة.');
    case 'review': return reviewStep(flow, ctx);
    default: return '';
  }
}

export function flowScreen(ctx, p, flash) {
  const flow = ctx.flow;
  if (!flow) return '';
  const title = flow.data.editOf && flow.step === 'amount'
    ? { expense: 'المصروف كان كام؟', income: 'الدخل كان كام؟' }[flow.kind]
    : TITLES[flow.kind][flow.step] ?? '';
  return `
    <section class="phone flow">
      <header class="top">
        <div class="toprow">
          <button class="backbtn" data-do="flow-back">${ICONS.back}<span>رجوع</span></button>
          <button class="helpbtn" data-help="${HELP[flow.kind]}">${ICONS.help}<span>مثال</span></button>
        </div>
        <p>${esc(trail(flow, ctx))}</p>
        <h1>${esc(title)}</h1>
      </header>
      <div class="body">
        ${note(flash)}
        ${stepBody(flow, ctx)}
        <div class="spacer"></div>
        <button class="linkbtn" data-do="flow-cancel">إلغاء وارجع</button>
      </div>
      ${footer()}
    </section>`;
}
