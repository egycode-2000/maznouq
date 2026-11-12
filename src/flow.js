// الأسئلة واحدة واحدة: the step-by-step flows for income, expense, splitting and the daily split.
// A flow is { kind, step, history, data }. This file decides which question comes next and, at the end,
// records everything in the ledger. No screen code here, so the whole path is tested without a browser.
import { addAccount, toPiasters } from './ledger.js';
import { parseMoneyInput, formatMoney } from './format.js';
import { recordIncome, recordExpense, transfer, planSplit, applySplit, hasGoal } from './moves.js';
import { addBorrow, repayBorrow, leftOf } from './borrows.js';
import { makeTemplate } from './daily.js';
import { placeList, checkSpend, rememberPlace } from './places.js';
import { undoEntry } from './undo.js';
import { entryAmount, canEdit } from './log.js';
import { nowStamp } from './state.js';
import { limitStatus } from './reports.js';

// Old screen names that now start a flow (so every old button keeps working).
export const FLOW_ROUTES = { expense: 'expense', 'income-new': 'income', split: 'split', 'daily-new': 'daily' };
export const MISC = 's-misc';

const P = (text) => {
  try { return toPiasters(parseMoneyInput(String(text ?? ''))); } catch { return 0; }
};

export function newFlow(kind, p = {}) {
  const data = { amount: '', lines: {}, repays: {}, date: '', note: '', saveName: '' };
  const flow = { kind, step: 'amount', history: [], data, back: p.back ?? 'home' };
  // An amount handed over by the calculator («سجّله مصروف») is already typed in.
  if (p.amount && P(p.amount) > 0) data.amount = String(P(p.amount) / 100);
  if (kind === 'expense' && p.from) Object.assign(data, { from: p.from, fromLocked: true });
  if (kind === 'income') Object.assign(data, { source: p.id ?? '', to: p.to ?? '' });
  if (kind === 'split') {
    flow.step = 'from';
    if (p.from) data.from = p.from;
  }
  if (kind === 'daily') flow.step = 'name';
  return flow;
}

// Opens the same questions again for a recorded expense or income, with the old answers chosen.
export function flowFromEntry(book, d, entryId, back = 'log') {
  const e = book.entries.find((x) => x.id === entryId);
  if (!e || !canEdit(e)) throw new Error('الحركة دي مش بتتعدّل من هنا');
  const debit = e.lines.find((l) => l.debit > 0).account;
  const credit = e.lines.find((l) => l.credit > 0).account;
  const amount = entryAmount(e);
  const base = { amount: String(amount / 100), lines: {}, repays: {}, date: e.date, note: e.note ?? '', saveName: '', editOf: entryId, oldAmount: amount };
  if (e.id.startsWith('exp-')) {
    const borrowed = d.borrows.some((b) => b.entryId === entryId);
    return { kind: 'expense', step: 'amount', history: [], back, data: { ...base, from: credit, oldFrom: credit, category: debit, back: borrowed ? 'yes' : 'no' } };
  }
  return { kind: 'income', step: 'amount', history: [], back, data: { ...base, to: debit, source: credit } };
}

export const amountOf = (flow) => P(flow.data.amount);
const sum = (bag) => Object.values(bag).reduce((s, x) => s + P(x), 0);
export const linesTotal = (flow) => sum(flow.data.lines) + sum(flow.data.repays);

const placeIn = (ctx, id) => ctx.places.find((x) => x.id === id);

// What a place holds for this flow. While editing, the old amount is counted back in its place.
function holds(flow, ctx, id) {
  const bal = placeIn(ctx, id)?.balance ?? 0;
  return flow.data.editOf && flow.data.oldFrom === id ? bal + flow.data.oldAmount : bal;
}

// The amount being distributed: the income itself, the amount typed, or what the place holds.
export function poolOf(flow, ctx) {
  if (flow.kind === 'income') return amountOf(flow);
  if (flow.kind === 'split') return flow.data.tpl ? amountOf(flow) : Math.max(0, holds(flow, ctx, flow.data.from));
  return null; // a daily split has no pool: it is an amount per day
}
export function restOf(flow, ctx) {
  const pool = poolOf(flow, ctx);
  return pool === null ? null : pool - linesTotal(flow);
}

