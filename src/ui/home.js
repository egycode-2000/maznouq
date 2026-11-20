// The home screen, «المزيد», settings and «عن مزنوق». (The first setup is in ui/onboard.js.)
import { esc, money, item, page, ICONS } from './common.js';
import { homeSummary, dayReport, limitsReport } from '../reports.js';
import { peopleList, wording } from '../people.js';
import { backupDue } from '../state.js';
import { lockSettings } from './lock.js';
import { cashOf } from '../places.js';
import { showDate } from '../format.js';
import { showQty } from '../units.js';
import { APP_URL } from '../presets.js';
import qrcode from '../vendor/qrcode.js';

// A QR code drawn as SVG on the device (works offline).
function qrSvg(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

// ---------- Home ----------
// The home screen is a few round buttons. The one in the middle is big; pressing it opens its branches
// around it (as many as it has), pressing it again closes them. The others wait as small circles under it.
const RING = ['#2F8F86', '#C2185B', '#FB6C00', '#9DAA00', '#714B67'];

function hubStage(hub, open) {
  const branches = [];
  const n = branches.length;
  const R = 165;
  const spread = n > 1 ? Math.min(144, 36 * (n - 1) + 36) : 0;
  const reach = n ? Math.round(R * Math.sin((spread / 2) * Math.PI / 180)) + 46 : 0;
  const dia = n ? 150 : 190;
  const ring = dia / 2 + (n ? 14 : 20);
  const cx = n ? 287 : 195;
  const cy = Math.max(ring + 16, reach);
  const height = cy + Math.max(ring + 16, reach);
  const dots = n ? 26 : 30;
  let svg = '';
  for (let i = 0; i < dots; i += 1) {
    const a = (i / dots) * Math.PI * 2;
    svg += `<circle cx="${(cx + ring * Math.cos(a)).toFixed(1)}" cy="${(cy + ring * Math.sin(a)).toFixed(1)}" r="${n ? 4.5 : 5.5}" fill="${RING[Math.floor((i / dots) * 5) % 5]}"/>`;
  }
  let html = '';
  branches.forEach((b, i) => {
    const deg = 180 + spread / 2 - (n > 1 ? (spread * i) / (n - 1) : 0);
    const a = (deg * Math.PI) / 180;
    const x = cx + R * Math.cos(a);
    const y = cy + R * Math.sin(a);
    const col = RING[i % 5];
    svg += `<path d="M${(cx + (ring + 8) * Math.cos(a)).toFixed(1)} ${(cy + (ring + 8) * Math.sin(a)).toFixed(1)} L${(x - 33 * Math.cos(a)).toFixed(1)} ${(y - 33 * Math.sin(a)).toFixed(1)}" class="hub-link"/>`;
    const data = Object.entries(b.params ?? {}).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ');
    html += `
      <button type="button" class="hub-br" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;border-color:${col};color:${col};animation-delay:${i * 45}ms" data-go="${b.go}" ${data} aria-label="${esc(b.title)}">${esc(b.icon)}</button>
      <button type="button" class="hub-lab" style="right:${(390 - (x - 31) + 8).toFixed(1)}px;top:${y.toFixed(1)}px;width:${Math.min(150, x - 31 - 14).toFixed(0)}px" data-go="${b.go}" ${data}><b>${esc(b.title)}</b><span>${esc(b.sub ?? '')}</span></button>`;
  });
  const tap = hub.go
    ? `data-go="${hub.go}" ${Object.entries(hub.params ?? {}).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ')}`
    : `data-go="home" data-hub="${hub.id}" data-open="${open ? '' : '1'}"`;
  html += `
    <button type="button" class="hub-big ${open ? 'pressed' : ''} ${hub.neg ? 'neg' : ''}" style="left:${cx}px;top:${cy}px;width:${dia}px;height:${dia}px" ${tap}>
      <span class="l">${esc(hub.label)}</span>
      <span class="v" style="font-size:${n ? 22 : 28}px">${esc(hub.value)}</span>
      <span class="h">${esc(hub.go ? 'اضغط تفتح' : (open ? 'اضغط تاني يقفل' : `${hub.id === 'pocket' ? 'الفلوس اللي معاك · ' : ''}اضغط تشوف اللي جواها`))}</span>
    </button>`;
  return `<div class="hubwrap"><div class="hubstage" style="height:${height}px"><svg width="390" height="${height}" aria-hidden="true">${svg}</svg>${html}</div></div>`;
}

function hubMini(hub, i) {
  const tap = hub.go
    ? `data-go="${hub.go}" ${Object.entries(hub.params ?? {}).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ')}`
    : `data-go="home" data-hub="${hub.id}" data-open="1"`;
  return `
    <button type="button" class="hub-mini ${hub.alert ? 'alert' : ''}" ${tap}>
      <span class="c ${hub.neg ? 'neg' : ''}" style="border-color:${hub.red ? 'var(--danger)' : RING[hub.ring ?? i % 5]}">${hub.go ? '' : `<i class="n">${hub.branches.length}</i>`}${esc(hub.value.replace(' ج.م', ''))}</span>
      <b>${esc(hub.label)}</b>
      <span>${esc(hub.hint ?? '')}</span>
    </button>`;
}

// What a hub holds, in numbers, and what you can do from it: the card that opens under the big circle.
function hubCard(hub, m) {
  const rows = hub.rows.map((r) => (r.go
    ? `<button class="row link ${r.sub ? 'small sub' : ''}" data-go="${r.go}" ${Object.entries(r.params ?? {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}><span>${esc(r.label)}</span><b class="${r.cls ?? ''}">${esc(r.value)}</b></button>`
    : `<div class="row ${r.sub ? 'small sub' : ''} ${r.total ? 'total' : ''}"><span>${esc(r.label)}</span><b class="${r.cls ?? ''}">${esc(r.value)}</b></div>`)).join('');
  const actions = hub.branches.map((b) => `
    <button type="button" class="hub-act" data-go="${b.go}" ${Object.entries(b.params ?? {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>
      <i>${esc(b.icon)}</i><span><b>${esc(b.title)}</b><small>${esc(b.sub ?? '')}</small></span>
    </button>`).join('');
  return `
    <div class="card hub-card">
      <div class="lbl">جوه «${esc(hub.label)}»</div>
      ${rows || `<p class="hint">${esc(hub.empty ?? 'لسه مفيش حاجة هنا.')}</p>`}
      ${hub.note ? `<p class="hint">${esc(hub.note)}</p>` : ''}
      <div class="hub-acts">${actions}</div>
    </div>`;
}

export function homeScreen(ctx, p, flash) {
  const { d, book, today } = ctx;
  const h = homeSummary(book, d, today);
  const pic = h.picture;
  const cashId = cashOf(d)?.id ?? '';
  // «إخفاء الأرقام»: the home shows ••• instead of amounts, for when someone sees your phone.
  const hide = Boolean(d.settings.hideAmounts);
  const m = hide ? () => '•••' : money;
  const day = dayReport(book, d, today);
  const neg = (x) => (x < 0 ? 'neg' : '');

  const hubs = [{
    id: 'pocket', label: 'الكاش', value: m(pic.cash), neg: pic.cash < 0, ring: 2, hint: 'الفلوس اللي معاك',
    rows: [
      { label: 'اللي معاك دلوقتي', value: m(pic.cash), cls: neg(pic.cash) },
      { label: 'دخلك النهارده', value: m(day.totals.income), sub: true },
      { label: 'مصروفك النهارده', value: m(day.totals.expense), sub: true },
      ...(day.count ? [{ label: `راجع اللي اتسجل النهارده (${day.count})`, value: '←', go: 'today' }] : []),
    ],
    branches: [
      { icon: '−', title: 'مصروف', sub: 'سجّل اللي صرفته', go: 'expense' },
      { icon: '+', title: 'دخل', sub: 'فلوس دخلتلك', go: 'income-new' },
      { icon: '÷', title: 'وزّع', sub: 'على الأدراج', go: 'split' },
      { icon: '↔', title: 'تحويل', sub: 'وسحب كاش', go: 'transfer' },
      { icon: '#', title: 'عدّ الكاش', sub: 'طابق اللي معاك', go: 'count', params: { place: cashId } },
    ],
  }, {
    id: 'total', label: 'إجمالي فلوسك', value: m(pic.total), neg: pic.total < 0, ring: 0, hint: 'كاش ومحافظ وخزن',
    rows: [
      { label: 'الكاش', value: m(pic.cash), cls: neg(pic.cash) },
      ...pic.wallets.map((w) => ({ label: w.name, value: m(w.balance), cls: neg(w.balance) })),
      ...pic.safes.flatMap((sf) => [
        { label: sf.name, value: m(sf.total), go: 'safe', params: { id: sf.id } },
        ...sf.drawers.filter((g) => !g.units).map((g) => ({ label: g.name, value: m(g.balance), sub: true })),
      ]),
      { label: 'الإجمالي', value: m(pic.total), total: true, cls: neg(pic.total) },
      ...pic.units.filter((u) => u.qty > 0).map((u) => ({ label: `${u.name}: ${showQty(u.qty)} ${u.unit}`, value: `اتدفع فيهم ${m(u.cost)}`, sub: true })),
    ],
    note: 'الفلوس بتفضل محسوبة طول ما هي في أي مكان من دول، لحد ما تسجّل إنها اتصرفت. الدهب والوحدات مش داخلين في الإجمالي.',
    branches: [
      { icon: 'ك', title: 'الكاش والمحافظ', sub: 'تعديل وسحب كاش', go: 'wallets' },
      { icon: 'خ', title: 'الخزن والأدراج', sub: 'حط واسحب', go: 'safes', params: { back: 'home' } },
    ],
  }, {
    id: 'dues', label: 'عليك الشهر ده', value: m(h.remaining.total), ring: 1, hint: `يفضل بعدها ${m(h.afterDues)}`,
    rows: [
      ...(h.remaining.bills ? [{ label: 'فواتير والتزامات', value: m(h.remaining.bills) }] : []),
      ...(h.remaining.jamiya ? [{ label: 'أقساط جمعيات', value: m(h.remaining.jamiya) }] : []),
      ...(h.remaining.debtsOut ? [{ label: 'أقساط ديون', value: m(h.remaining.debtsOut) }] : []),
      ...h.soon.map((x) => ({ label: `${x.label} · ${showDate(x.date)}${x.overdue ? ' · متأخر' : ''}`, value: m(x.amount), sub: true, go: x.go, params: x.params, cls: x.overdue ? 'neg' : '' })),
      { label: 'يفضل معاك بعد ما تدفعهم', value: m(h.afterDues), total: true, cls: neg(h.afterDues) },
    ],
    empty: 'مفيش حاجة عليك الشهر ده.',
    branches: [
      { icon: '☰', title: 'الالتزامات', sub: 'كل حاجة بمعادها', go: 'dues' },
      { icon: '+', title: 'التزام جديد', sub: 'فاتورة أو إيجار', go: 'bill-new' },
      { icon: 'ج', title: 'جمعية جديدة', sub: 'بالأسئلة', go: 'jam-new' },
    ],
  }, {
    id: 'people', label: 'الحسابات', value: m(h.people.owedToMe - h.people.iOwe), neg: h.people.owedToMe < h.people.iOwe, ring: 4,
    hint: 'ليك وعليك عند الناس',
    rows: [
      { label: 'ليك عند الناس', value: m(h.people.owedToMe) },
      { label: 'عليك للناس', value: m(h.people.iOwe) },
      ...peopleList(book, d).filter((x) => x.balance !== 0).slice(0, 5).map((x) => ({
        label: x.name, value: hide ? '•••' : wording(x.balance), sub: true,
        go: { running: 'person', debt: 'debt', jamiya: 'jam' }[x.kind], params: { id: x.id },
      })),
    ],
    branches: [
      { icon: '☰', title: 'كل الحسابات', sub: 'الناس والديون', go: 'accounts' },
      { icon: '+', title: 'حساب جديد', sub: 'شخص رايح جاي', go: 'person-new' },
      { icon: '≡', title: 'تقرير الديون', sub: 'كل دين بخطواته', go: 'debts-report' },
    ],
  }];
  // «النهارده»: everything recorded today, to review line by line.
  if (day.count) {
    hubs.splice(1, 0, {
      id: 'today', label: 'النهارده', value: String(day.count), ring: 2, go: 'today',
      hint: [day.totals.expense ? `مصروف ${m(day.totals.expense)}` : '', day.totals.income ? `دخل ${m(day.totals.income)}` : ''].filter(Boolean).join(' · '),
    });
  }
  // «عدّى الحد»: categories past their monthly limit, until the month ends.
  const limits = limitsReport(book, d, today.slice(0, 7));
  if (limits.over.length) {
    hubs.push({
      id: 'over', label: 'عدّى الحد', value: String(limits.over.length), ring: 1, alert: true, red: true, go: 'categories',
      hint: limits.over.length === 1 ? `${limits.over[0].name} ${limits.over[0].percent}%` : limits.over.map((x) => x.name).join('، '),
    });
  }
  // These show only when there is something waiting, and stay until it is handled.
  for (const x of h.daily) {
    hubs.push({
      id: `daily-${x.template.id}`, label: `توزيع النهارده`, value: m(x.perDay * x.days), ring: 3, alert: true,
      hint: x.days > 1 ? `${x.template.name} · فاتك ${x.days} أيام` : `${x.template.name} · حطيتهم؟`, go: 'daily', params: { id: x.template.id },
    });
  }
  if (h.borrowsCount) {
    hubs.push({
      id: 'borrows', label: 'سلف لسه مارجعتش', value: m(h.borrowsTotal), ring: 1, alert: true,
      hint: `${h.borrowsCount} للأدراج`, go: 'borrows', params: { back: 'home' },
    });
  }
  const due = backupDue(d, today);
  if (due) {
    hubs.push({
      id: 'backup', label: 'نسخة احتياطية', value: '!', ring: 1, alert: true, red: true, go: 'settings',
      hint: d.settings.lastBackup ? `آخر نسخة من ${due} يوم` : 'لسه ماخدتش نسخة',
    });
  }

  const active = hubs.find((x) => x.id === p.hub && !x.go) ?? hubs[0];
  const open = Boolean(p.open) && p.hub === active.id;
  const minis = hubs.filter((x) => x !== active);

  const body = `
    ${hubStage(active, open)}
    ${open ? hubCard(active, m) : ''}
    <div class="hubrow">${minis.map(hubMini).join('')}</div>
    ${pic.units.some((u) => u.qty > 0) ? `
    <div class="card">
      <div class="lbl">حاجات شايلها (مش داخلة في الإجمالي)</div>
      ${pic.units.filter((u) => u.qty > 0).map((u) => `<button class="row link" data-go="drawer" data-id="${esc(u.id)}"><span>${esc(u.name)}: ${showQty(u.qty)} ${esc(u.unit)}</span><b>اتدفع فيهم ${m(u.cost)}</b></button>`).join('')}
    </div>` : ''}
    ${!open && h.soon.length ? `
    <div class="card">
      <div class="lbl">قريب أو متأخر</div>
      ${h.soon.map((s) => `
        <button class="row link ${s.overdue ? 'neg' : ''}" data-go="${s.go}" ${Object.entries(s.params).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>
          <span>${esc(s.label)} · ${showDate(s.date)}${s.overdue ? ' · متأخر' : ''}</span><b>${m(s.amount)}</b></button>`).join('')}
    </div>` : ''}
    <div class="card">
      <div class="row"><b>الشهر ده: ${h.month.surplus < 0 ? 'عجز' : 'فايض'} ${m(Math.abs(h.month.surplus))}</b><button class="linkbtn" data-go="month">ملخص الشهر ←</button></div>
      <div class="row small"><span>دخل الشهر</span><span>${m(h.month.income)}</span></div>
      <div class="row small"><span>مصروف الشهر</span><span>${m(h.month.expense)}</span></div>
    </div>`;
  const eye = `<button type="button" class="calc-top" data-do="toggle-hide" aria-label="${hide ? 'إظهار الأرقام' : 'إخفاء الأرقام'}">${hide ? ICONS.eyeOff : ICONS.eye}</button>`;
  return page({ title: `أهلًا ${d.name}`, sub: 'مزنوق؟ لمّ حساباتك', tab: 'home', body, flash, help: 'home', calc: true, tools: eye });
}

// ---------- More ----------
export function moreScreen(ctx, p, flash) {
  const { d } = ctx;
  return page({
    title: 'المزيد', tab: 'more', flash, help: 'more',
    body: `
      <div class="sect">فلوسك</div>
      ${item({ go: 'safes', title: 'الخزن والأدراج', right: String(d.safes.length), sub: 'فلوس متشالة لغرض: صدقات، عربية، دهب، محجوز لديون' })}
      ${item({ go: 'templates', title: 'التقسيمات والتوزيع اليومي', right: String(d.templates.length), sub: 'تقسيمات محفوظة، وتوزيع كل يوم على الأدراج' })}
      ${item({ go: 'income', title: 'الدخل ومصادره', right: String(d.sources.length) })}
      ${item({ go: 'transfer', title: 'تحويل وسحب كاش', sub: 'بين الكاش والمحافظ والأدراج، مع الخصم' })}
      ${item({ go: 'count', title: 'عدّ الفلوس', sub: 'عدّ الكاش أو أي درج، والبرنامج يسجّل الفرق' })}
      <div class="sect">السجل والتقارير</div>
      ${item({ go: 'log', title: 'سجل الحركات', sub: 'كل حركة بالتاريخ، مع البحث والعكس' })}
      ${item({ go: 'debts-report', title: 'تقرير الديون', sub: 'كل دين: أصله، اللي اتسدد، المحجوز، والباقي' })}
      ${item({ go: 'borrows', params: { back: 'more' }, title: 'سلف لسه مارجعتش', sub: 'فلوس خدتها من درج وهترجّعها' })}
      <div class="sect">التعديل</div>
      ${item({ go: 'wallets', title: 'الكاش والمحافظ', right: String(d.wallets.length), sub: 'الأسماء، خصم السحب، وإضافة محفظة' })}
      ${item({ go: 'categories', title: 'أوجه الصرف', right: String(d.categories.length), sub: 'الحد الشهري لكل وجه، وكشفه' })}
      ${item({ go: 'today', title: 'مراجعة النهارده', sub: 'كل اللي اتسجل في يوم، بند بند' })}
      ${item({ go: 'month', title: 'ملخص الشهر', sub: 'دخلك ومصروفك وأكتر حاجات صرفت فيها' })}
      <button class="card item" data-calc=""><span class="row"><b>آلة حاسبة</b>${ICONS.calc}</span></button>
      <div class="sect">البرنامج</div>
      ${item({ go: 'settings', title: 'الإعدادات', sub: 'القفل، الاسم، الشكل، الأمثلة، النسخة الاحتياطية' })}
      ${d.settings.lock ? '<button class="btn2" data-do="lock-now">اقفل البرنامج دلوقتي</button>' : ''}
      ${item({ go: 'about', title: 'عن مزنوق' })}`,
  });
}

export function settingsScreen(ctx, p, flash) {
  const { d } = ctx;
  const t = d.settings.theme;
  return page({
    title: 'الإعدادات', back: 'more', tab: 'more', flash, help: 'settings',
    body: `
      ${lockSettings(d.settings.lock)}
      <div class="card">
        <label class="lbl">اسمك</label>
        <input id="set-name" class="field" value="${esc(d.name)}" />
        <button class="btn2" data-do="save-name">احفظ الاسم</button>
      </div>
      <div class="card">
        <div class="lbl">الشكل</div>
        <div class="seg">
          <button data-do="save-theme" data-theme="auto" class="${t === 'auto' ? 'on' : ''}">تلقائي</button>
          <button data-do="save-theme" data-theme="light" class="${t === 'light' ? 'on' : ''}">نهاري</button>
          <button data-do="save-theme" data-theme="dark" class="${t === 'dark' ? 'on' : ''}">ليلي</button>
        </div>
      </div>
      <div class="card">
        <div class="lbl">صوت الزراير</div>
        <label class="check"><input type="checkbox" data-do="toggle-sound" ${d.settings.sound ? 'checked' : ''} /> تكّة مع كل ضغطة على الدواير والأرقام</label>
      </div>
      <div class="card">
        <div class="lbl">التنبيه قبل حد الصرف</div>
        <div class="limit-row">
          <input id="limit-warn" class="field" inputmode="numeric" value="${d.settings.limitWarn ?? 80}" placeholder="مثلا: 80" />
          <button class="btn2 mini-btn" data-do="save-limit-warn">احفظ</button>
        </div>
        <p class="hint">لما مصروف وجه يوصل النسبة دي من حدّه يجيلك تنبيه أصفر. لو عدّى الحد يبقى أحمر، ومفيش منع.</p>
      </div>
      <div class="card">
        <div class="lbl">الأمثلة</div>
        <label class="check"><input type="checkbox" data-do="toggle-examples" ${d.settings.autoExamples ? 'checked' : ''} /> اعرض المثال لوحده أول مرة أفتح أي صفحة</label>
        <button class="linkbtn" data-do="reset-examples">اعرض الأمثلة من الأول تاني</button>
        <p class="hint">زرار «مثال» فوق في كل صفحة شغال على طول.</p>
      </div>
      <button class="card item" data-go="restart">
        <span class="row"><b>ابدأ من الأول</b><span>←</span></span>
        <span class="hint">بداية جديدة بنفس الأسماء، أو امسح كل حاجة. الاتنين بينزّلوا نسخة احتياطية الأول.</span>
      </button>
      <div class="card">
        <div class="lbl">حماية بياناتك</div>
        ${{
          true: '<p class="hint ok-text">✓ بياناتك محمية: المتصفح مش هيمسحها لوحده لو المساحة قلّت.</p>',
          false: '<p class="hint">المتصفح لسه ماوافقش يحمي بياناتك من المسح التلقائي.</p><button class="btn2" data-do="protect-storage">احمي بياناتك</button>',
          null: '<p class="hint">المتصفح ده مش بيقول إذا كان هيحافظ على البيانات. النسخة الاحتياطية هي الضمان.</p>',
        }[String(ctx.persisted)]}
        <p class="hint">مفيش حاجة بتمنع حد يمسح بيانات المتصفح بإيده أو ببرنامج تنظيف، فخد نسخة احتياطية كل أسبوع.</p>
      </div>
      <div class="card">
        <div class="lbl">النسخة الاحتياطية</div>
        <p class="hint">نزّل ملف فيه كل بياناتك، واستعيده لو غيرت الجهاز أو اتمسح. اسمه بيبدأ بـ maznouq-backup وبعده التاريخ.</p>
        <label class="check"><input type="checkbox" id="backup-photos" checked /> مع صور الفواتير</label>
        <button class="btn2" data-do="export-backup">نزّل النسخة الاحتياطية</button>
        ${d.settings.lastBackup ? `<p class="hint">آخر نسخة: ${showDate(d.settings.lastBackup)}</p>` : ''}
        <label class="lbl">استعادة من ملف</label>
        <input class="field file" type="file" accept="application/json,.json" data-change="import" />
        <p class="hint">الاستعادة بتبدّل البيانات الحالية بالكامل.</p>
      </div>`,
  });
}

export function aboutScreen(ctx, p, flash) {
  return page({
    title: 'عن مزنوق', sub: 'مزنوق؟ لمّ حساباتك', back: 'more', tab: 'more', flash,
    body: `
      <div class="card"><div class="lbl">إيه البرنامج؟</div>
        <p class="hint">بيساعدك تعرف فلوسك فين، رايحة فين، وإيه اللي عليك وإيه اللي ليك عند الناس.</p></div>
      <div class="card"><div class="lbl">ليه هو مجاني؟</div>
        <p class="hint">مزنوق مجاني للكل. EGYCODE بتبني برامج تساعد الناس تنظّم شغلها وفلوسها.</p></div>
      <div class="card"><div class="lbl">بياناتك فين؟</div>
        <p class="hint">كل بياناتك محفوظة على جهازك بس. مفيش سيرفر بيستلمها، ومابنبيعش أي بيانات.</p></div>
      <div class="card share-card">
        <div class="lbl">ابعت البرنامج لحد</div>
        <p class="hint">صوّر الكود ده من موبايل تاني، أو ابعت اللينك على الواتساب.</p>
        <div class="qr">${qrSvg(APP_URL)}</div>
        <a class="btn" href="https://wa.me/?text=${encodeURIComponent(`جرّب مزنوق: برنامج مجاني ينظّم فلوسك، والبيانات على موبايلك بس. ${APP_URL}`)}" target="_blank" rel="noopener">ابعت على الواتساب</a>
        <button class="btn2" data-do="share-app">شير أو انسخ اللينك</button>
      </div>
      <button class="btn2" data-go="intro" data-i="0">شوف التعريف بالبرنامج تاني</button>`,
  });
}
