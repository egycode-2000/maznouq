// Settings, backup, the log (search and undo), and cancelling or restoring items.
import { session, go, change, today, v, nowStamp } from './core.js';
import { exportBackup } from '../state.js';
import { reverseEntry } from '../ledger.js';
import { validateName } from '../setup.js';
import { retire, restore, KINDS } from '../archive.js';
import { undoRule } from '../log.js';

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
    const entry = st.book.entries.find((e) => e.id === p.id);
    if (!entry) throw new Error('الحركة مش موجودة');
    const rule = undoRule(st.book, entry);
    if (!rule.can) throw new Error(rule.why);
    // A borrow made by this entry goes with it, unless part of it was already paid back.
    const borrow = st.d.borrows.find((b) => b.entryId === entry.id);
    if (borrow && borrow.repaid > 0) throw new Error('السلفة دي رجع منها جزء. رجّع الباقي أو اعكس الإرجاع الأول');
    reverseEntry(st.book, entry.id, { id: nowStamp('undo'), date: today() });
    if (borrow) st.d.borrows = st.d.borrows.filter((b) => b !== borrow);
  }, 'log', () => session.route.p, '✓ اتعكست الحركة والفلوس رجعت مكانها'),

  retire: (p) => change((st) => {
    const result = retire(st.book, st.d, p.kind, p.id);
    const label = KINDS[p.kind].label;
    doneMsg = result === 'deleted'
      ? `✓ اتمسح ${label} (مكانش عليه حركات)`
      : `✓ اتلغى ${label}. حركاته محفوظة وتقدر ترجّعه من «الملغي»`;
  }, RETIRE_HOME[p.kind], {}, () => doneMsg),
  restore: (p) => change((st) => restore(st.d, p.kind, p.id), RETIRE_HOME[p.kind], {}, '✓ رجع تاني'),
};
