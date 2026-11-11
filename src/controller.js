// Wires the screen events to the actions. The actions live in src/ctl/ by area.
import {
  root, session, go, render, showError, shiftDay, openHelp, livePaint,
} from './ctl/core.js';
import { setupActions, readSetupInputs } from './ctl/setup.js';
import { moneyActions } from './ctl/money.js';
import { placeActions } from './ctl/places.js';
import { duesActions } from './ctl/dues.js';
import { accountActions } from './ctl/accounts.js';
import { systemActions } from './ctl/system.js';
import { securityActions } from './ctl/security.js';
import { flowActions } from './ctl/flow.js';
import { tick } from './sound.js';
import { photoToDataUrl } from './ctl/places.js';
import { pinMatches, shouldRelock, unlockWithBiometric } from './lock.js';
import { loadValue, clearAll } from './storage.js';
import { photoKey } from './photos.js';
import { freshDraft } from './ctl/core.js';
import { importBackup } from './state.js';
import { parseMoneyInput } from './format.js';
import { openCalc } from './calcui.js';

const ACTIONS = {
  ...setupActions, ...moneyActions, ...placeActions, ...duesActions, ...accountActions, ...systemActions, ...securityActions,
  ...flowActions,
};

// ---------- The lock screen ----------
async function typePin(key) {
  if (Date.now() < session.pinWaitUntil) {
    session.flash = `استنى ${Math.ceil((session.pinWaitUntil - Date.now()) / 1000)} ثانية وجرّب تاني`;
    return render();
  }
  session.pin = key === 'del' ? session.pin.slice(0, -1) : `${session.pin}${key}`.slice(0, 6);
  if (session.pin.length < (session.lock?.length ?? 4)) return render();
  const ok = await pinMatches(session.lock, session.pin);
  session.pin = '';
  if (ok) {
    session.unlocked = true;
    session.pinFails = 0;
    return render();
  }
  session.pinFails += 1;
  // After 5 wrong tries, wait 30 seconds between tries.
  if (session.pinFails >= 5) session.pinWaitUntil = Date.now() + 30000;
  session.flash = 'الرقم غلط';
  return render();
}

async function wipeDevice() {
  if (document.getElementById('wipe-confirm')?.value.trim() !== 'امسح') {
    session.flash = 'اكتب كلمة «امسح» الأول';
    return render();
  }
  await clearAll();
  Object.assign(session, { unlocked: false, pin: '', pinFails: 0, lock: null, draft: freshDraft(), setupStep: 0 });
  session.route = { name: 'home', p: {} };
  session.flash = '✓ البيانات اتمسحت من الجهاز. رجّعها من النسخة الاحتياطية تحت، أو ابدأ من الأول';
  return render();
}

async function showPhoto(entryId) {
  const src = await loadValue(photoKey(entryId));
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.innerHTML = '<div class="help-sheet"><img class="photo full" alt="صورة الفاتورة" /><button class="btn" data-help-close>قفل</button></div>';
  overlay.querySelector('img').src = src;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-help-close]')) overlay.remove();
  });
  document.body.append(overlay);
}

// The number pad under the amount: types into the amount without opening the phone keyboard.
function pressKey(key) {
  const input = document.getElementById('flow-amount');
  if (!input) return;
  // An amount that was already there (when editing) is replaced by the first key, not added to.
  if (input.dataset.fresh) {
    delete input.dataset.fresh;
    if (key !== 'del') input.value = '';
  }
  if (key === 'del') input.value = input.value.slice(0, -1);
  else if (key === '.') input.value = input.value.includes('.') ? input.value : `${input.value || '0'}.`;
  else if (input.value.length < 12) input.value += key;
  input.focus();
}

// Small on-screen helpers that do not save anything.
function handleLocal(target) {
  const key = target.closest('[data-key]');
  if (key) {
    pressKey(key.dataset.key);
    return true;
  }
  const pickEl = target.closest('[data-pick]');
  if (pickEl) {
    document.getElementById(pickEl.dataset.pick).value = pickEl.dataset.value;
    pickEl.closest('[data-pickgroup]').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === pickEl));
    livePaint();
    return true;
  }
  const add = target.closest('[data-addamount]');
  if (add) {
    const input = document.getElementById(add.dataset.target || 'amount');
    let current = 0;
    try { current = parseMoneyInput(input.value); } catch { current = 0; }
    input.value = String(Math.round((current + Number(add.dataset.addamount)) * 100) / 100);
    livePaint();
    return true;
  }
  const calc = target.closest('[data-calc]');
  if (calc) {
    openCalc(calc.dataset.calc);
    return true;
  }
  const help = target.closest('[data-help]');
  if (help) {
    openHelp(help.dataset.help);
    return true;
  }
  const mode = target.closest('[data-splitmode]');
  if (mode) {
    const hidden = document.getElementById(`spm-${mode.dataset.splitmode}`);
    hidden.value = hidden.value === 'pct' ? 'amt' : 'pct';
    mode.textContent = hidden.value === 'pct' ? '%' : 'ج.م';
    livePaint();
    return true;
  }
  const setDate = target.closest('[data-setdate]');
  if (setDate) {
    document.getElementById(setDate.dataset.target).value = shiftDay(Number(setDate.dataset.setdate));
    return true;
  }
  return false;
}