// How much a drawer is short of the expense being recorded.
export function shortOf(flow, ctx) {
  const place = placeIn(ctx, flow.data.from);
  if (!place || place.kind !== 'drawer') return 0;
  return Math.max(0, amountOf(flow) - Math.max(0, holds(flow, ctx, place.id)));
}

function go(flow, step) {
  flow.history.push(flow.step);
  flow.step = step;
  return undefined;
}

export function back(flow) {
  if (!flow.history.length) return false;
  flow.step = flow.history.pop();
  return true;
}

const shortOrCommit = (flow, ctx) => (shortOf(flow, ctx) > 0 ? go(flow, 'cover') : 'commit');

// A drawer with no goal is its own «باب صرف»: spending from «درج الصدقات» is spending on صدقات.
// A drawer with a goal (or «على حاجة تانية») asks what it was spent on and whether it will be returned.
function afterFrom(flow, ctx) {
  const place = placeIn(ctx, flow.data.from);
  if (!place) throw new Error('اختار منين');
  if (place.kind !== 'drawer') return go(flow, 'cat');
  const g = ctx.d.goals.find((x) => x.accountId === place.id);
  if (hasGoal(g) || g.kind === 'debt' || flow.data.other) return go(flow, 'cat');
  Object.assign(flow.data, { category: '', back: 'no' });
  return shortOrCommit(flow, ctx);
}

function afterCat(flow, ctx) {
  return placeIn(ctx, flow.data.from)?.kind === 'drawer' ? go(flow, 'back') : 'commit';
}

function cleanName(value, label) {
  const name = String(value ?? '').trim();
  if (name.length < 2) throw new Error(`اكتب ${label}`);
  return name;
}

function fillFromTemplate(flow, ctx, tplId) {
  const t = ctx.d.templates.find((x) => x.id === tplId);
  if (!t) throw new Error('التقسيمة مش موجودة');
  const known = (id) => ctx.places.some((x) => x.id === id && x.kind === 'drawer') || ctx.d.categories.some((c) => c.id === id);
  const plan = planSplit(amountOf(flow), t.rows.filter((r) => known(r.target)).map((r) => ({ id: r.target, mode: r.mode, value: r.value })));
  flow.data.lines = Object.fromEntries(plan.lines.map((l) => [l.id, String(l.amount / 100)]));
  flow.data.repays = {};
  flow.data.tplName = t.name;
}

// One answer in, the next question out. Returns 'commit' when it is time to record.
export function answer(flow, value, ctx) {
  const d = flow.data;
  const { kind } = flow;
  switch (flow.step) {
    case 'amount':
      if (!(P(value) > 0)) throw new Error('اكتب المبلغ');
      d.amount = String(P(value) / 100);
      if (kind === 'expense') return d.fromLocked ? afterFrom(flow, ctx) : go(flow, 'from');
      if (kind === 'income') return go(flow, 'to');
      fillFromTemplate(flow, ctx, d.tpl);
      return go(flow, 'review');
    case 'from':
      if (value === '__wallets') return go(flow, 'wallet');
      if (value === '__safes') {
        if (ctx.d.safes.length !== 1) return go(flow, 'fsafe');
        d.safe = ctx.d.safes[0].id;
        return go(flow, 'fdrawer');
      }
      d.from = value;
      if (kind === 'expense') return afterFrom(flow, ctx);
      if (kind === 'split') return go(flow, ctx.d.templates.some((t) => !t.daily) ? 'stpl' : 'dsafe');
      return go(flow, 'dsafe');
    case 'wallet':
      d.from = value;
      return kind === 'expense' ? afterFrom(flow, ctx) : go(flow, 'dsafe');
    case 'fsafe':
      d.safe = value;
      return go(flow, 'fdrawer');
    case 'fdrawer':
      d.from = value;
      return afterFrom(flow, ctx);
    case 'cat':
      if (value === '__new') return go(flow, 'newcat');
      Object.assign(d, { category: value, newCat: '' });
      return afterCat(flow, ctx);
    case 'newcat':
      Object.assign(d, { newCat: cleanName(value, 'اسم الباب'), category: '__new' });
      return afterCat(flow, ctx);
    case 'back':
      d.back = value === 'yes' ? 'yes' : 'no';
      return shortOrCommit(flow, ctx);
    case 'cover':
      d.cover = value;
      return 'commit';
    case 'to':
      d.to = value;
      return go(flow, 'source');
    case 'source':
      if (value === '__new') return go(flow, 'newsource');
      Object.assign(d, { source: value, newSource: '' });
      return d.editOf ? 'commit' : go(flow, 'dist');
    case 'newsource':
      Object.assign(d, { newSource: cleanName(value, 'اسم المصدر'), source: '__new' });
      return d.editOf ? 'commit' : go(flow, 'dist');
    case 'dist':
      d.dist = value;
      if (value === 'yes') return go(flow, 'dsafe');
      Object.assign(d, { lines: {}, repays: {}, tplName: '' });
      if (value !== 'no') fillFromTemplate(flow, ctx, value);
      return go(flow, 'review');
    case 'stpl':
      if (value === 'manual') {
        d.tpl = '';
        return go(flow, 'dsafe');
      }
      d.tpl = value;
      return go(flow, 'amount');
    case 'dsafe':
      if (value === '__cats') return go(flow, 'dcats');
      if (value === '__repay') return go(flow, 'drepay');
      d.safe = value;
      return go(flow, 'ddrawers');
    case 'name':
      d.name = cleanName(value, 'اسم التقسيم');
      return go(flow, 'from');
    case 'review':
      return 'commit';
    default:
      throw new Error('خطوة مش معروفة');
  }
}

