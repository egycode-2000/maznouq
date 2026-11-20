// الإعداد خطوة خطوة: the first setup as one question per screen. This file holds the order of the questions,
// which ones are skipped, and how the answers become the first data. No screen code here.
//
// Opening balances follow the approved «وثيقة الحسابات»: everything that existed before the app is booked
// against «رصيد البداية» (opening), never as income, and never moves the cash:
//   cash and wallets ← opening • each drawer ← opening • a person who owes you: his account ← opening,
//   a person you owe: opening ← his account • monthly obligations are only dates and amounts (no entry).
import { addAccount, postEntry, toPiasters } from './ledger.js';
import { buildInitialBook, snapshotBook, validateName } from './setup.js';
import { createGoal } from './moves.js';
import { createBill } from './bills.js';
import { createRunning } from './people.js';
import { parseMoneyInput } from './format.js';
import {
  CATEGORY_PRESETS, WALLET_PRESETS, SOURCE_PRESETS, DRAWER_PRESETS, BILL_PRESETS,
} from './presets.js';

export const ONBOARD_STEPS = [
  'name', 'cash', 'wallets', 'walletAmounts', 'sources', 'categories', 'drawers', 'drawerAmounts',
  'bills', 'billAmounts', 'people', 'jam', 'lock', 'review',
];
// From «بتشيل فلوس لحاجة؟» on, every question can be left for later.
export const OPTIONAL_FROM = 'drawers';
// Monthly sources by default; the rest are open (any day, any amount).
const MONTHLY_SOURCES = ['المرتب', 'معاش', 'إيجار'];
// Bills whose amount changes every month.
const VARIABLE_BILLS = ['الكهربا', 'المية', 'الغاز'];

const pick = (names, on = []) => names.map((name) => ({ name, on: on.includes(name), amount: '', day: '' }));

export function newOnboard() {
  return {
    name: '',
    cash: '',
    wallets: pick(WALLET_PRESETS),
    sources: pick(SOURCE_PRESETS),
    categories: CATEGORY_PRESETS.map((c) => ({ name: c.name, on: c.on })),
    drawers: pick(DRAWER_PRESETS),
    bills: pick(BILL_PRESETS),
    people: [],
    jam: null,
    lock: null,
  };
}

const chosen = (list) => list.filter((x) => x.on);
const money = (text) => {
  const v = parseMoneyInput(String(text ?? ''));
  if (v < 0) throw new Error('المبلغ مايكونش بالسالب');
  return v;
};

// The next question after `step`, skipping the amount questions when nothing was chosen before them.
export function nextStep(draft, step) {
  let i = ONBOARD_STEPS.indexOf(step) + 1;
  const skip = {
    walletAmounts: () => !chosen(draft.wallets).length,
    drawerAmounts: () => !chosen(draft.drawers).length,
    billAmounts: () => !chosen(draft.bills).length,
  };
  while (skip[ONBOARD_STEPS[i]]?.()) i += 1;
  return ONBOARD_STEPS[i];
}

export function prevStep(draft, step) {
  let i = ONBOARD_STEPS.indexOf(step) - 1;
  const skip = {
    walletAmounts: () => !chosen(draft.wallets).length,
    drawerAmounts: () => !chosen(draft.drawers).length,
    billAmounts: () => !chosen(draft.bills).length,
  };
  while (i > 0 && skip[ONBOARD_STEPS[i]]?.()) i -= 1;
  return ONBOARD_STEPS[Math.max(0, i)];
}

