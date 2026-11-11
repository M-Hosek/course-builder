// Every change the review screen can make. Each function takes a Course and returns a new one;
// the course passed in is never changed.
import { uid, wholeWeekRow, MAX_WEEKS } from './model.js';
import { addDays, daysBetween, weekStart, weekRange, classDates, dueDateFor } from './dates.js';
import { makeAssignment, makeDiscussion, makeQuiz, makeGroup } from './rows.js';

const copy = (c) => structuredClone(c);
const isClass = (r) => r.kind === 'class';
const isItem = (r) => r.kind !== 'class';
/** The rows of week n; 0 is Start Here. */
const rowsOf = (c, n) => (n === 0 ? c.startHere : c.weekRows[n - 1]);
const allLists = (c) => [c.startHere, ...c.weekRows];

function locate(c, rowId) {
  const lists = allLists(c);
  for (let week = 0; week < lists.length; week++) {
    const index = lists[week].findIndex((r) => r.id === rowId);
    if (index >= 0) return { week, index, rows: lists[week], row: lists[week][index] };
  }
  return null;
}

// ---- class lines -------------------------------------------------------------------------------

const datedRow = (date) => ({ id: uid(), kind: 'class', date, theme: '', readings: [] });
const hasText = (r) => !!(r.theme?.trim() || r.readings?.length || r.noClass);

/** Keep the class lines at the top of a week in date order, if they are all still at the top. */
function sortClassBlock(rows) {
  const firstItem = rows.findIndex(isItem);
  const top = firstItem < 0 ? rows.length : firstItem;
  if (rows.slice(top).some(isClass)) return rows; // the faculty member has moved lines around; leave their order alone
  const block = rows.slice(0, top).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  return [...block, ...rows.slice(top)];
}

// Class lines that the current format or meeting days have no place for are parked, not thrown away:
// c.parked holds { week, row } and never goes to Canvas. Ticking the day again, or switching the
// format back, brings each line back exactly as it was.
const park = (c, n, rows) => { if (rows.length) (c.parked ??= []).push(...rows.map((row) => ({ week: n, row }))); };
/** Take the parked lines of week n that match out of the parking place. */
function unpark(c, n, match) {
  const taken = [];
  c.parked = (c.parked ?? []).filter((p) => (p.week === n && match(p.row) ? (taken.push(p.row), false) : true));
  return taken;
}

/** Make one week's class lines match the course's format and meeting days. Item rows are never touched. */
function fitClassRows(c, n) {
  const rows = c.weekRows[n - 1];
  const hybrid = c.format === 'hybrid';
  const whole = rows.find((r) => isClass(r) && r.date === null);

  if (!hybrid || c.meets.length === 0) {
    // One line for the whole week. A hybrid course with no meeting days picked yet also looks like
    // this, and keeps its one-off extra meetings.
    const stays = (r) => isItem(r) || r === whole || (hybrid && r.extra);
    const leaving = rows.filter((r) => !stays(r));
    let line = whole;
    if (!line) {
      const first = leaving.filter((r) => !r.extra).sort((a, b) => a.date.localeCompare(b.date))[0];
      line = { ...wholeWeekRow(), theme: first?.theme ?? '', readings: [...(first?.readings ?? [])] };
    }
    park(c, n, leaving);
    return whole ? rows.filter(stays) : sortClassBlock([line, ...rows.filter((r) => isClass(r) && stays(r)), ...rows.filter(isItem)]);
  }

  const wanted = classDates(c.firstDay, n, c.meets);
  // Lines for days that still meet stay as they are; one-off meetings stay; the rest are parked.
  const stays = (r) => isItem(r) || r.extra || (r.date && wanted.includes(r.date));
  const kept = rows.filter(stays);
  const have = new Set(kept.filter((r) => isClass(r) && !r.extra).map((r) => r.date));
  const missing = wanted.filter((d) => !have.has(d));
  // The one line of a week was started from its earliest meeting, so what is typed in it goes back there.
  const seed = (c.parked ?? []).filter((p) => p.week === n && !p.row.extra).map((p) => p.row.date).sort()[0];
  const back = unpark(c, n, (r) => r.extra || missing.includes(r.date));
  park(c, n, rows.filter((r) => !stays(r) && r !== whole));
  // A day comes back as it was left; a day never seen before starts empty.
  const fresh = missing.map((d) => {
    const was = back.find((r) => !r.extra && r.date === d);
    const fromWhole = whole && hasText(whole) && d === wanted[0] && (!was || d === seed);
    if (fromWhole) return { ...(was ?? datedRow(d)), theme: whole.theme, readings: [...whole.readings] };
    return was ?? datedRow(d);
  });
  const lastClass = kept.reduce((at, r, i) => (isClass(r) ? i : at), -1);
  kept.splice(lastClass + 1, 0, ...back.filter((r) => r.extra), ...fresh);
  return sortClassBlock(kept);
}