// «خزنة تانية» and «خلصت توزيع» inside the distribution.
export function jump(flow, step) {
  if (step === 'review' && flow.kind !== 'income' && linesTotal(flow) <= 0) throw new Error('اكتب مبلغ في درج واحد على الأقل واضغط تأكيد');
  return go(flow, step === 'review' ? 'review' : 'dsafe');
}

// «تأكيد» next to one drawer: keeps its amount, and never lets the total pass what is there to distribute.
export function setLine(flow, group, id, value, ctx) {
  const amount = String(value ?? '').trim() === '' ? 0 : toPiasters(parseMoneyInput(String(value)));
  if (amount < 0) throw new Error('المبلغ لازم يكون موجب');
  const bag = group === 'repay' ? flow.data.repays : flow.data.lines;
  const before = bag[id];
  if (amount > 0) bag[id] = String(amount / 100);
  else delete bag[id];
  const undo = () => {
    if (before === undefined) delete bag[id];
    else bag[id] = before;
  };
  if (group === 'repay') {
    const b = ctx.d.borrows.find((x) => x.id === id);
    if (!b || amount > leftOf(b)) {
      undo();
      throw new Error(`الباقي من السلفة ${formatMoney(b ? leftOf(b) : 0)} بس`);
    }
  }
  const rest = restOf(flow, ctx);
  if (rest !== null && rest < 0) {
    undo();
    throw new Error(`ده أكبر من الفاضل بـ ${formatMoney(-rest)}`);
  }
}

// The distribution as readable rows: used by the review screen and by the recording itself.
export function linesOf(flow, ctx) {
  const rows = [];
  for (const [id, value] of Object.entries(flow.data.lines)) {
    const amount = P(value);
    if (!amount) continue;
    const drawer = ctx.places.find((x) => x.id === id && x.kind === 'drawer');
    const cat = drawer ? null : ctx.d.categories.find((c) => c.id === id);
    if (drawer) rows.push({ id, accountId: id, type: 'pocket', name: drawer.name, sub: drawer.safeName, amount });
    else if (cat) rows.push({ id, accountId: id, type: 'expense', name: cat.name, sub: 'مصروف على طول', amount });
  }
  const repays = [];
  for (const [id, value] of Object.entries(flow.data.repays)) {
    const b = ctx.d.borrows.find((x) => x.id === id);
    const amount = P(value);
    if (b && amount) repays.push({ id, toId: b.fromId, name: placeIn(ctx, b.fromId)?.name ?? 'درج', amount });
  }
  return { rows, repays, total: rows.reduce((s, r) => s + r.amount, 0) + repays.reduce((s, r) => s + r.amount, 0) };
}

// ---------- Recording ----------
function newAccount(st, list, prefix, name, type, extra = {}) {
  const same = list.find((x) => !x.archived && x.name === name);
  if (same) return same.id;
  const id = nowStamp(prefix);
  addAccount(st.book, { id, name, type });
  list.push({ id, name, ...extra });
  return id;
}

