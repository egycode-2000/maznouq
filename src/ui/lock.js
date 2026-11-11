// The lock screen. It shows nothing from the accounts until the right code is entered.
import { esc, note, footer } from './common.js';

export function lockScreen(lock, entered, flash = '') {
  const dots = Array.from({ length: lock.length ?? 4 }, (_, i) => `<span class="${i < entered ? 'on' : ''}"></span>`).join('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
  return `
    <section class="phone lock">
      <header class="top"><h1>مزنوق</h1><p>اكتب الرقم السري</p></header>
      <div class="body">
        ${note(flash)}
        <div class="pin-dots">${dots}</div>
        <div class="pin-keys" dir="ltr">
          ${keys.map((k) => {
            if (k === 'bio') return lock.credId ? '<button type="button" class="pin-key small" data-unlock-bio>البصمة</button>' : '<span></span>';
            if (k === 'del') return '<button type="button" class="pin-key small" data-pin="del">مسح</button>';
            return `<button type="button" class="pin-key" data-pin="${k}">${k}</button>`;
          }).join('')}
        </div>
        <details class="card">
          <summary>نسيت الرقم السري؟</summary>
          <p class="hint">مفيش طريقة تفتح من غير الرقم، وده اللي بيحمي فلوسك. الحل إنك تمسح البيانات من الجهاز ده، وبعدين ترجّعها من ملف النسخة الاحتياطية.</p>
          <label class="lbl" for="wipe-confirm">اكتب كلمة «امسح» للتأكيد</label>
          <input id="wipe-confirm" class="field" />
          <button class="linkbtn danger" data-wipe>امسح البيانات من الجهاز ده</button>
        </details>
      </div>
      ${footer()}
    </section>`;
}

// The lock card in settings.
export function lockSettings(lock) {
  if (!lock) {
    return `
      <div class="card">
        <div class="lbl">القفل</div>
        <p class="hint">رقم سري يطلبه البرنامج أول ما تفتحه، وبعد ما تسيبه شوية.</p>
        <input id="pin-new" class="field" type="password" inputmode="numeric" maxlength="6" placeholder="رقم سري جديد (4 لـ 6 أرقام)" />
        <input id="pin-again" class="field" type="password" inputmode="numeric" maxlength="6" placeholder="اكتبه تاني" />
        <button class="btn2" data-do="lock-on">شغّل القفل</button>
      </div>`;
  }
  return `
    <div class="card">
      <div class="row"><span class="lbl">القفل</span><b>شغال</b></div>
      <label class="lbl" for="lock-minutes">يقفل لوحده بعد ما تسيب البرنامج كام دقيقة؟</label>
      <div class="row"><input id="lock-minutes" class="field small-field" inputmode="numeric" value="${esc(lock.minutes)}" /><button class="btn2 grow" data-do="lock-minutes">احفظ</button></div>
      <p class="hint">0 يعني يقفل أول ما تسيبه.</p>
      ${lock.credId
    ? '<button class="btn2" data-do="bio-off">وقّف البصمة</button>'
    : '<button class="btn2" data-do="bio-on">شغّل البصمة أو بصمة الوش</button><p class="hint">لو موبايلك مش بيدعمها في المتصفح هيظهرلك تنبيه، والرقم السري هيفضل شغال.</p>'}
      <details>
        <summary>غيّر الرقم السري أو وقّف القفل</summary>
        <input id="pin-old" class="field" type="password" inputmode="numeric" maxlength="6" placeholder="الرقم الحالي" />
        <input id="pin-new" class="field" type="password" inputmode="numeric" maxlength="6" placeholder="الرقم الجديد" />
        <input id="pin-again" class="field" type="password" inputmode="numeric" maxlength="6" placeholder="الرقم الجديد تاني" />
        <button class="btn2" data-do="lock-change">غيّر الرقم</button>
        <button class="linkbtn danger" data-do="lock-off">وقّف القفل (محتاج الرقم الحالي)</button>
      </details>
    </div>`;
}
