// عدّ الفلوس: count what is really in a place and record the difference.
import { esc, money, pick, placePick, amountCard, noteField, page } from './common.js';
import { DENOMINATIONS } from '../count.js';
import { cashOf } from '../places.js';

export const COUNT_CATEGORY = { id: '__count', name: 'فرق عدّ (مش فاكر)' };

export function countScreen(ctx, p, flash) {
  const { d, places } = ctx;
  const selected = places.some((x) => x.id === p.place) ? p.place : cashOf(d)?.id;
  return page({
    title: 'عدّ الفلوس', sub: 'عدّ اللي معاك فعلا، والبرنامج يظبط نفسه', back: p.back ?? 'home', flash, help: 'count',
    body: `
      <div class="lbl">بتعدّ إيه؟</div>
      ${placePick(places, 'count-place', selected)}
      ${amountCard('عدّيت كام؟', { id: 'count-amount', quick: false })}
      <details class="card">
        <summary>عدّ بالفئات (كام ورقة من كل نوع)</summary>
        ${DENOMINATIONS.map((value, i) => `
          <div class="row"><span>${value} ج.م</span><input class="field small-field den" id="den-${i}" inputmode="numeric" placeholder="0" /></div>`).join('')}
      </details>
      <div class="card" id="count-diff"></div>
      <div class="lbl">لو ناقص، راح فين؟</div>
      ${pick('count-cat', [COUNT_CATEGORY, ...d.categories], COUNT_CATEGORY.id)}
      <p class="hint">لو زيادة، بتتسجل «دخل متفرق». ولو محفظة، قارن بالرصيد في تطبيقها.</p>
      ${noteField('count-note')}
      <button class="btn" data-do="save-count">سجّل الفرق</button>`,
  });
}

export function countButton(placeId, label = 'عدّ الكاش', back = 'home') {
  return `<button class="linkbtn" data-go="count" data-place="${esc(placeId)}" data-back="${esc(back)}">${label}</button>`;
}

export { money };