function refitAll(c) {
  c.weekRows = c.weekRows.map((_, i) => fitClassRows(c, i + 1));
  return c;
}

export function setFormat(course, format) {
  const c = copy(course);
  c.format = format;
  return refitAll(c);
}

export function setMeets(course, meets) {
  const c = copy(course);
  c.meets = [...new Set(meets)].sort((a, b) => a - b);
  return refitAll(c);
}

// ---- basics, dates, weeks ----------------------------------------------------------------------

export function setBasics(course, { title, dueWeekday } = {}) {
  const c = copy(course);
  if (title !== undefined) c.title = title;
  if (dueWeekday !== undefined) c.dueWeekday = dueWeekday;
  return c;
}

/**
 * Change the first day of class. Every due date and class date moves by the same number of days:
 * the distance between the two Week 1 Mondays, so everything stays on its weekday. When the weeks
 * themselves move, dismissed break reminders come back, because they were about other dates.
 */
export function setFirstDay(course, firstDay) {
  const c = copy(course);
  const days = daysBetween(weekStart(c.firstDay), weekStart(firstDay));
  c.firstDay = firstDay;
  for (const rows of [...allLists(c), (c.parked ?? []).map((p) => p.row)]) {
    for (const r of rows) {
      if (r.due) r.due = addDays(r.due, days);
      if (isClass(r) && r.date) r.date = addDays(r.date, days);
    }
  }
  if (days !== 0) c.dismissedReminders = [];
  return refitAll(c); // a first day in mid-week has no class before it
}

/** What sits in the weeks that would be removed: item rows, and class lines with something typed in them. */
export function weeksToRemove(course, weeks) {
  const gone = course.weekRows.slice(Math.max(weeks, 0)).flat();
  return { rows: gone.filter(isItem).length, lines: gone.filter((r) => isClass(r) && hasText(r)).length };
}

/**
 * Change the number of weeks. Raising adds empty weeks. Lowering removes weeks from the end;
 * their items are moved into the new last week ('move') or dropped ('delete').
 */
export function setWeeks(course, weeks, onRemoved = 'move') {
  const c = copy(course);
  const target = Math.min(Math.max(Math.round(Number(weeks)) || 1, 1), MAX_WEEKS);
  if (target < c.weekRows.length) {
    const removed = c.weekRows.splice(target);
    if (onRemoved === 'move') c.weekRows[target - 1].push(...removed.flat().filter(isItem));
    if (c.parked) c.parked = c.parked.filter((p) => p.week <= target);
  }
  while (c.weekRows.length < target) {
    c.weekRows.push([wholeWeekRow()]);
    c.weekRows[c.weekRows.length - 1] = fitClassRows(c, c.weekRows.length);
  }
  c.weeks = target;
  c.dismissedReminders = c.dismissedReminders.filter((w) => w <= target);
  if (c.extraCredit.mode === 'separate' && c.extraCredit.week > target) c.extraCredit.week = target;
  return c;
}

// ---- rows --------------------------------------------------------------------------------------

const ROW_FIELDS = ['title', 'due', 'points', 'groupId', 'submissionTypes', 'theme', 'readings', 'date'];

export function updateRow(course, rowId, patch) {
  const c = copy(course);
  const found = locate(c, rowId);
  if (!found) return c;
  const { row } = found;
  for (const key of ROW_FIELDS) {
    if (!(key in patch)) continue;
    if (key === 'points' && (row.kind === 'quiz' || row.kind === 'page')) continue; // Canvas takes quiz points from the questions
    if (patch[key] === undefined || patch[key] === '' || patch[key] === null) {
      if (key === 'title' || key === 'theme') row[key] = '';
      else delete row[key];
    } else {
      row[key] = Array.isArray(patch[key]) ? [...patch[key]] : patch[key];
    }
  }
  return c;
}

