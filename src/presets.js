// Ready-made choices offered while setting up, so a new user ticks instead of typing.
// Everything stays editable afterwards (names, limits, adding and cancelling).

// Spending categories: the ones most homes spend on. `on` = ticked by default.
export const CATEGORY_PRESETS = [
  { name: 'مصروف البيت', on: true },
  { name: 'أكل وشرب', on: true },
  { name: 'مصروف شخصي', on: true },
  { name: 'مواصلات', on: true },
  { name: 'شحن نت', on: true },
  { name: 'نت وأرضي', on: true },
  { name: 'رصيد موبايل', on: true },
  { name: 'فاتورة كهربا', on: true },
  { name: 'شحن كهربا', on: true },
  { name: 'فاتورة مية', on: true },
  { name: 'علاج وأدوية', on: true },
  { name: 'صدقات', on: true },
  { name: 'غاز', on: false },
  { name: 'مصروف العربية', on: false },
  { name: 'لبس', on: false },
  { name: 'دروس ومدارس', on: false },
  { name: 'خروجات', on: false },
  { name: 'هدايا ومناسبات', on: false },
  { name: 'صيانة البيت', on: false },
  { name: 'اشتراكات', on: false },
  { name: 'حلاقة وعناية شخصية', on: false },
];

export const WALLET_PRESETS = ['فودافون كاش', 'إنستاباي', 'البنك', 'اتصالات كاش', 'أورنج كاش', 'وي باي'];
export const SOURCE_PRESETS = ['المرتب', 'شغل حر', 'دروس', 'إيجار', 'مشروع', 'معاش'];
// (Gold and other units are made later as their own drawer kind, by quantity, so they are not offered here.)
export const DRAWER_PRESETS = ['الصدقات', 'الطوارئ', 'العربية', 'الجواز', 'التحويش', 'مصاريف المدارس'];
export const BILL_PRESETS = ['الإيجار', 'الكهربا', 'المية', 'النت', 'الغاز', 'قسط'];

// The app's public address, for «ابعت البرنامج لحد» and its QR code.
export const APP_URL = 'https://egycode-2000.github.io/maznouq/';
