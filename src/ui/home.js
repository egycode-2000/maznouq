// First-run setup, the home screen, «المزيد», settings and «عن مزنوق».
import { esc, money, item, page, note, footer, ICONS } from './common.js';
import { homeSummary } from '../reports.js';
import { backupDue } from '../state.js';
import { lockSettings } from './lock.js';
import { cashOf } from '../places.js';
import { showDate } from '../format.js';
import { showQty } from '../units.js';

// ---------- Setup (first run) ----------
export const STEPS = ['الاسم', 'الكاش والمحافظ', 'مصادر الدخل', 'أوجه الصرف'];

export function setupScreen(draft, step, flash = '') {
  const dots = STEPS.map((_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('');
  let body = '';
  if (step === 0) {
    body = `
      <label class="lbl">إزاي أناديك؟</label>
      <input id="name" class="field" value="${esc(draft.name)}" placeholder="اكتب اسمك أو لقبك" data-autofocus />
      <p class="hint">الاسم بيظهر في الترحيب بس.</p>
      <details class="card">
        <summary>عندك نسخة احتياطية؟ رجّعها بدل الإعداد</summary>
        <input class="field file" type="file" accept="application/json,.json" data-change="import-setup" />
        <p class="hint">لو كان عليها رقم سري، هتعمل رقم جديد من الإعدادات.</p>
      </details>`;
  } else if (step === 1) {
    body = `
      <p class="hint">اكتب اللي معاك دلوقتي. ده هيبقى بداية الحساب، وتقدر تعدّله بعدين.</p>
      ${draft.wallets.map((w, i) => (i === 0 ? `
        <div class="card">
          <div class="lbl">الكاش اللي في جيبك</div>
          <input class="field" data-w-open="0" inputmode="decimal" value="${esc(w.opening)}" placeholder="المبلغ بالجنيه" data-autofocus />
        </div>` : `
        <div class="card">
          <input class="field" data-w-name="${i}" value="${esc(w.name)}" placeholder="اسم المحفظة (مثلا: فودافون كاش)" />
          <input class="field" data-w-open="${i}" inputmode="decimal" value="${esc(w.opening)}" placeholder="الرصيد بالجنيه" />
        </div>`)).join('')}
      <button class="btn2" data-do="setup-add-wallet">+ محفظة (فودافون كاش، إنستاباي، بنك)</button>
      <p class="hint">الخزن والأدراج والجمعيات والديون بتتضاف بعد الإعداد.</p>`;
  } else if (step === 2) {
    body = `
      <p class="hint">من فين بتدخلك فلوس؟ كل مصدر شهري أو مفتوح.</p>
      ${draft.sources.map((s, i) => `
        <div class="card">
          <input class="field" data-s-name="${i}" value="${esc(s.name)}" placeholder="اسم المصدر" />
          <div class="seg">
            <button data-do="setup-kind" data-idx="${i}" data-kind="monthly" class="${s.kind === 'monthly' ? 'on' : ''}">شهري</button>
            <button data-do="setup-kind" data-idx="${i}" data-kind="open" class="${s.kind === 'open' ? 'on' : ''}">مفتوح</button>
          </div>
        </div>`).join('')}
      <button class="btn2" data-do="setup-add-source">+ مصدر تاني</button>`;
  } else {
    body = `
      <p class="hint">بتصرف على إيه؟ اختار اللي يهمك، وتقدر تضيف بعدين.</p>
      <div class="chips">
        ${draft.categories.map((c, i) => `
          <button class="chip ${c.on ? 'on' : ''}" data-do="setup-cat" data-idx="${i}">${esc(c.name)}</button>`).join('')}
      </div>`;
  }
  const last = step === STEPS.length - 1;
  return `
    <section class="phone">
      <header class="top">
        <div class="toprow">
          ${step > 0 ? `<button class="backbtn" data-do="setup-back">${ICONS.back}<span>رجوع</span></button>` : '<span></span>'}
        </div>
        <h1>أهلًا بيك في مزنوق</h1>
        <p>${esc(STEPS[step])}</p>
        <div class="steps">${dots}</div>
      </header>
      <div class="body">
        ${note(flash)}
        ${body}
        <div class="spacer"></div>
        <button class="btn" data-do="setup-next">${last ? 'خلّصنا، ابدأ' : 'كمّل'}</button>
      </div>
      ${footer()}
    </section>`;
}

// ---------- Home ----------
// The home screen is a few round buttons. The one in the middle is big; pressing it opens its branches
// around it (as many as it has), pressing it again closes them. The others wait as small circles under it.
const RING = ['#2F8F86', '#C2185B', '#FB6C00', '#9DAA00', '#714B67'];

function hubStage(hub, open) {
  const branches = open ? hub.branches : [];
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
    <button type="button" class="hub-big ${n ? 'pressed' : ''} ${hub.neg ? 'neg' : ''}" style="left:${cx}px;top:${cy}px;width:${dia}px;height:${dia}px" ${tap}>
      <span class="l">${esc(hub.label)}</span>
      <span class="v" style="font-size:${n ? 22 : 28}px">${esc(hub.value)}</span>
      <span class="h">${esc(hub.go ? 'اضغط تفتح' : (n ? 'اضغط تاني يقفل' : `اضغط · ${hub.branches.length} اختيارات`))}</span>
    </button>`;
  return `<div class="hubwrap"><div class="hubstage" style="height:${height}px"><svg width="390" height="${height}" aria-hidden="true">${svg}</svg>${html}</div></div>`;
}

function hubMini(hub, i) {
  const tap = hub.go
    ? `data-go="${hub.go}" ${Object.entries(hub.params ?? {}).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ')}`
    : `data-go="home" data-hub="${hub.id}" data-open="1"`;
  return `
    <button type="button" class="hub-mini ${hub.alert ? 'alert' : ''}" ${tap}>
      <span class="c ${hub.neg ? 'neg' : ''}" style="border-color:${RING[hub.ring ?? i % 5]}">${hub.go ? '' : `<i class="n">${hub.branches.length}</i>`}${esc(hub.value.replace(' ج.م', ''))}</span>
      <b>${esc(hub.label)}</b>
      <span>${esc(hub.hint ?? '')}</span>
    </button>`;
}

export function homeScreen(ctx, p, flash) {
  const { d, book, today } = ctx;
  const h = homeSummary(book, d, today);
  const pic = h.picture;
  const cashId = cashOf(d)?.id ?? '';

  const hubs = [{
    id: 'pocket', label: 'في جيبك', value: money(pic.cash), neg: pic.cash < 0, ring: 2, hint: 'الكاش، مصروفك',
    branches: [
      { icon: '−', title: 'مصروف', sub: 'سجّل اللي صرفته', go: 'expense' },
      { icon: '+', title: 'دخل', sub: 'فلوس دخلتلك', go: 'income-new' },
      { icon: '÷', title: 'وزّع', sub: 'على الأدراج', go: 'split' },
      { icon: '↔', title: 'تحويل', sub: 'وسحب كاش', go: 'transfer' },
      { icon: '#', title: 'عدّ الكاش', sub: 'طابق اللي في جيبك', go: 'count', params: { place: cashId } },
    ],
  }, {
    id: 'total', label: 'إجمالي فلوسك', value: money(pic.total), neg: pic.total < 0, ring: 0, hint: 'كاش ومحافظ وخزن',
    branches: [
      { icon: 'ك', title: 'الكاش', sub: money(pic.cash), go: 'wallets' },
      ...(pic.wallets.length ? [{ icon: 'م', title: 'المحافظ', sub: money(pic.walletsTotal), go: 'wallets' }] : []),
      { icon: 'خ', title: 'الخزن', sub: money(pic.safesTotal), go: 'safes', params: { back: 'home' } },
    ],
  }, {
    id: 'dues', label: 'عليك الشهر ده', value: money(h.remaining.total), ring: 1, hint: `يفضل بعدها ${money(h.afterDues)}`,
    branches: [
      { icon: '☰', title: 'الالتزامات', sub: `يفضل بعدها ${money(h.afterDues)}`, go: 'dues' },
      { icon: '+', title: 'التزام جديد', sub: 'فاتورة أو إيجار', go: 'bill-new' },
      { icon: 'ج', title: 'جمعية جديدة', sub: 'بالأسئلة', go: 'jam-new' },
    ],
  }, {
    id: 'people', label: 'الحسابات', value: money(h.people.owedToMe - h.people.iOwe), neg: h.people.owedToMe < h.people.iOwe, ring: 4,
    hint: 'ليك وعليك عند الناس',
    branches: [
      { icon: '↓', title: 'ليك عند الناس', sub: money(h.people.owedToMe), go: 'accounts' },
      { icon: '↑', title: 'عليك للناس', sub: money(h.people.iOwe), go: 'accounts' },
      { icon: '+', title: 'حساب جديد', sub: 'شخص رايح جاي', go: 'person-new' },
      { icon: '≡', title: 'تقرير الديون', sub: 'كل دين بخطواته', go: 'debts-report' },
    ],
  }];
  // These two show only when there is something waiting, and stay until it is handled.
  for (const x of h.daily) {
    hubs.push({
      id: `daily-${x.template.id}`, label: `توزيع النهارده`, value: money(x.perDay * x.days), ring: 3, alert: true,
      hint: x.days > 1 ? `${x.template.name} · فاتك ${x.days} أيام` : `${x.template.name} · حطيتهم؟`, go: 'daily', params: { id: x.template.id },
    });
  }
  if (h.borrowsCount) {
    hubs.push({
      id: 'borrows', label: 'سلف لسه مارجعتش', value: money(h.borrowsTotal), ring: 1, alert: true,
      hint: `${h.borrowsCount} للأدراج`, go: 'borrows', params: { back: 'home' },
    });
  }

  const active = hubs.find((x) => x.id === p.hub && !x.go) ?? hubs[0];
  const open = Boolean(p.open) && p.hub === active.id;
  const minis = hubs.filter((x) => x !== active);

  const breakdown = active.id === 'total' && open ? `
    <div class="card">
      <div class="row"><span>الكاش</span><b>${money(pic.cash)}</b></div>
      ${pic.wallets.map((w) => `<div class="row"><span>${esc(w.name)}</span><b class="${w.balance < 0 ? 'neg' : ''}">${money(w.balance)}</b></div>`).join('')}
      ${pic.safes.map((s) => `
        <button class="row link" data-go="safe" data-id="${esc(s.id)}"><span>${esc(s.name)}</span><b>${money(s.total)}</b></button>
        ${s.drawers.filter((g) => !g.units).map((g) => `<div class="row small sub"><span>${esc(g.name)}</span><span>${money(g.balance)}</span></div>`).join('')}`).join('')}
      <div class="row total"><span>الإجمالي</span><b>${money(pic.total)}</b></div>
      <p class="hint">الفلوس بتفضل محسوبة طول ما هي في أي مكان من دول، لحد ما تسجّل إنها اتصرفت.</p>
    </div>` : '';

  const body = `
    ${hubStage(active, open)}
    <div class="hubrow">${minis.map(hubMini).join('')}</div>
    ${breakdown}
    ${pic.units.some((u) => u.qty > 0) ? `
    <div class="card">
      <div class="lbl">حاجات شايلها (مش داخلة في الإجمالي)</div>
      ${pic.units.filter((u) => u.qty > 0).map((u) => `<button class="row link" data-go="drawer" data-id="${esc(u.id)}"><span>${esc(u.name)}: ${showQty(u.qty)} ${esc(u.unit)}</span><b>اتدفع فيهم ${money(u.cost)}</b></button>`).join('')}
    </div>` : ''}
    ${backupDue(d, today) ? `
    <button class="card item warn-card" data-go="settings">
      <span class="row"><b>خد نسخة احتياطية</b><span>${d.settings.lastBackup ? `آخر نسخة من ${backupDue(d, today)} يوم` : 'لسه ماخدتش نسخة'}</span></span>
      <span class="hint">لو الموبايل ضاع أو اتمسح، النسخة هي اللي بترجّع فلوسك.</span>
    </button>` : ''}
    ${h.soon.length ? `
    <div class="card">
      <div class="lbl">قريب أو متأخر</div>
      ${h.soon.map((s) => `
        <button class="row link ${s.overdue ? 'neg' : ''}" data-go="${s.go}" ${Object.entries(s.params).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>
          <span>${esc(s.label)} · ${showDate(s.date)}${s.overdue ? ' · متأخر' : ''}</span><b>${money(s.amount)}</b></button>`).join('')}
    </div>` : ''}
    <details class="card">
      <summary>الشهر ده: ${h.month.surplus < 0 ? 'عجز' : 'فايض'} ${money(Math.abs(h.month.surplus))}</summary>
      <div class="row small"><span>دخل الشهر</span><span>${money(h.month.income)}</span></div>
      <div class="row small"><span>مصروف الشهر</span><span>${money(h.month.expense)}</span></div>
      <p class="hint">ده مش ربح. اللي بتشيله في الأدراج وسداد الديون وأقساط الجمعيات مش داخلين فيه.</p>
    </details>`;
  return page({ title: `أهلًا ${d.name}`, sub: 'مزنوق؟ لمّ حساباتك', tab: 'home', body, flash, help: 'home' });
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
      ${item({ go: 'budgets', title: 'الميزانية', sub: 'حد شهري لكل وجه صرف' })}
      <div class="sect">السجل والتقارير</div>
      ${item({ go: 'log', title: 'سجل الحركات', sub: 'كل حركة بالتاريخ، مع البحث والعكس' })}
      ${item({ go: 'debts-report', title: 'تقرير الديون', sub: 'كل دين: أصله، اللي اتسدد، المحجوز، والباقي' })}
      ${item({ go: 'borrows', params: { back: 'more' }, title: 'سلف لسه مارجعتش', sub: 'فلوس خدتها من درج وهترجّعها' })}
      <div class="sect">التعديل</div>
      ${item({ go: 'wallets', title: 'الكاش والمحافظ', right: String(d.wallets.length), sub: 'الأسماء، خصم السحب، وإضافة محفظة' })}
      ${item({ go: 'categories', title: 'أوجه الصرف', right: String(d.categories.length) })}
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
        <div class="lbl">الأمثلة</div>
        <label class="check"><input type="checkbox" data-do="toggle-examples" ${d.settings.autoExamples ? 'checked' : ''} /> اعرض المثال لوحده أول مرة أفتح أي صفحة</label>
        <button class="linkbtn" data-do="reset-examples">اعرض الأمثلة من الأول تاني</button>
        <p class="hint">زرار «مثال» فوق في كل صفحة شغال على طول.</p>
      </div>
      <div class="card">
        <div class="lbl">النسخة الاحتياطية</div>
        <p class="hint">نزّل ملف فيه كل بياناتك، واستعيده لو غيرت الجهاز.</p>
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
        <p class="hint">كل بياناتك محفوظة على جهازك بس. مفيش سيرفر بيستلمها، ومابنبيعش أي بيانات.</p></div>`,
  });
}