export function addRow(course, week, kind) {
  const c = copy(course);
  const rows = rowsOf(c, week);
  if (!rows) return c;
  const n = Math.max(week, 1);
  if (kind === 'class') {
    if (week === 0 || c.format !== 'hybrid') return c;
    const lastClass = rows.reduce((at, r, i) => (isClass(r) ? i : at), -1);
    rows.splice(lastClass + 1, 0, { ...datedRow(weekRange(c.firstDay, n).start), extra: true });
    c.weekRows[week - 1] = sortClassBlock(rows);
    return c;
  }
  const opts = { due: dueDateFor(c.firstDay, n, c.dueWeekday), groupId: c.groups[0]?.id };
  const make = { assignment: () => makeAssignment('New assignment', opts), discussion: () => makeDiscussion('New discussion', opts), quiz: () => makeQuiz('New quiz', opts) }[kind];
  if (make) rows.push(make());
  return c;
}

export function removeRow(course, rowId) {
  const c = copy(course);
  const found = locate(c, rowId);
  if (found) found.rows.splice(found.index, 1);
  return c;
}

/**
 * Move a row to a position in a week (0 = Start Here). An item's due date follows it by whole weeks.
 * Class lines belong to their week and can only be reordered inside it.
 */
export function moveRow(course, rowId, toWeek, toIndex) {
  const c = copy(course);
  const found = locate(c, rowId);
  const target = rowsOf(c, toWeek);
  if (!found || !target) return c;
  if (isClass(found.row) && toWeek !== found.week) return c;
  found.rows.splice(found.index, 1);
  if (found.row.due && toWeek !== found.week) found.row.due = addDays(found.row.due, (Math.max(toWeek, 1) - Math.max(found.week, 1)) * 7);
  target.splice(Math.min(Math.max(toIndex, 0), target.length), 0, found.row);
  return c;
}

/** Mark class lines as "No class": the chosen dates, or every line in the week. The theme is kept underneath. */
export function setNoClass(course, week, dates, reason) {
  const c = copy(course);
  for (const r of c.weekRows[week - 1] ?? []) {
    if (isClass(r) && (dates === 'week' || dates.includes(r.date))) r.noClass = { reason: reason ?? '' };
  }
  return c;
}

export function clearNoClass(course, rowId) {
  const c = copy(course);
  const found = locate(c, rowId);
  if (found) delete found.row.noClass;
  return c;
}

// ---- grading -----------------------------------------------------------------------------------

export function setGrading(course, grading) {
  const c = copy(course);
  c.grading = grading;
  return c;
}

export function addGroup(course) {
  const c = copy(course);
  c.groups.push(makeGroup('New group', 0));
  return c;
}

export function updateGroup(course, groupId, patch) {
  const c = copy(course);
  const g = c.groups.find((x) => x.id === groupId);
  if (g) for (const key of ['name', 'weight', 'dropLowest']) if (key in patch) g[key] = patch[key];
  return c;
}

/** Remove a group. Its items stay, with no group, and a bonus that lived in it is dropped. */
export function removeGroup(course, groupId) {
  const c = copy(course);
  c.groups = c.groups.filter((g) => g.id !== groupId);
  for (const rows of allLists(c)) for (const r of rows) if (r.groupId === groupId) delete r.groupId;
  if (c.extraCredit.mode === 'bonus' && c.extraCredit.groupId === groupId) c.extraCredit = { mode: 'none' };
  return c;
}

export function setExtraCredit(course, extraCredit) {
  const c = copy(course);
  c.extraCredit = { ...extraCredit };
  return c;
}

export function setHomePage(course, patch) {
  const c = copy(course);
  c.homePage = { ...c.homePage, ...patch };
  return c;
}

export function dismissReminder(course, week) {
  const c = copy(course);
  if (!c.dismissedReminders.includes(week)) c.dismissedReminders.push(week);
  return c;
}