// Checks the answer of one question before moving on.
export function checkStep(draft, step) {
  if (step === 'name') draft.name = validateName(draft.name);
  if (step === 'cash') money(draft.cash);
  if (step === 'walletAmounts') chosen(draft.wallets).forEach((w) => money(w.amount));
  if (step === 'drawerAmounts') chosen(draft.drawers).forEach((g) => money(g.amount));
  if (step === 'billAmounts') {
    chosen(draft.bills).forEach((b) => {
      if (!(money(b.amount) > 0)) throw new Error(`اكتب مبلغ ${b.name} (لو بيتغير اكتب متوسطه)`);
      const day = Number(String(b.day).trim());
      if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error(`اكتب يوم دفع ${b.name} من 1 لـ 31`);
    });
  }
  if (step === 'categories' && !chosen(draft.categories).length) throw new Error('اختار باب صرف واحد على الأقل');
  if (step === 'people') {
    draft.people.forEach((p) => {
      if (String(p.name).trim().length < 2) throw new Error('اكتب اسم كل شخص');
      if (!(money(p.amount) > 0)) throw new Error(`اكتب المبلغ اللي مع ${p.name}`);
    });
  }
}

// «+ غيرها»: a name typed by the user, added to a list and chosen.
export function addOwn(draft, list, name) {
  const clean = String(name ?? '').trim();
  if (clean.length < 2) throw new Error('اكتب الاسم الأول');
  const existing = draft[list].find((x) => x.name === clean);
  if (existing) existing.on = true;
  else draft[list].push({ name: clean, on: true, amount: '', day: '' });
}

// The answers become the first saved data, posted once (rule 10: one operation).
export function buildFromOnboard(draft, today) {
  const wallets = [
    { id: 'w-1', name: 'الكاش', opening: money(draft.cash) },
    ...chosen(draft.wallets).map((w, i) => ({ id: `w-${i + 2}`, name: w.name, opening: money(w.amount) })),
  ];
  const sources = chosen(draft.sources).map((s, i) => ({ id: `s-${i + 1}`, name: s.name, kind: MONTHLY_SOURCES.includes(s.name) ? 'monthly' : 'open' }));
  const categories = chosen(draft.categories).map((c, i) => ({ id: `e-${i + 1}`, name: c.name }));
  const built = buildInitialBook({ wallets, incomeSources: sources, categories, openingDate: today });
  const { book } = built;

  // Drawers: one safe «خزنتي» holding the chosen purposes, each with what is in it today.
  const safes = [];
  const goals = [];
  const drawers = chosen(draft.drawers);
  if (drawers.length) {
    safes.push({ id: 'safe-1', name: 'خزنتي' });
    drawers.forEach((g, i) => {
      const goal = createGoal(book, { id: `g-${i + 1}`, name: g.name, safeId: 'safe-1' });
      goals.push(goal);
      const amount = toPiasters(money(g.amount));
      if (amount > 0) {
        postEntry(book, {
          id: `open-goal-${goal.id}`, date: today, memo: `رصيد بداية: ${goal.name}`,
          lines: [{ account: goal.accountId, debit: amount }, { account: 'opening', credit: amount }],
        });
      }
    });
  }

  // Monthly obligations: dates and amounts only, nothing moves until they are paid.
  const bills = chosen(draft.bills).map((b, i) => createBill(book, {
    id: `bill-${i + 1}`, name: b.name, kind: VARIABLE_BILLS.includes(b.name) ? 'variable' : 'monthly',
    amountEgp: money(b.amount), dueDay: Number(String(b.day).trim()), startMonth: today.slice(0, 7),
  }));

  // People: what was between you before the app, booked against the opening.
  const people = draft.people.map((p, i) => createRunning(book, {
    id: `p-${i + 1}`, person: p.name, openingEgp: money(p.amount), openingSide: p.side === 'me' ? 'me' : 'him', date: today,
  }));

  if (!book.accounts.has('opening')) addAccount(book, { id: 'opening', name: 'رصيد البداية', type: 'equity' });
  return {
    data: {
      name: validateName(draft.name),
      sources: built.sources,
      categories: built.categories,
      wallets: wallets.map((w, i) => ({ id: w.id, name: w.name, kind: i === 0 ? 'cash' : 'wallet', feePct: 0 })),
      safes, goals, bills, people,
      book: snapshotBook(book),
      openingDate: built.openingDate,
      settings: { theme: 'auto', autoExamples: true, seen: {} },
    },
    // What to open right after: the jam'iya questions, then the lock in the settings.
    next: [draft.jam ? 'jam-new' : null, draft.lock ? 'settings' : null].filter(Boolean),
  };
}
