import { uid } from './model.js';

/** What a new assignment accepts unless the faculty member says otherwise. */
export const DEFAULT_SUBMISSION_TYPES = ['online_upload', 'online_text_entry'];

const withOptional = (row, { due, groupId }) => {
  if (due) row.due = due;
  if (groupId) row.groupId = groupId;
  return row;
};

export const makeAssignment = (title, { points = 10, groupId, due, submissionTypes = DEFAULT_SUBMISSION_TYPES } = {}) =>
  withOptional({ id: uid(), kind: 'assignment', title, points, submissionTypes: [...submissionTypes] }, { due, groupId });

export const makeDiscussion = (title, { points = 10, groupId, due } = {}) =>
  withOptional({ id: uid(), kind: 'discussion', title, points }, { due, groupId });

/** Quizzes have no points: Canvas takes them from the questions added later. */
export const makeQuiz = (title, { groupId, due } = {}) =>
  withOptional({ id: uid(), kind: 'quiz', title }, { due, groupId });

export const makeGroup = (name, weight, dropLowest = 0) => ({ id: uid(), name, weight, dropLowest });

/** Weeks that get an exam when exams come every four weeks, plus the last week. */
export function everyFourWeeks(weeks) {
  const out = [];
  for (let n = 4; n <= weeks; n += 4) out.push(n);
  if (out.at(-1) !== weeks) out.push(weeks);
  return out;
}
