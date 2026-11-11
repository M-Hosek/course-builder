import { newCourse } from './model.js';
import { dueDateFor } from './dates.js';
import { makeAssignment, makeDiscussion, makeQuiz, makeGroup, everyFourWeeks, DEFAULT_SUBMISSION_TYPES } from './rows.js';

/**
 * @typedef {{weekly: {assignment: boolean, discussion: boolean, quiz: boolean},
 *   exams: 'none'|'final'|'midterm-final'|'every-4', project: boolean, grading: 'weighted'|'other',
 *   groups: import('./model.js').Group[], submissionTypes: string[],
 *   homePage: import('./model.js').Course['homePage']}} Answers
 */

/** The grade group each kind of work goes into, in the order the groups are listed. */
const KIND_GROUPS = [
  ['Assignments', (a) => a.weekly.assignment],
  ['Discussions', (a) => a.weekly.discussion],
  ['Quizzes', (a) => a.weekly.quiz],
  ['Exams', (a) => a.exams !== 'none'],
  ['Project', (a) => a.project],
];

/**
 * Participation gets 10%; the kinds of work chosen share the other 90% equally.
 * Each suggested group carries a `role` (what kind of work it is for), so renaming it keeps its items.
 */
export function suggestGroups(a) {
  const names = KIND_GROUPS.filter(([, chosen]) => chosen(a)).map(([name]) => name);
  const made = (name, weight) => ({ ...makeGroup(name, weight), role: name });
  if (names.length === 0) return [made('Participation', 100)];
  const share = Math.floor(90 / names.length);
  const extra = 90 - share * names.length;
  return [...names.map((name, i) => made(name, share + (i === 0 ? extra : 0))), made('Participation', 10)];
}

/** @returns {Answers} */
export function defaultAnswers() {
  const a = {
    weekly: { assignment: true, discussion: true, quiz: false },
    exams: 'midterm-final',
    project: false,
    grading: 'weighted',
    groups: [],
    submissionTypes: [...DEFAULT_SUBMISSION_TYPES],
    homePage: { welcome: true, syllabus: true, communication: true, startHere: true },
  };
  a.groups = suggestGroups(a);
  return a;
}

/**
 * Build a course from the walkthrough's answers. Items go into the group suggested for their kind
 * of work, whatever it has been renamed to, or else a group the faculty member gave that name
 * (Assignments, Discussions, Quizzes, Exams, Project, Participation). If there is neither, the item
 * has no group yet and the review screen says so.
 * @param {{title: string, firstDay: string, weeks: number, dueWeekday: number}} basics
 * @param {Answers} a
 * @returns {import('./model.js').Course}
 */
export function fromAnswers(basics, a) {
  const c = newCourse(basics);
  c.grading = a.grading;
  c.groups = a.groups.map(({ role, ...g }) => g);
  c.homePage = { ...a.homePage };
  const g = { ...Object.fromEntries(a.groups.map((x) => [x.name, x.id])), ...Object.fromEntries(a.groups.filter((x) => x.role).map((x) => [x.role, x.id])) };
  const due = (n) => dueDateFor(c.firstDay, n, c.dueWeekday);

  c.weekRows.forEach((rows, i) => {
    const n = i + 1;
    if (a.weekly.assignment) rows.push(makeAssignment(`Week ${n} assignment`, { points: 10, groupId: g.Assignments, due: due(n), submissionTypes: a.submissionTypes }));
    if (a.weekly.discussion) rows.push(makeDiscussion(`Week ${n} discussion`, { points: 10, groupId: g.Discussions, due: due(n) }));
    if (a.weekly.quiz) rows.push(makeQuiz(`Week ${n} quiz`, { groupId: g.Quizzes, due: due(n) }));
  });

  const exam = (week, title) => c.weekRows[week - 1].push(makeQuiz(title, { groupId: g.Exams, due: due(week) }));
  if (a.exams === 'midterm-final') exam(Math.ceil(c.weeks / 2), 'Midterm exam');
  if (a.exams === 'midterm-final' || a.exams === 'final') exam(c.weeks, 'Final exam');
  if (a.exams === 'every-4') everyFourWeeks(c.weeks).forEach((week, i) => exam(week, `Unit exam ${i + 1}`));
  if (a.project) {
    c.weekRows[c.weeks - 1].push(makeAssignment('Final project', { points: 100, groupId: g.Project, due: due(c.weeks), submissionTypes: a.submissionTypes }));
  }

  const intro = c.startHere.find((r) => r.title === 'Introduce yourself');
  Object.assign(intro, { points: 5, due: due(1) }, g.Participation ? { groupId: g.Participation } : {});
  return c;
}
