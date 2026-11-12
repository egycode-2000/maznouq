// Settings, backup, the log (search and undo), and cancelling or restoring items.
import { session, go, render, change, today, v, nowStamp } from './core.js';
import { toEnglishDigits } from '../format.js';
import { exportBackup } from '../state.js';
import { undoEntry } from '../undo.js';
import { tick } from '../sound.js';
import { validateName } from '../setup.js';
import { retire, restore, KINDS } from '../archive.js';

const RETIRE_HOME = {
  source: 'income', category: 'categories', wallet: 'wallets', bill: 'dues', goal: 'safes', person: 'accounts', safe: 'safes',
};
let doneMsg = '';

export const systemActions = {
  'save-name': () => change((st) => { st.d.name = validateName(v('set-name')); }, 'settings'),
  'save-theme': (p) => change((st) => { st.d.settings.theme = p.theme; }, 'settings', {}, ''),
  'toggle-examples': () => change((st) => { st.d.settings.autoExamples = !st.d.settings.autoExamples; }, 'settings', {}, ''),
  'reset-examples': () => change((st) => { st.d.settings.seen = {}; st.d.settings.autoExamples = true; }, 'settings', {}, '✓ الأمثلة هتظهر تاني أول مرة تفتح كل صفحة'),
  'export-backup': async () => {
    const text = await exportBackup({ photos: Boolean(document.getElementById('backup-photos')?.checked) });
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `maznouq-backup-${today()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return change((st) => { st.d.settings.lastBackup = today(); }, 'settings', {}, '✓ اتنزّلت النسخة الاحتياطية. احفظها في مكان بره الموبايل');
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
