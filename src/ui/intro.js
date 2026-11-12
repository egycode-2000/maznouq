// تعريف مزنوق: three short screens shown before the first setup, so anyone opening the app understands
// what it does. They open again any time from المزيد ← عن مزنوق.
import { esc } from './common.js';

export const INTRO = [
  {
    title: 'مزنوق بيعمل إيه؟',
    text: 'بيعرّفك فلوسك فين بالظبط: الكاش اللي معاك، المحافظ، والخزن اللي بتشيل فيها لكل غرض.',
    circles: ['الكاش', 'المحافظ', 'الخزن'],
  },
  {
    title: 'سجّل في 3 ضغطات',
    text: 'صرفت كام؟ منين؟ في إيه؟ كل سؤال في شاشة، ومع آخر ضغطة يتسجل. غلطت؟ «عدّل» أو «تراجع».',
    circles: ['كام', 'منين', 'في إيه'],
  },
  {
    title: 'ماتنساش حاجة',
    text: 'الالتزامات والجمعيات والديون والناس اللي ليك وعليك، وتنبيه لو قرّبت من حد الصرف. وكل بياناتك على جهازك بس.',
    circles: ['التزامات', 'حسابات', 'حدود'],
  },
];

// fromAbout: opened again from «عن مزنوق», so the last button goes back there instead of to the setup.
export function introScreen(index, { fromAbout = false } = {}) {
  const i = Math.min(Math.max(0, index), INTRO.length - 1);
  const s = INTRO[i];
  const last = i === INTRO.length - 1;
  const params = fromAbout ? 'data-about="1"' : '';
  return `
    <section class="intro">
      <button type="button" class="skip" data-do="intro-done" ${params}>${fromAbout ? 'رجوع' : 'تخطّي'}</button>
      <div class="art"><div class="circles">
        ${s.circles.map((c, j) => `<div class="circle r${j}"><span class="disc big">${esc(c)}</span></div>`).join('')}
      </div></div>
      <div class="txt"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div>
      <div class="dots">${INTRO.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <button type="button" class="btn go" data-do="${last ? 'intro-done' : 'intro-next'}" data-i="${i + 1}" ${params}>
        ${last ? (fromAbout ? 'تمام' : 'يلا نبدأ') : 'التالي'}</button>
    </section>`;
}
