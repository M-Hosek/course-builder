/**
 * The one piece of state in the app.
 *
 * @typedef {{id: string, name: string, weight: number, dropLowest: number}} Group
 * @typedef {{mode: 'none'} | {mode: 'separate', name: string, percent: number, week: number}
 *   | {mode: 'bonus', name: string, groupId: string}} ExtraCredit
 * @typedef {{id: string, kind: 'assignment'|'discussion'|'quiz'|'page', title: string, due?: string,
 *   points?: number, groupId?: string, submissionTypes?: string[]}} ItemRow
 * @typedef {{id: string, kind: 'class', date: string|null, theme: string, readings: string[],
 *   extra?: true, noClass?: {reason: string}}} ClassRow   date null = the whole week (fully asynchronous)
 * @typedef {ItemRow | ClassRow} Row
 * @typedef {{version: 1, title: string, firstDay: string, weeks: number, dueWeekday: number, dueTime: string,
 *   format: 'hybrid'|'async', meets: number[], grading: 'weighted'|'other', groups: Group[],
 *   extraCredit: ExtraCredit, homePage: {welcome: boolean, syllabus: boolean, communication: boolean, startHere: boolean},
 *   startHere: Row[], weekRows: Row[][], dismissedReminders: number[]}} Course
 */

/** Canvas's names for the ways students can hand in an assignment. */
export const SUBMISSION_TYPES = ['online_upload', 'online_text_entry', 'student_annotation', 'media_recording'];
export const MAX_WEEKS = 30;

let counter = 0;
/** A short id that is unique in this browser session and across saved files. */
export function uid() {
  counter += 1;
  return `r${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const wholeWeekRow = () => ({ id: uid(), kind: 'class', date: null, theme: '', readings: [] });

/**
 * An empty course: every week exists, nothing is in it yet.
 * @returns {Course}
 */
export function newCourse({ title, firstDay, weeks, dueWeekday }) {
  return {
    version: 1,
    title,
    firstDay,
    weeks,
    dueWeekday,
    dueTime: '23:59',
    format: 'async',
    meets: [],
    grading: 'weighted',
    groups: [],
    extraCredit: { mode: 'none' },
    homePage: { welcome: true, syllabus: true, communication: true, startHere: true },
    startHere: [
      { id: uid(), kind: 'page', title: 'Welcome' },
      { id: uid(), kind: 'page', title: 'Syllabus' },
      { id: uid(), kind: 'discussion', title: 'Introduce yourself' },
    ],
    weekRows: Array.from({ length: weeks }, () => [wholeWeekRow()]),
    dismissedReminders: [],
  };
}
