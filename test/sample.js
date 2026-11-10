import { newCourse } from '../src/model.js';

export const BASICS = { title: 'PSY 210 Online · Spring 2027', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
export const TRICKY = 'Q&A: "Freud" <draft> — café';

/** A small hand-built course with one of everything, used by the file-writer tests. */
export function sampleCourse(change = {}) {
  const c = newCourse(BASICS);
  c.groups = [
    { id: 'gd', name: 'Discussions', weight: 25, dropLowest: 1 },
    { id: 'gw', name: 'Weekly work', weight: 30, dropLowest: 2 },
    { id: 'ge', name: 'Exams', weight: 35, dropLowest: 0 },
    { id: 'gp', name: 'Participation', weight: 10, dropLowest: 0 },
  ];
  c.weekRows[0] = [
    { id: 'c1', kind: 'class', date: '2027-01-26', theme: 'What is psychology?', readings: ['Myers Ch. 1'] },
    { id: 'a1', kind: 'assignment', title: 'Reading response 1', due: '2027-01-29', points: 10, groupId: 'gw', submissionTypes: ['online_upload', 'online_text_entry'] },
    { id: 'd1', kind: 'discussion', title: 'Week 1 discussion', due: '2027-01-29', points: 10, groupId: 'gd' },
    { id: 'a2', kind: 'assignment', title: 'Undated', points: 5, groupId: 'gw', submissionTypes: [] },
  ];
  c.weekRows[6] = [{ id: 'q7', kind: 'quiz', title: 'Midterm exam', due: '2027-03-12', groupId: 'ge' }];
  c.weekRows[7] = [
    { id: 'c8', kind: 'class', date: '2027-03-18', theme: '', readings: [], noClass: { reason: 'Spring break' } },
    { id: 'a8', kind: 'assignment', title: 'Annotate the article', due: '2027-03-19', points: 10, groupId: 'gw', submissionTypes: ['student_annotation'] },
  ];
  return { ...c, ...change };
}
