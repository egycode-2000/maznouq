// Building blocks shared by every screen. Rendering only: no numbers are computed here.
import { formatMoney } from '../format.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const money = (p) => formatMoney(p);
export const egpValue = (p) => (p ? String(p / 100) : '');
export const bar = (percent) => `<div class="bar"><i style="width:${Math.min(100, Math.max(0, percent))}%"></i></div>`;

// Messages starting with ✓ are success notices; anything else is an error.
export const note = (flash) => {
  if (!flash) return '';
  return `<div class="${flash.startsWith('✓') ? 'notice' : 'error'}">${esc(flash)}</div>`;
};

const icon = (d, w = 2) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ICONS = {
  back: icon('M5 12h14M13 6l6 6-6 6'), // points right: "back" in a right-to-left layout
  home: icon('M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  dues: icon('M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 9h8M8 13h8M8 17h5'),
  people: icon('M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M17 11a3 3 0 1 0 0-6M19 21v-1a5 5 0 0 0-3-4.6'),
  more: icon('M5 12h.01M12 12h.01M19 12h.01', 3.5),
  plus: icon('M12 5v14M5 12h14', 2.6),
  calc: icon('M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01'),
  help: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01'),
};

// Opens the calculator and sends its result to the field with this id.
export const calcBtn = (target) => `<button type="button" class="calcbtn" data-calc="${target}" aria-label="آلة حاسبة">${ICONS.calc}</button>`;

// Tap-to-choose chips with a hidden input that holds the chosen id. Faster than a dropdown.
export function pick(id, list, selected) {
  const sel = list.some((o) => o.id === selected) ? selected : list[0]?.id ?? '';
  return `
    <div class="chips" data-pickgroup="${id}">
      ${list.map((o) => `<button type="button" class="chip ${o.id === sel ? 'on' : ''}" data-pick="${id}" data-value="${esc(o.id)}">${esc(o.name)}</button>`).join('')}
    </div>
    <input type="hidden" id="${id}" value="${esc(sel)}" />`;
}

// Chooser for any place money sits in: the cash, the wallets and the drawers, each with its balance.
// `places` comes from placeList(); `only` limits the kinds shown.
export function placePick(places, id, selected, { only = null, exclude = null } = {}) {
  const shown = places.filter((p) => (!only || only.includes(p.kind)) && p.id !== exclude);
  const sel = shown.some((p) => p.id === selected) ? selected : shown[0]?.id ?? '';
  const chip = (p) => `<button type="button" class="chip ${p.id === sel ? 'on' : ''}" data-pick="${id}" data-value="${esc(p.id)}" data-balance="${p.balance}">${esc(p.name)} · ${money(p.balance)}</button>`;
  const group = (kind, title) => {
    const rows = shown.filter((p) => p.kind === kind);
    return rows.length ? `<div class="pickgroup"><small>${title}</small><div class="chips">${rows.map(chip).join('')}</div></div>` : '';
  };
  const drawers = shown.filter((p) => p.kind === 'drawer');
  const safes = [...new Set(drawers.map((p) => p.safeName))];
  return `
    <div data-pickgroup="${id}">
      ${group('cash', 'الكاش')}
      ${group('wallet', 'المحافظ')}
      ${safes.map((s) => `<div class="pickgroup"><small>${esc(s)}</small><div class="chips">${drawers.filter((p) => p.safeName === s).map(chip).join('')}</div></div>`).join('')}
    </div>
    <input type="hidden" id="${id}" value="${esc(sel)}" />`;
}

export function dateField(today, id = 'date', value = today) {
  return `
    <input id="${id}" class="field" type="date" value="${value}" />
    <div class="chips">
      <button type="button" class="chip" data-setdate="0" data-target="${id}">النهارده</button>
      <button type="button" class="chip" data-setdate="-1" data-target="${id}">امبارح</button>
    </div>`;
}

export const noteField = (id = 'note', value = '') => `<input id="${id}" class="field" placeholder="ملحوظة (اختياري)" value="${esc(value)}" />`;

// Date and note folded away: both are optional and default to today with no note.
export function moreFields(today, { date = 'date', noteId = 'note' } = {}) {
  return `
    <details class="card">
      <summary>التاريخ والملحوظة وصورة الفاتورة</summary>
      ${dateField(today, date)}
      ${noteField(noteId)}
      <label class="lbl" for="photo">صورة الفاتورة (اختياري)</label>
      <input id="photo" class="field file" type="file" accept="image/*" />
    </details>`;
}

export function amountCard(label = 'المبلغ', { id = 'amount', value = '', quick = true, focus = true } = {}) {
  return `
    <div class="card amount-card">
      <label class="lbl" for="${id}">${label}</label>
      <div class="amount-row">
        <input id="${id}" class="amount" inputmode="decimal" placeholder="0" autocomplete="off" value="${esc(value)}" ${focus ? 'data-autofocus' : ''} />
        <span>ج.م</span>
        ${calcBtn(id)}
      </div>
      ${quick ? `<div class="chips">
        ${[10, 20, 50, 100, 200, 500].map((n) => `<button type="button" class="chip" data-addamount="${n}" data-target="${id}">+${n}</button>`).join('')}
      </div>` : ''}
    </div>`;
}

// One tappable row that opens another screen.
export function item({ go, params = {}, title, sub = '', right = '', percent = null, neg = false }) {
  const data = Object.entries(params).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ');
  return `
    <button class="card item" data-go="${go}" ${data}>
      <span class="row"><b>${esc(title)}</b><b class="${neg ? 'neg' : ''}">${esc(right)}</b></span>
      ${percent === null ? '' : bar(percent)}
      ${sub ? `<span class="hint">${esc(sub)}</span>` : ''}
    </button>`;
}

// «إلغاء» button with the rule spelled out.
export function retireButton(kind, id, label) {
  return `
    <p class="hint">لو عليه حركات هيختفي بس وحركاته تفضل محسوبة. لو مفيش حركات هيتمسح.</p>
    <button class="linkbtn danger" data-do="retire" data-kind="${kind}" data-id="${esc(id)}">إلغاء ${label}</button>`;
}

export function archivedBlock(archived, kind, title, nameOf = (x) => x.name) {
  const list = archived?.[kind] ?? [];
  if (!list.length) return '';
  return `
    <details class="card">
      <summary>${title} (${list.length})</summary>
      ${list.map((x) => `
        <div class="row"><span>${esc(nameOf(x))}</span>
          <button class="linkbtn" data-do="restore" data-kind="${kind}" data-id="${esc(x.id)}">رجّعه</button></div>`).join('')}
      <p class="hint">حركاتهم القديمة لسه محسوبة في الأرصدة والتقارير.</p>
    </details>`;
}

export function footer() {
  return `
    <footer class="brand-footer">
      <img src="icons/icon-192.png" alt="" width="22" height="22" />
      <span>EGYCODE</span>
      <button class="linkbtn small" data-go="about">عن مزنوق</button>
    </footer>`;
}

function nav(tab) {
  const link = (name, label, ic) => `
    <button class="navbtn ${tab === name ? 'on' : ''}" data-go="${name}">${ic}<span>${label}</span></button>`;
  return `
    <nav class="nav">
      ${link('home', 'الرئيسية', ICONS.home)}
      ${link('dues', 'الالتزامات', ICONS.dues)}
      <button class="navbtn fab" data-go="expense" aria-label="مصروف جديد">${ICONS.plus}</button>
      ${link('accounts', 'الحسابات', ICONS.people)}
      ${link('more', 'المزيد', ICONS.more)}
    </nav>`;
}

// Every screen: header (back + title + «مثال»), the body, the brand footer and the bottom bar.
export function page({ title, sub = '', back = null, backParams = {}, tab = '', body, flash = '', help = '' }) {
  const data = Object.entries(backParams).map(([k, val]) => `data-${k}="${esc(val)}"`).join(' ');
  return `
    <section class="phone">
      <header class="top">
        <div class="toprow">
          ${back ? `<button class="backbtn" data-go="${back}" ${data}>${ICONS.back}<span>رجوع</span></button>` : '<span></span>'}
          ${help ? `<button class="helpbtn" data-help="${help}">${ICONS.help}<span>مثال</span></button>` : ''}
        </div>
        <h1>${esc(title)}</h1>
        ${sub ? `<p>${esc(sub)}</p>` : ''}
      </header>
      <div class="body">
        ${note(flash)}
        ${body}
      </div>
      ${footer()}
      ${nav(tab)}
    </section>`;
}

// A small button that opens the invoice photo of an entry.
export const photoBtn = (d, entryId) => (d.photos?.[entryId]
  ? `<button type="button" class="photobtn" data-photo="${esc(entryId)}">صورة الفاتورة</button>` : '');
