// Actions for the question-by-question flows: each tap answers one question and opens the next,
// and the last tap records everything at once.
import { session, go, render, change, today, v, nowStamp, loadState, withPhoto } from './core.js';
import { answer, back, jump, setLine, flowFromEntry, COMMIT } from '../flow.js';
import { undoEntry } from '../undo.js';
import { loadValue } from '../storage.js';
import { photoKey, hasPhoto } from '../photos.js';

const flow = () => {
  if (!session.flow) throw new Error('ابدأ من الأول');
  return session.flow;
};

async function commit() {
  const f = flow();
  // An edited entry keeps its invoice photo unless a new one was picked.
  if (f.data.editOf && !session.pendingPhoto && hasPhoto(session.ctx.d, f.data.editOf)) {
    session.pendingPhoto = await loadValue(photoKey(f.data.editOf));
  }
  return change((st) => {
    const done = COMMIT[f.kind](st, f, today());
    if (done.entryId) withPhoto(st, done.entryId);
    session.saved = { text: done.text, warn: done.warn ?? '', entryId: done.entryId, undoIds: done.undoIds };
  }, f.back ?? 'home', f.backParams ?? {}, '');
}

const step = (result) => (result === 'commit' ? commit() : render());

// The amounts typed next to the drawers, whether «تأكيد» was pressed on each or not.
const typedLines = () => [...document.querySelectorAll('[data-line]')].map((el) => ({ id: el.dataset.line, group: el.dataset.group, value: el.value }));

export const flowActions = {
  'flow-ok': () => {
    const f = flow();
    if (document.getElementById('date')) f.data.date = v('date');
    if (document.getElementById('note')) f.data.note = v('note');
    if (f.step === 'review') f.data.saveName = v('flow-save');
    const value = f.step === 'amount' ? v('flow-amount') : v('flow-text');
    return step(answer(f, value, session.ctx));
  },
  'flow-pick': (p) => step(answer(flow(), p.value, session.ctx)),
  'flow-other': () => {
    flow().data.other = !flow().data.other;
    return render();
  },
  'flow-line': async (p) => {
    const others = typedLines().filter((l) => l.id !== p.id);
    setLine(flow(), p.group === 'repay' ? 'repay' : 'line', p.id, v(`fl-${p.id}`), session.ctx);
    await render();
    // What was typed next to the other drawers stays typed.
    for (const l of others) {
      const el = document.getElementById(`fl-${l.id}`);
      if (el && l.value !== '') el.value = l.value;
    }
    return undefined;
  },
  'flow-jump': (p) => {
    const f = flow();
    for (const l of typedLines()) setLine(f, l.group === 'repay' ? 'repay' : 'line', l.id, l.value, session.ctx);
    jump(f, p.step);
    return render();
  },
  'flow-back': () => {
    const f = flow();
    return back(f) ? render() : go(f.back ?? 'home', f.backParams ?? {});
  },
  'flow-cancel': () => {
    const f = flow();
    return go(f.back ?? 'home', f.backParams ?? {});
  },

  // «عدّل»: the same questions again with the old answers chosen. Saving cancels the old entry and records the new.
  'edit-entry': async (p) => {
    const st = await loadState();
    const from = session.route.name === 'flow' ? { name: 'home', p: {} } : session.route;
    session.flow = { ...flowFromEntry(st.book, st.d, p.id, from.name), backParams: from.p };
    session.pendingPhoto = null;
    session.saved = null;
    session.route = { name: 'flow', p: {} };
    return render();
  },
  // «تراجع» right after saving: cancels everything that save recorded, newest first.
  'undo-saved': () => {
    const ids = [...(session.saved?.undoIds ?? [])].reverse();
    session.saved = null;
    return change((st) => {
      for (const id of ids) undoEntry(st.book, st.d, id, { stamp: nowStamp, date: today() });
    }, session.route.name, session.route.p, '✓ اتلغى، والفلوس رجعت مكانها');
  },
};
