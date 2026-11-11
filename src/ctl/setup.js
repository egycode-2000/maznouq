// First-run setup: name, cash and wallets, income sources, spending categories.
import { session, render, go, today, freshDraft } from './core.js';
import { saveValue } from '../storage.js';
import { SETUP_KEY } from '../state.js';
import { buildInitialBook, validateName, snapshotBook } from '../setup.js';
import { parseMoneyInput } from '../format.js';
import { STEPS } from '../views.js';

export function readSetupInputs() {
  const { draft } = session;
  const name = document.getElementById('name');
  if (name) draft.name = name.value;
  document.querySelectorAll('[data-w-name]').forEach((el) => { draft.wallets[el.dataset.wName].name = el.value; });
  document.querySelectorAll('[data-w-open]').forEach((el) => { draft.wallets[el.dataset.wOpen].opening = el.value; });
  document.querySelectorAll('[data-s-name]').forEach((el) => { draft.sources[el.dataset.sName].name = el.value; });
}

function validateStep() {
  const { draft, setupStep } = session;
  if (setupStep === 0) validateName(draft.name);
  if (setupStep === 1) draft.wallets.forEach((w) => parseMoneyInput(w.opening));
  if (setupStep === 2) draft.sources.forEach((s) => { if (s.name.trim() === '') throw new Error('اكتب اسم كل مصدر دخل'); });
}

async function finish() {
  const { draft } = session;
  const wallets = draft.wallets
    .filter((w, i) => i === 0 || w.name.trim() !== '')
    .map((w, i) => ({ id: `w-${i + 1}`, name: i === 0 ? 'الكاش' : w.name.trim(), opening: parseMoneyInput(w.opening) }));
  const sources = draft.sources.map((s, i) => ({ id: `s-${i + 1}`, name: s.name.trim(), kind: s.kind }));
  const categories = draft.categories.filter((c) => c.on).map((c, i) => ({ id: `e-${i + 1}`, name: c.name }));
  const built = buildInitialBook({ wallets, incomeSources: sources, categories, openingDate: today() });
  await saveValue(SETUP_KEY, {
    name: validateName(draft.name),
    sources: built.sources,
    categories: built.categories,
    wallets: wallets.map((w, i) => ({ id: w.id, name: w.name, kind: i === 0 ? 'cash' : 'wallet', feePct: 0 })),
    book: snapshotBook(built.book),
    openingDate: built.openingDate,
    settings: { theme: 'auto', autoExamples: true, seen: {} },
  });
  session.draft = freshDraft();
  session.setupStep = 0;
  return go('home', {}, '✓ جاهز. ضيف خزنك وجمعياتك وديونك من الالتزامات والحسابات والمزيد');
}

export const setupActions = {
  'setup-next': async () => {
    validateStep();
    if (session.setupStep < STEPS.length - 1) {
      session.setupStep += 1;
      return render();
    }
    return finish();
  },
  'setup-back': () => { session.setupStep -= 1; return render(); },
  'setup-add-wallet': () => {
    session.draft.wallets.push({ id: `w-x${session.draft.wallets.length}`, name: '', opening: '' });
    return render();
  },
  'setup-add-source': () => {
    session.draft.sources.push({ id: `s-x${session.draft.sources.length}`, name: '', kind: 'open' });
    return render();
  },
  'setup-kind': (p) => { session.draft.sources[Number(p.idx)].kind = p.kind; return render(); },
  'setup-cat': (p) => { const c = session.draft.categories[Number(p.idx)]; c.on = !c.on; return render(); },
};
