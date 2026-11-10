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

/** Participation gets 10%; the kinds of work chosen share the other 90% equally. */
export function suggestGroups(a) {
  const names = KIND_GROUPS.filter(([, chosen]) => chosen(a)).map(([name]) => name);
  if (names.length === 0) return [makeGroup('Participation', 100)];
  const share = Math.floor(90 / names.length);
  const extra = 90 - share * names.length;
  return [...names.map((name, i) => makeGroup(name, share + (i === 0 ? extra : 0))), makeGroup('Participation', 10)];
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
 * Build a course from the walkthrough's answers. Items go into the group with the matching name
 * (Assignments, Discussions, Quizzes, Exams, Project, Participation); if that group was renamed or
 * removed, the item simply has no group yet.
 * @param {{title: string, firstDay: string, weeks: number, dueWeekday: number}} basics
 * @param {Answers} a
 * @returns {import('./model.js').Course}
 */
export function fromAnswers(basics, a) {
  const c = newCourse(basics);
  c.grading = a.grading;
  c.groups = a.groups.map((g) => ({ ...g }));
  c.homePage = { ...a.homePage };
  const g = Object.fromEntries(c.groups.map((x) => [x.name, x.id]));
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
