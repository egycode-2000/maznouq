// All screens, keyed by route name. Each takes (ctx, params, flash) and returns the page HTML.
// The screens live in src/ui/ by area; this file only lists them.
import { setupScreen, STEPS, homeScreen, moreScreen, settingsScreen, aboutScreen } from './ui/home.js';
import {
  MISC_SOURCE, OUTSIDE, expenseScreen, incomeScreen, incomeNewScreen, sourceNewScreen, sourceEditScreen,
  transferScreen, splitScreen, templatesScreen, templateScreen, dailyScreen, logScreen, borrowsScreen,
  budgetsScreen, categoriesScreen,
} from './ui/money.js';
import { safesScreen, safeScreen, drawerNewScreen, drawerScreen, walletsScreen } from './ui/safes.js';
import { countScreen } from './ui/count.js';
import { lockScreen } from './ui/lock.js';
import { duesScreen, billNewScreen, billScreen, jamWizardScreen, jamScreen, JAM_STEPS } from './ui/dues.js';
import {
  accountsScreen, personNewScreen, personScreen, debtNewScreen, debtScreen, debtsReportScreen,
} from './ui/accounts.js';

export { setupScreen, STEPS, MISC_SOURCE, OUTSIDE, JAM_STEPS, lockScreen };

export const SCREENS = {
  home: homeScreen,
  more: moreScreen,
  settings: settingsScreen,
  about: aboutScreen,
  expense: expenseScreen,
  income: incomeScreen,
  'income-new': incomeNewScreen,
  'source-new': sourceNewScreen,
  'source-edit': sourceEditScreen,
  transfer: transferScreen,
  split: splitScreen,
  templates: templatesScreen,
  template: templateScreen,
  daily: dailyScreen,
  log: logScreen,
  borrows: borrowsScreen,
  budgets: budgetsScreen,
  categories: categoriesScreen,
  safes: safesScreen,
  safe: safeScreen,
  'drawer-new': drawerNewScreen,
  drawer: drawerScreen,
  wallets: walletsScreen,
  dues: duesScreen,
  'bill-new': billNewScreen,
  bill: billScreen,
  'jam-new': jamWizardScreen,
  jam: jamScreen,
  accounts: accountsScreen,
  'person-new': personNewScreen,
  person: personScreen,
  'debt-new': debtNewScreen,
  debt: debtScreen,
  'debts-report': debtsReportScreen,
  count: countScreen,
};
