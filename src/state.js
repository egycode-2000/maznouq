// Loads and saves the whole app state (one record in IndexedDB) and handles backup/restore.
import { loadValue, saveValue } from './storage.js';
import { restoreBook, snapshotBook } from './setup.js';
import { upgradeJamiya } from './obligations.js';
import { loadByPrefix } from './storage.js';

export const SETUP_KEY = 'setup';
const BACKUP_KIND = 'maznouq-backup';

export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth() {
  return todayIso().slice(0, 7);
}

export function nowStamp(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Fills in fields that older saves do not have.
// Words used in the app: الكاش (cash in hand), المحافظ (Vodafone Cash, InstaPay, bank),
// الخزنة (a place that keeps money aside) and الدرج (one purpose inside a خزنة).
// In the data: wallets[] with kind 'cash' | 'wallet', safes[], goals[] (the drawers), people[] (running accounts),
// templates[] (saved splits, daily or not). Older saves are upgraded here, in one place.
export function withDefaults(data) {
  let wallets = (data.wallets ?? []).map((w) => ({ feePct: 0, ...w }));
  let cashIndex = wallets.findIndex((w) => w.kind === 'cash');
  if (cashIndex < 0) cashIndex = Math.max(0, wallets.findIndex((w) => w.name.trim() === 'كاش'));
  wallets = wallets.map((w, i) => ({ ...w, kind: i === cashIndex ? 'cash' : 'wallet' }));

  let safes = data.safes ?? [];
  let goals = data.goals ?? [];
  if (goals.length && !safes.length) safes = [{ id: 'safe-1', name: 'خزنتي', note: '' }];
  goals = goals.map((g) => (safes.some((s) => s.id === g.safeId) ? g : { ...g, safeId: safes[0].id }));

  const settings = { theme: 'auto', autoExamples: true, sound: true, seen: {}, ...(data.settings ?? {}) };
  let templates = data.templates ?? [];
  const goalAccount = (id) => goals.find((g) => g.id === id)?.accountId ?? id;
  const oldRows = (rows) => Object.entries(rows ?? {}).map(([target, r]) => ({
    target: goalAccount(target), mode: r.mode === 'pct' ? 'pct' : 'amt', value: Number(r.value) || 0,
  }));
  if (settings.split) templates = [...templates, { id: 'tpl-1', name: 'تقسيمتي', daily: false, active: true, sourceId: null, rows: oldRows(settings.split), lastDone: null }];
  if (settings.splits) templates = [...templates, ...settings.splits.map((t) => ({ daily: false, active: true, sourceId: null, lastDone: null, ...t, rows: Array.isArray(t.rows) ? t.rows : oldRows(t.rows) }))];
  delete settings.split;
  delete settings.splits;

  return {
    ...data,
    wallets,
    safes,
    goals,
    templates,
    people: data.people ?? [],
    jamiyas: (data.jamiyas ?? []).map(upgradeJamiya),
    bills: data.bills ?? [],
    debts: data.debts ?? [],
    borrows: data.borrows ?? [],
    budgets: data.budgets ?? {},
    photos: data.photos ?? {},
    unitMoves: data.unitMoves ?? [],
    edits: data.edits ?? {},
    repays: data.repays ?? {},
    links: data.links ?? {},
    settings,
  };
}

// Returns { d, book } where d is plain data and book is the live ledger. Use persist() after changes.
export async function loadState() {
  const saved = await loadValue(SETUP_KEY);
  if (!saved) return null;
  const d = withDefaults(saved);
  return { d, book: restoreBook(d.book) };
}

export async function persist(state) {
  state.d.book = snapshotBook(state.book);
  await saveValue(SETUP_KEY, state.d);
}

// The backup file: all the data, and the invoice photos unless left out.
export async function exportBackup({ photos = true } = {}) {
  const saved = await loadValue(SETUP_KEY);
  if (!saved) throw new Error('مفيش بيانات تتحفظ لسه');
  const pics = photos ? Object.fromEntries(await loadByPrefix('photo:')) : {};
  return JSON.stringify({ kind: BACKUP_KIND, savedAt: todayIso(), data: saved, photos: pics });
}

// Whether to remind about a backup: none in the last 7 days (counted from the start if never).
export function backupDue(d, today) {
  const from = d.settings.lastBackup ?? d.openingDate ?? today;
  const days = Math.round((Date.parse(today) - Date.parse(from)) / 86400000);
  return days >= 7 ? days : 0;
}

// dropLock: restoring after a forgotten code, so the old code is not brought back.
export async function importBackup(text, { dropLock = false } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('الملف ده مش ملف نسخة احتياطية صالح');
  }
  if (parsed?.kind !== BACKUP_KIND || !parsed.data?.book || !Array.isArray(parsed.data.wallets)) {
    throw new Error('الملف ده مش ملف نسخة احتياطية من مزنوق');
  }
  restoreBook(parsed.data.book); // throws if the ledger is broken
  const data = withDefaults(parsed.data);
  if (dropLock) delete data.settings.lock;
  for (const [key, value] of Object.entries(parsed.photos ?? {})) {
    if (key.startsWith('photo:')) await saveValue(key, value);
  }
  await saveValue(SETUP_KEY, data);
}