root.addEventListener('click', async (event) => {
  // The «تكة»: every round button and number key clicks, unless turned off in the settings.
  if (session.ctx?.d.settings.sound && event.target.closest('.hub-big, .hub-br, .hub-lab, .hub-mini, .circle, .key, .navbtn.fab')) tick();
  const pinKey = event.target.closest('[data-pin]');
  if (pinKey) return typePin(pinKey.dataset.pin);
  if (event.target.closest('[data-unlock-bio]')) {
    try {
      if (await unlockWithBiometric(session.lock.credId)) {
        session.unlocked = true;
        return render();
      }
    } catch {
      session.flash = 'البصمة مانجحتش. اكتب الرقم السري';
      return render();
    }
    return undefined;
  }
  if (event.target.closest('[data-wipe]')) return wipeDevice();
  const photo = event.target.closest('[data-photo]');
  if (photo) return showPhoto(photo.dataset.photo);
  if (handleLocal(event.target)) return undefined;
  const el = event.target.closest('[data-go],[data-do]');
  if (!el || el.tagName === 'INPUT' && el.type !== 'checkbox') return;
  const p = { ...el.dataset };
  if (el.dataset.go) {
    delete p.go;
    if (el.dataset.go === 'jam-new' && p.step === undefined) session.jamDraft = {};
    return go(el.dataset.go, p);
  }
  readSetupInputs();
  const action = ACTIONS[el.dataset.do];
  if (!action) return undefined;
  try {
    const file = document.getElementById('photo')?.files?.[0];
    // Inside a flow the photo is picked on the first question and kept until the last one records.
    if (file) session.pendingPhoto = await photoToDataUrl(file, 1400, 0.75);
    else if (!session.flow) session.pendingPhoto = null;
    await action(p, el);
  } catch (e) {
    showError(e.message);
  }
});

// On the amount question the computer keyboard works even when the cursor is not inside the amount.
document.addEventListener('keydown', (event) => {
  const input = document.getElementById('flow-amount');
  if (!input || document.querySelector('.help-overlay, .calc-overlay')) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const digit = '٠١٢٣٤٥٦٧٨٩'.indexOf(event.key);
  const key = digit >= 0 ? String(digit) : event.key;
  if (/^[0-9.]$/.test(key)) pressKey(key);
  else if (key === 'Backspace') pressKey('del');
  else if (key === 'Enter') root.querySelector('[data-do="flow-ok"]')?.click();
  else return;
  event.preventDefault();
});

// The number pad must not take the cursor out of the amount, so the computer keyboard keeps working with it.
root.addEventListener('mousedown', (event) => {
  if (event.target.closest('.key')) event.preventDefault();
});

// Enter in a field presses the main button of that card (or of the screen).
root.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.target.tagName !== 'INPUT' || ['file', 'checkbox'].includes(event.target.type)) return;
  const scope = event.target.closest('details, .card:not(.amount-card)') ?? root;
  const button = scope.querySelector('.btn[data-do], .btn2[data-do]') ?? root.querySelector('.btn[data-do]');
  if (button) {
    event.preventDefault();
    button.click();
  }
});

// A field that already holds a number or a name: tapping it selects all of it, so typing replaces it
// instead of adding to it (no more «1» that turns into «110»).
root.addEventListener('focusin', (event) => {
  const el = event.target;
  if (el.tagName !== 'INPUT' || !el.value || ['date', 'month', 'file', 'checkbox', 'hidden'].includes(el.type)) return;
  // The amount in a flow is typed digit by digit; only an old amount (while editing) is selected to be replaced.
  if (el.id === 'flow-amount' && !el.dataset.fresh) return;
  setTimeout(() => { try { el.select(); } catch { /* some field types cannot be selected */ } }, 0);
});

root.addEventListener('input', (event) => {
  if (event.target.id === 'flow-amount') delete event.target.dataset.fresh;
  if (event.target.id === 'fee') event.target.dataset.touched = '1';
  livePaint();
});

root.addEventListener('change', async (event) => {
  const el = event.target;
  if (el.dataset.goOnChange) return go(el.dataset.goOnChange, { id: el.dataset.id, month: el.value });
  if (!['import', 'import-setup'].includes(el.dataset.change)) return undefined;
  const file = el.files?.[0];
  if (!file) return undefined;
  try {
    // Restoring from the first screen (for example after a forgotten code) does not bring the old code back.
    await importBackup(await file.text(), { dropLock: el.dataset.change === 'import-setup' });
    session.unlocked = el.dataset.change === 'import-setup' || session.unlocked;
    session.route = { name: 'home', p: {} };
    session.flash = '✓ اتستعادت النسخة الاحتياطية';
  } catch (e) {
    session.flash = e.message;
  }
  return render();
});

// Lock again after the app was away for the chosen minutes.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    session.hiddenAt = Date.now();
    return;
  }
  if (session.lock && session.unlocked && session.hiddenAt && shouldRelock(session.lock, Date.now() - session.hiddenAt)) {
    session.unlocked = false;
    session.pin = '';
    render();
  }
});

render();
