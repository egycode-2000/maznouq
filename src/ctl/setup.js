// Actions for the first setup, question by question (الإعداد خطوة خطوة). The questions, their order and the
// opening balances are in src/onboard.js.
import { session, render, go, today } from './core.js';
import { saveValue } from '../storage.js';
import { SETUP_KEY } from '../state.js';
import {
  newOnboard, nextStep, prevStep, checkStep, addOwn, buildFromOnboard,
} from '../onboard.js';

// What was typed on the current question, kept before any re-draw.
export function readOnboardInputs() {
  const { draft } = session;
  const name = document.getElementById('ob-name');
  if (name) draft.name = name.value;
  const cash = document.getElementById('flow-amount');
  if (cash && session.obStep === 'cash') draft.cash = cash.value;
  document.querySelectorAll('[data-ob-amt]').forEach((el) => {
    const [list, i] = el.dataset.obAmt.split(':');
    draft[list][Number(i)].amount = el.value;
  });
  document.querySelectorAll('[data-ob-day]').forEach((el) => {
    const [list, i] = el.dataset.obDay.split(':');
    draft[list][Number(i)].day = el.value;
  });
  document.querySelectorAll('[data-ob-pname]').forEach((el) => { draft.people[Number(el.dataset.obPname)].name = el.value; });
  document.querySelectorAll('[data-ob-pamt]').forEach((el) => { draft.people[Number(el.dataset.obPamt)].amount = el.value; });
}

function advance() {
  checkStep(session.draft, session.obStep);
  session.obStep = nextStep(session.draft, session.obStep);
  return render();
}

async function finish() {
  const { data, next } = buildFromOnboard(session.draft, today());
  await saveValue(SETUP_KEY, data);
  session.draft = newOnboard();
  session.obStep = 'name';
  if (next[0] === 'jam-new') {
    return go('jam-new', {}, `✓ جاهز. جاوب أسئلة الجمعية${next.includes('settings') ? '، وبعدها اعمل الرقم السري من الإعدادات' : ''}`);
  }
  if (next[0] === 'settings') return go('settings', {}, '✓ جاهز. اعمل الرقم السري من «القفل» هنا');
  return go('home', {}, '✓ جاهز. اضغط الدايرة الكبيرة تشوف اللي جواها');
}

const withInputs = (fn) => (p) => {
  readOnboardInputs();
  return fn(p);
};

export const setupActions = {
  'ob-next': withInputs(() => advance()),
  'ob-back': withInputs(() => {
    session.obStep = prevStep(session.draft, session.obStep);
    return render();
  }),
  'ob-toggle': withInputs((p) => {
    const item = session.draft[p.list][Number(p.i)];
    item.on = !item.on;
    return render();
  }),
  'ob-add': withInputs((p) => {
    addOwn(session.draft, p.list, document.getElementById('ob-own')?.value);
    return render();
  }),
  // «مش دلوقتي»: nothing chosen on this question, and on to the next.
  'ob-skip': withInputs(() => {
    const list = { drawers: 'drawers', bills: 'bills' }[session.obStep];
    if (list) session.draft[list].forEach((x) => { x.on = false; });
    if (session.obStep === 'people') session.draft.people = [];
    return advance();
  }),
  'ob-choose': withInputs((p) => {
    session.draft[p.q] = p.value === 'yes';
    return advance();
  }),
  'ob-person-add': withInputs(() => {
    session.draft.people.push({ name: '', amount: '', side: 'him' });
    return render();
  }),
  'ob-person-del': withInputs((p) => {
    session.draft.people.splice(Number(p.i), 1);
    return render();
  }),
  'ob-side': withInputs((p) => {
    session.draft.people[Number(p.i)].side = p.side;
    return render();
  }),
  'ob-finish': withInputs(() => finish()),
};
