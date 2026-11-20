// Settings, backup, the log (search and undo), and cancelling or restoring items.
import { session, go, render, change, today, v, nowStamp } from './core.js';
import { toEnglishDigits } from '../format.js';
import { exportBackup, loadState, persist } from '../state.js';
import { protectStorage, clearAll } from '../storage.js';
import { newStart } from '../restart.js';
import { toPiasters } from '../ledger.js';
import { parseMoneyInput } from '../format.js';
import { newOnboard } from '../onboard.js';
import { undoEntry } from '../undo.js';
import { tick } from '../sound.js';
import { APP_URL } from '../presets.js';
import { validateName } from '../setup.js';
import { retire, restore, KINDS } from '../archive.js';

const RETIRE_HOME = {
  source: 'income', category: 'categories', wallet: 'wallets', bill: 'dues', goal: 'safes', person: 'accounts', safe: 'safes',
};
let doneMsg = '';

// Downloads the backup file and notes the day. Used by settings and by «خد نسخة واحدث».
export async function downloadBackupFile({ photos = true } = {}) {
  const text = await exportBackup({ photos });
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `maznouq-backup-${today()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  const st = await loadState();
  if (st) {
    st.d.settings.lastBackup = today();
    await persist(st);
  }
}

export const systemActions = {
  // «بداية جديدة بنفس الأسماء»: backup file first, then one settlement per place that changed.
  'new-start': async () => {
    const targets = {};
    for (const el of document.querySelectorAll('[data-restart]')) {
      const value = parseMoneyInput(el.value);
      if (value < 0) throw new Error('المبلغ مايكونش بالسالب');
      targets[el.dataset.restart] = toPiasters(value);
    }
    await downloadBackupFile({ photos: true });
    let done = null;
    return change((st) => {
      done = newStart(st.book, st.d, { targets, date: today() });
    }, 'home', {}, () => `✓ بدأت من جديد من النهارده. اتظبط ${done.settled} مكان${done.closedBorrows ? `، واتقفلت ${done.closedBorrows} سلفة` : ''}. القديم في السجل «فترة قديمة».`);
  },
  // «امسح كل حاجة»: only after the word and a downloaded backup; then the app is like new.
  'wipe-all': async () => {
    if (v('wipe-all-confirm').trim() !== 'امسح') throw new Error('اكتب كلمة «امسح» الأول');
    await downloadBackupFile({ photos: true });
    await new Promise((r) => { setTimeout(r, 800); });
    await clearAll();
    Object.assign(session, {
      unlocked: false, pin: '', pinFails: 0, lock: null, draft: newOnboard(), obStep: 'name',
      intro: 0, introDone: false, flow: null, saved: null, route: { name: 'home', p: {} },
    });
    session.flash = '';
    return render();
  },
  'protect-storage': async () => {
    session.persisted = await protectStorage();
    session.flash = session.persisted ? '✓ بياناتك بقت محمية من المسح التلقائي' : 'المتصفح لسه ماوافقش. نزّل البرنامج على الشاشة الرئيسية وجرّب تاني، وخد نسخة احتياطية';
    return render();
  },
  'share-app': async () => {
    const text = 'جرّب مزنوق: برنامج مجاني ينظّم فلوسك، والبيانات على موبايلك بس.';
    try {
      if (navigator.share) return await navigator.share({ title: 'مزنوق', text, url: APP_URL });
      await navigator.clipboard.writeText(`${text} ${APP_URL}`);
      session.flash = '✓ اتنسخ اللينك';
    } catch {
      session.flash = `ابعت اللينك ده: ${APP_URL}`;
    }
    return render();
  },
  'save-name': () => change((st) => { st.d.name = validateName(v('set-name')); }, 'settings'),
  'save-theme': (p) => change((st) => { st.d.settings.theme = p.theme; }, 'settings', {}, ''),
  'toggle-examples': () => change((st) => { st.d.settings.autoExamples = !st.d.settings.autoExamples; }, 'settings', {}, ''),
  'reset-examples': () => change((st) => { st.d.settings.seen = {}; st.d.settings.autoExamples = true; }, 'settings', {}, '✓ الأمثلة هتظهر تاني أول مرة تفتح كل صفحة'),
  'export-backup': async () => {
    await downloadBackupFile({ photos: Boolean(document.getElementById('backup-photos')?.checked) });
    return go('settings', {}, '✓ اتنزّلت النسخة الاحتياطية. احفظها في مكان بره الموبايل (اسمها maznouq-backup والتاريخ)');
  },

  'log-search': () => go('log', { q: v('log-q'), m: v('log-m') }),
  'undo-entry': (p) => change((st) => {
    undoEntry(st.book, st.d, p.id, { stamp: nowStamp, date: today() });
  }, () => session.route.name, () => session.route.p, '✓ اتعكست الحركة والفلوس رجعت مكانها'),
  // The intro screens: before the first setup they lead to it; from «عن مزنوق» they go back there.
  'intro-next': (p) => {
    if (p.about) return go('intro', { i: p.i });
    session.intro = Number(p.i);
    return render();
  },
  'intro-done': (p) => {
    if (p.about) return go('about');
    session.introDone = true;
    return render();
  },
  'save-limit-warn': () => change((st) => {
    const n = Math.round(Number(toEnglishDigits(String(v('limit-warn'))).trim()));
    if (!(n >= 10 && n <= 100)) throw new Error('اكتب نسبة من 10 لـ 100');
    st.d.settings.limitWarn = n;
  }, 'settings', {}, '✓ اتحفظت نسبة التنبيه'),
  // The eye on the home: hides or shows the amounts there.
  'toggle-hide': () => change((st) => {
    st.d.settings.hideAmounts = !st.d.settings.hideAmounts;
  }, 'home', () => session.route.p, ''),
  'toggle-sound': () => change((st) => {
    st.d.settings.sound = !st.d.settings.sound;
    if (st.d.settings.sound) tick();
  }, 'settings', {}, ''),

  retire: (p) => change((st) => {
    const result = retire(st.book, st.d, p.kind, p.id);
    const label = KINDS[p.kind].label;
    doneMsg = result === 'deleted'
      ? `✓ اتمسح ${label} (مكانش عليه حركات)`
      : `✓ اتلغى ${label}. حركاته محفوظة وتقدر ترجّعه من «الملغي»`;
  }, RETIRE_HOME[p.kind], {}, () => doneMsg),
  restore: (p) => change((st) => restore(st.d, p.kind, p.id), RETIRE_HOME[p.kind], {}, '✓ رجع تاني'),
};
