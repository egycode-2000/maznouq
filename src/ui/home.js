// First-run setup, the home screen, «المزيد», settings and «عن مزنوق».
import { esc, money, item, page, note, footer, ICONS } from './common.js';
import { homeSummary } from '../reports.js';
import { backupDue } from '../state.js';
import { lockSettings } from './lock.js';
import { cashOf } from '../places.js';
import { showDate } from '../format.js';

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
export function homeScreen(ctx, p, flash) {
  const { d, book, today } = ctx;
  const h = homeSummary(book, d, today);
  const pic = h.picture;

  const safesRows = pic.safes.map((s) => `
    <button class="row link" data-go="safe" data-id="${esc(s.id)}"><span>${esc(s.name)}</span><b>${money(s.total)}</b></button>
    ${s.drawers.map((g) => `<div class="row small sub"><span>${esc(g.name)}</span><span>${money(g.balance)}</span></div>`).join('')}`).join('');

  const daily = h.daily.map((x) => `
    <button class="card item daily" data-go="daily" data-id="${esc(x.template.id)}">
      <span class="row"><b>تقسيم النهارده: ${esc(x.template.name)}</b><b>${money(x.perDay * x.days)}</b></span>
      <span class="hint">${x.days > 1 ? `فاتك ${x.days} أيام. افتح وأكّد اللي حطيته أو اتخطاهم.` : 'افتح وعلّم اللي حطيته فعلا.'}</span>
    </button>`).join('');

  const body = `
    <div class="card hero">
      <div class="lbl">في جيبك</div>
      <div class="big ${pic.cash < 0 ? 'neg' : ''}">${money(pic.cash)}</div>
      <div class="row small"><span>ده الكاش اللي معاك، مصروفك</span>
        <button class="linkbtn light" data-go="count" data-place="${esc(cashOf(d)?.id ?? '')}">عدّ الكاش</button></div>
    </div>
    ${backupDue(d, today) ? `
    <button class="card item warn-card" data-go="settings">
      <span class="row"><b>خد نسخة احتياطية</b><span>${d.settings.lastBackup ? `آخر نسخة من ${backupDue(d, today)} يوم` : 'لسه ماخدتش نسخة'}</span></span>
      <span class="hint">لو الموبايل ضاع أو اتمسح، النسخة هي اللي بترجّع فلوسك.</span>
    </button>` : ''}
    <div class="quick four">
      <button class="btn" data-go="expense">+ مصروف</button>
      <button class="btn2" data-go="income-new">+ دخل</button>
      <button class="btn2" data-go="split">وزّع</button>
      <button class="btn2" data-go="transfer">تحويل</button>
    </div>
    ${daily}
    <div class="card">
      <div class="lbl">إجمالي فلوسك</div>
      <div class="row"><span>الكاش</span><b>${money(pic.cash)}</b></div>
      ${pic.wallets.map((w) => `<div class="row"><span>${esc(w.name)}</span><b class="${w.balance < 0 ? 'neg' : ''}">${money(w.balance)}</b></div>`).join('')}
      ${safesRows}
      <div class="row total"><span>الإجمالي</span><b>${money(pic.total)}</b></div>
      <p class="hint">الفلوس بتفضل محسوبة طول ما هي في أي مكان من دول، لحد ما تسجّل إنها اتصرفت.</p>
    </div>
    ${h.remaining.total ? `
    <button class="card item" data-go="dues">
      <span class="row"><span>عليك الشهر ده</span><b>${money(h.remaining.total)}</b></span>
      <span class="row"><span>يفضل بعدها</span><b class="${h.afterDues < 0 ? 'neg' : ''}">${money(h.afterDues)}</b></span>
    </button>` : ''}
    ${h.people.owedToMe || h.people.iOwe ? `
    <button class="card item" data-go="accounts">
      <span class="row"><span>ليك عند الناس</span><b>${money(h.people.owedToMe)}</b></span>
      <span class="row"><span>عليك للناس</span><b>${money(h.people.iOwe)}</b></span>
      <span class="hint">مش داخلين في الإجمالي، لأنهم مش في إيدك.</span>
    </button>` : ''}
    ${h.borrowsCount ? `
    <button class="card item" data-go="borrows">
      <span class="row"><span>سلف بين أماكنك لسه مارجعتش</span><b>${money(h.borrowsTotal)}</b></span>
    </button>` : ''}
    ${h.soon.length ? `
    <div class="card">
      <div class="lbl">قريب أو متأخر</div>
      ${h.soon.map((s) => `
        <button class="row link ${s.overdue ? 'neg' : ''}" data-go="${s.go}" ${Object.entries(s.params).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>
          <span>${esc(s.label)} · ${showDate(s.date)}${s.overdue ? ' · متأخر' : ''}</span><b>${money(s.amount)}</b></button>`).join('')}
    </div>` : ''}
    <div class="card">
      <div class="row"><span class="lbl">الفايض أو العجز الشهري</span><b class="${h.month.surplus < 0 ? 'neg' : ''}">${money(h.month.surplus)}</b></div>
      <div class="row small"><span>دخل الشهر</span><span>${money(h.month.income)}</span></div>
      <div class="row small"><span>مصروف الشهر</span><span>${money(h.month.expense)}</span></div>
      <p class="hint">ده مش ربح. التحويش وسداد الديون وأقساط الجمعيات مش داخلين فيه.</p>
    </div>`;
  return page({ title: `أهلًا ${d.name}`, sub: 'مزنوق؟ لمّ حساباتك', tab: 'home', body, flash, help: 'home' });
}

// ---------- More ----------
export function moreScreen(ctx, p, flash) {
  const { d } = ctx;
  return page({
    title: 'المزيد', tab: 'more', flash, help: 'more',
    body: `
      <div class="sect">فلوسك</div>
      ${item({ go: 'safes', title: 'الخزن والأدراج', right: String(d.safes.length), sub: 'فلوس متشالة: تحويش، صدقات، محجوز لديون' })}
      ${item({ go: 'templates', title: 'التقسيمات', right: String(d.templates.length), sub: 'تقسيمات محفوظة، والتقسيم اليومي' })}
      ${item({ go: 'income', title: 'الدخل ومصادره', right: String(d.sources.length) })}
      ${item({ go: 'transfer', title: 'تحويل وسحب كاش', sub: 'بين الكاش والمحافظ والأدراج، مع الخصم' })}
      ${item({ go: 'count', title: 'عدّ الفلوس', sub: 'عدّ الكاش أو أي درج، والبرنامج يسجّل الفرق' })}
      ${item({ go: 'budgets', title: 'الميزانية', sub: 'حد شهري لكل وجه صرف' })}
      <div class="sect">السجل والتقارير</div>
      ${item({ go: 'log', title: 'سجل الحركات', sub: 'كل حركة بالتاريخ، مع البحث والعكس' })}
      ${item({ go: 'debts-report', title: 'تقرير الديون', sub: 'كل دين: أصله، اللي اتسدد، المحجوز، والباقي' })}
      ${item({ go: 'borrows', title: 'السلف بين أماكنك' })}
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
