// التقسيمات: saved ways to split money. A daily one (تقسيم يومي) asks every day:
// "today 10 to charity, 50 to savings, 40 to the car — did you put them?" and moves only what you tick.
// Nothing moves by itself, so the numbers never claim money you did not set aside.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(isoDate, n) {
  const dt = new Date((dayNumber(isoDate) + n) * 86400000);
  const pad = (x) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// rows: [{ target, mode: 'amt' | 'pct', value }]. Daily templates take fixed amounts only.
export function makeTemplate({ id, name, daily = false, sourceId = null, rows, startDate }) {
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) throw new Error('اكتب اسم التقسيمة');
  const kept = rows.filter((r) => Number(r.value) > 0);
  if (!kept.length) throw new Error('اكتب مبلغ في سطر واحد على الأقل');
  if (daily && kept.some((r) => r.mode === 'pct')) {
    throw new Error('التقسيم اليومي بالمبلغ بس، عشان مفيش مبلغ تتحسب منه النسبة');
  }
  if (daily && !DATE_RE.test(startDate)) throw new Error('تاريخ البداية لازم يكون YYYY-MM-DD');
  return {
    id,
    name: cleanName,
    daily: Boolean(daily),
    active: true,
    sourceId,
    rows: kept.map((r) => ({ target: r.target, mode: r.mode === 'pct' ? 'pct' : 'amt', value: Number(r.value) })),
    // The day before the start counts as done, so the first day asked is the start day.
    lastDone: daily ? addDays(startDate, -1) : null,
  };
}

// How many days are waiting (today included) for a daily template.
export function pendingDays(t, today) {
  if (!t.daily || !t.active || !t.lastDone) return 0;
  return Math.max(0, dayNumber(today) - dayNumber(t.lastDone));
}

export function dailyTotal(t) {
  return t.rows.reduce((s, r) => s + Math.round(r.value * 100), 0);
}

// Marks the waiting days as handled, whether the money was moved or skipped.
export function markDone(t, today) {
  t.lastDone = today;
}
