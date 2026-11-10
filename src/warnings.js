import { weekRange, weekOf, thanksgiving } from './dates.js';
import { ANNOTATION_NOTE } from './export/outline.js';

export const BREAK_CALENDAR_URL = 'https://www.hws.edu/catalogue/calendar.aspx';
const BREAK_NAME = { spring: 'spring break', thanksgiving: 'Thanksgiving break' };

/**
 * @typedef {{id: string, kind: 'weights'|'due-outside'|'break'|'annotation', week?: number, rowId?: string,
 *   message: string, dismissible: boolean}} Warning
 */

/**
 * Weeks that may fall in an HWS break: the week containing Thanksgiving, and any week that
 * includes a day from March 10 to March 31. The tool does not know the real calendar; it only reminds.
 */
export function breakWeeks(course) {
  const out = [];
  for (let n = 1; n <= course.weekRows.length; n++) {
    const { start, end } = weekRange(course.firstDay, n);
    const years = [...new Set([start.slice(0, 4), end.slice(0, 4)])];
    if (years.some((y) => { const t = thanksgiving(Number(y)); return t >= start && t <= end; })) out.push({ week: n, kind: 'thanksgiving' });
    else if (years.some((y) => start <= `${y}-03-31` && end >= `${y}-03-10`)) out.push({ week: n, kind: 'spring' });
  }
  return out;
}

const trim = (n) => String(Math.round(n * 100) / 100);

/**
 * Everything worth a faculty member's attention, in the order it appears on the screen.
 * Nothing here blocks a download.
 * @returns {Warning[]}
 */
export function warningsFor(course) {
  const out = [];
  if (course.grading === 'weighted') {
    const total = course.groups.reduce((sum, g) => sum + (Number(g.weight) || 0), 0);
    if (course.groups.length === 0) {
      out.push({ id: 'weights', kind: 'weights', message: 'Add at least one grade group, or choose Other.', dismissible: false });
    } else if (Math.abs(total - 100) > 0.01) {
      // Extra credit sits on top of 100%, so it is not part of this total.
      out.push({ id: 'weights', kind: 'weights', message: `Grade weights add up to ${trim(total)}%, not 100%.`, dismissible: false });
    }
  }

  const weeks = course.weekRows.length;
  const courseStart = weekRange(course.firstDay, 1).start;
  const courseEnd = weekRange(course.firstDay, weeks).end;
  const breaks = new Map(breakWeeks(course).map((b) => [b.week, b.kind]));

  const rowWarnings = (rows, n) => {
    for (const r of rows) {
      if (r.kind === 'class') continue;
      if (r.due && (r.due < courseStart || r.due > courseEnd)) {
        out.push({ id: `due-${r.id}`, kind: 'due-outside', week: n, rowId: r.id, message: 'This due date is outside the course dates.', dismissible: false });
      } else if (r.due && n > 0 && weekOf(course.firstDay, r.due) !== n) {
        out.push({ id: `due-${r.id}`, kind: 'due-outside', week: n, rowId: r.id, message: `This due date is not in Week ${n}.`, dismissible: false });
      }
      if (r.kind === 'assignment' && r.submissionTypes?.includes('student_annotation')) {
        out.push({ id: `annotation-${r.id}`, kind: 'annotation', week: n, rowId: r.id, message: ANNOTATION_NOTE, dismissible: false });
      }
    }
  };

  rowWarnings(course.startHere, 0);
  course.weekRows.forEach((rows, i) => {
    const n = i + 1;
    const kind = breaks.get(n);
    if (kind && !course.dismissedReminders.includes(n) && !rows.some((r) => r.kind === 'class' && r.noClass)) {
      out.push({ id: `break-${n}`, kind: 'break', week: n, message: `This week may fall during ${BREAK_NAME[kind]}. Check the HWS academic calendar before you finalize these dates.`, dismissible: true });
    }
    rowWarnings(rows, n);
  });
  return out;
}