function miscSource(st) {
  if (!st.book.accounts.has(MISC)) {
    addAccount(st.book, { id: MISC, name: 'دخل متفرق', type: 'income' });
    st.d.sources.push({ id: MISC, name: 'دخل متفرق', kind: 'open' });
  }
  return MISC;
}

// The «باب صرف» that belongs to a drawer: the one with its name, made the first time it is needed.
export function drawerCategory(st, goal) {
  if (goal.expenseId && st.book.accounts.has(goal.expenseId)) return goal.expenseId;
  goal.expenseId = newAccount(st, st.d.categories, 'e', goal.name, 'expense');
  return goal.expenseId;
}

// An edited entry replaces the old one: the log shows it once, with what it was before.
function noteEdit(d, oldId, newId, prev) {
  if (!oldId) return;
  const old = d.edits[oldId];
  d.edits[newId] = { prevAmount: prev.amount, hide: [...(old?.hide ?? []), oldId, ...prev.touched] };
  delete d.edits[oldId];
  if (d.photos?.[oldId]) d.photos[newId] = d.photos[oldId];
}

const ctxOf = (st) => ({ d: st.d, book: st.book, places: placeList(st.d, st.book) });

export function commitExpense(st, flow, today) {
  const d = flow.data;
  const amount = amountOf(flow);
  if (!(amount > 0)) throw new Error('اكتب المبلغ');
  const prev = d.editOf ? undoEntry(st.book, st.d, d.editOf, { stamp: nowStamp, date: today }) : null;
  const places = placeList(st.d, st.book);
  const place = places.find((x) => x.id === d.from);
  if (!place || place.kind === 'unit') throw new Error('اختار صرفت منين');
  const goal = place.kind === 'drawer' ? st.d.goals.find((g) => g.accountId === place.id) : null;
  let categoryId = d.category;
  if (categoryId === '__new') categoryId = newAccount(st, st.d.categories, 'e', d.newCat, 'expense');
  if (!categoryId) {
    if (!goal) throw new Error('اختار صرفت في إيه');
    categoryId = drawerCategory(st, goal);
  }
  const date = d.date || today;
  const links = [];
  const short = amount - Math.max(0, place.balance);
  if (goal && short > 0) {
    const cover = places.find((x) => x.id === d.cover && x.id !== place.id);
    if (!cover) throw new Error(`${place.name} فيه ${formatMoney(Math.max(0, place.balance))} بس. اختار تكمّل منين`);
    if (cover.balance < short) throw new Error(`${cover.name} فيه ${formatMoney(Math.max(0, cover.balance))} بس، والناقص ${formatMoney(short)}`);
    const id = nowStamp('cover');
    transfer(st.book, { fromId: cover.id, toId: place.id, amountEgp: short / 100, date, entryId: id, memo: 'تكملة مصروف' });
    links.push(id);
  }
  const warn = checkSpend(st.d, st.book, place.id, amount);
  const entryId = nowStamp('exp');
  recordExpense(st.book, { categoryId, placeId: place.id, amountEgp: amount / 100, date, note: d.note, entryId });
  if (links.length) st.d.links[entryId] = links;
  const catName = st.d.categories.find((c) => c.id === categoryId)?.name ?? '';
  if (goal && d.back === 'yes') {
    addBorrow(st.d, { id: nowStamp('b'), fromId: place.id, toId: null, amount, date, note: catName, entryId });
  }
  if (!goal) st.d.settings.lastCategory = categoryId;
  rememberPlace(st.d, st.book, place.id);
  noteEdit(st.d, d.editOf, entryId, prev);
  const onWhat = catName && catName !== place.name ? ` على ${catName}` : '';
  // Close to or past this category's monthly limit: a warning, never a block.
  const lim = limitStatus(st.book, st.d, categoryId, date.slice(0, 7));
  const limitText = {
    near: `${catName} وصل ${lim.percent}% من حدّه`,
    over: `${catName} عدّى الحد بـ ${formatMoney(lim.over)} (${lim.percent}%)`,
  }[lim.level] ?? '';
  return {
    entryId,
    undoIds: [entryId],
    warn: limitText,
    text: `${d.editOf ? 'اتعدّل' : 'اتسجل'}: مصروف ${formatMoney(amount)} من ${place.name}${onWhat}${d.back === 'yes' && goal ? ' (هترجّعهم)' : ''}${warn}`,
  };
}

