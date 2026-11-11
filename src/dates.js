// All course dates are Eastern wall-clock dates ('YYYY-MM-DD'). The Canvas file stores times as UTC,
// written 'YYYY-MM-DDTHH:MM:SS' with no zone suffix (proven by the prototype's imports).
const TZ = 'America/New_York';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s));
export const addDays = (date, n) => fmt(parse(date) + n * DAY_MS);
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY_MS);
/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (date) => new Date(parse(date)).getUTCDay();

/** The Monday on or before the first day of class: where Week 1 starts. */
export const weekStart = (firstDay) => addDays(firstDay, -((weekdayOf(firstDay) + 6) % 7));

/** Monday and Sunday of week n (1-based). */
export function weekRange(firstDay, n) {
  const start = addDays(weekStart(firstDay), (n - 1) * 7);
  return { start, end: addDays(start, 6) };
}

/** 'Week 1 · Jan 25 – 31', or 'Week 10 · Mar 29 – Apr 4' when the week crosses months. */
export function weekLabel(firstDay, n) {
  const { start, end } = weekRange(firstDay, n);
  const [, sm, sd] = start.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);
  return `Week ${n} · ${MONTHS[sm - 1]} ${sd} – ${sm === em ? ed : `${MONTHS[em - 1]} ${ed}`}`;
}

/** Which week a date falls in. Below 1 or above the course's weeks means outside the course. */
export const weekOf = (firstDay, date) => Math.floor(daysBetween(weekStart(firstDay), date) / 7) + 1;

/** The date of a weekday (0 = Sunday … 6 = Saturday) inside week n. */
export const dueDateFor = (firstDay, n, weekday) => addDays(weekRange(firstDay, n).start, (weekday + 6) % 7);

/** Dates of the meeting days (1 = Monday … 5 = Friday) in week n, in order. None falls before the first day of class. */
export const classDates = (firstDay, n, meets) => [...meets].sort((a, b) => a - b)
  .map((m) => addDays(weekRange(firstDay, n).start, m - 1)).filter((d) => d >= firstDay);

/** 'Tue Jan 26' */
export function dayLabel(date) {
  const d = new Date(parse(date));
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
function easternAsUtc(utcMs) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(utcMs)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Eastern date + 'HH:MM' → the Canvas file's time string. Keeps the clock time across daylight saving. */
export function toCanvasTime(date, time) {
  const [H, M] = time.split(':').map(Number);
  const wall = parse(date) + (H * 60 + M) * 60000;
  let guess = wall;
  for (let i = 0; i < 2; i++) guess += wall - easternAsUtc(guess);
  return new Date(guess).toISOString().slice(0, 19);
}

/** The fourth Thursday of November. */
export function thanksgiving(year) {
  const nov1 = `${year}-11-01`;
  return addDays(nov1, ((4 - weekdayOf(nov1) + 7) % 7) + 21);
}
