// Number helpers: show numbers in English digits, accept Arabic or English digits as input.

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

export function toEnglishDigits(text) {
  return String(text ?? '').replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d);
    return i >= 0 ? String(i) : String(EASTERN_ARABIC.indexOf(d));
  });
}

// Reads a typed amount in EGP. Empty means 0. Accepts Arabic decimal separator and thousands commas.
export function parseMoneyInput(text) {
  const clean = toEnglishDigits(text).trim().replace(/٫/g, '.').replace(/,/g, '');
  if (clean === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
    throw new Error('الرصيد لازم يكون رقم، ولو فيه قروش استخدم نقطة (مثال: 150.50)');
  }
  return Number(clean);
}

// Shows integer piasters as EGP with English digits.
// Whole amounts drop the trailing zeros: 120000 -> "1,200 ج.م".
// Only amounts with piasters keep two decimals: 120050 -> "1,200.50 ج.م".
export function formatMoney(piasters) {
  const sign = piasters < 0 ? '-' : '';
  const abs = Math.abs(piasters);
  const egp = Math.floor(abs / 100);
  const pts = abs % 100;
  const grouped = String(egp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = pts === 0 ? '' : `.${String(pts).padStart(2, '0')}`;
  return `${sign}${grouped}${decimals} ج.م`;
}

const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// Dates on screen and in messages: "5 نوفمبر 2026", never a reversed "2026-11-05" inside Arabic text.
export function showDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? `${Number(m[3])} ${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : String(iso ?? '');
}

// Months: "نوفمبر 2026".
export function showMonth(yyyyMm) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(yyyyMm ?? ''));
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : String(yyyyMm ?? '');
}