// Moves the confirmed lines out of one place: into drawers, onto spending, and back to drawers owed money.
function applyLines(st, flow, placeId, date, prefix = 'sp') {
  const { rows, repays } = linesOf(flow, ctxOf(st));
  let total = 0;
  const ids = [];
  if (rows.length) {
    const idPrefix = nowStamp(prefix);
    total += applySplit(st.book, { placeId, lines: rows, date, idPrefix, note: flow.data.note });
    rows.forEach((_, i) => ids.push(`${idPrefix}-${i}`));
  }
  for (const r of repays) {
    const id = nowStamp('tr');
    transfer(st.book, { fromId: placeId, toId: r.toId, amountEgp: r.amount / 100, date, entryId: id, memo: 'رجّعت سلفة' });
    const used = repayBorrow(st.d, r.id, r.amount);
    st.d.repays[id] = { borrowId: r.id, amount: used };
    total += r.amount;
    ids.push(id);
  }
  return { total, ids };
}

function saveTemplate(st, flow, placeId) {
  const name = String(flow.data.saveName ?? '').trim();
  if (!name) return;
  const rows = Object.entries(flow.data.lines).map(([target, value]) => ({ target, mode: 'amt', value: P(value) / 100 }));
  if (!rows.length) return;
  const old = st.d.templates.find((t) => !t.daily && t.name === name);
  if (old) old.rows = rows;
  else st.d.templates.push(makeTemplate({ id: nowStamp('tpl'), name, sourceId: placeId, rows }));
}

export function commitIncome(st, flow, today) {
  const d = flow.data;
  const amount = amountOf(flow);
  if (!(amount > 0)) throw new Error('اكتب المبلغ');
  const prev = d.editOf ? undoEntry(st.book, st.d, d.editOf, { stamp: nowStamp, date: today }) : null;
  let sourceId = d.source;
  if (sourceId === '__new') sourceId = newAccount(st, st.d.sources, 's', d.newSource, 'income', { kind: 'open' });
  if (sourceId === MISC) miscSource(st);
  const place = placeList(st.d, st.book).find((x) => x.id === d.to);
  if (!place) throw new Error('اختار الفلوس نزلت فين');
  const date = d.date || today;
  const entryId = nowStamp('inc');
  recordIncome(st.book, { sourceId, placeId: place.id, amountEgp: amount / 100, date, note: d.note, entryId });
  st.d.settings.lastSource = sourceId;
  const { total: moved, ids } = d.editOf ? { total: 0, ids: [] } : applyLines(st, flow, place.id, date);
  if (!d.editOf) saveTemplate(st, flow, place.id);
  noteEdit(st.d, d.editOf, entryId, prev);
  const tail = moved ? ` · اتوزّع ${formatMoney(moved)} والباقي ${formatMoney(amount - moved)} في ${place.name}` : ` في ${place.name}`;
  return { entryId, undoIds: [entryId, ...ids], text: `${d.editOf ? 'اتعدّل' : 'اتسجل'}: دخل ${formatMoney(amount)}${tail}` };
}

export function commitSplit(st, flow, today) {
  const d = flow.data;
  const place = placeList(st.d, st.book).find((x) => x.id === d.from);
  if (!place) throw new Error('اختار هتوزّع منين');
  const { total: moved, ids } = applyLines(st, flow, place.id, d.date || today);
  if (!moved) throw new Error('اكتب مبلغ في درج واحد على الأقل');
  saveTemplate(st, flow, place.id);
  return { entryId: null, undoIds: ids, text: `اتوزّع ${formatMoney(moved)} من ${place.name}` };
}

// Saves a daily split: every day the home screen asks «حطيتهم؟» until it is confirmed.
export function commitDaily(st, flow, today) {
  const d = flow.data;
  const rows = Object.entries(d.lines).map(([target, value]) => ({ target, mode: 'amt', value: P(value) / 100 }));
  st.d.templates.push(makeTemplate({ id: nowStamp('tpl'), name: d.name, daily: true, sourceId: d.from, rows, startDate: today }));
  return { entryId: null, undoIds: [], text: `اتحفظ التوزيع اليومي «${d.name}». هيسألك كل يوم` };
}

export const COMMIT = { expense: commitExpense, income: commitIncome, split: commitSplit, daily: commitDaily };
