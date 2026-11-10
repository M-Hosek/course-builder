import { newCourse } from './model.js';
import { dueDateFor } from './dates.js';
import { makeAssignment, makeDiscussion, makeQuiz, makeGroup, everyFourWeeks } from './rows.js';

export const TEMPLATES = [
  { id: 'weekly', name: 'Weekly rhythm', blurb: 'A discussion and a reading response every week, with a midterm and a final exam.' },
  { id: 'units', name: 'Units with exams', blurb: 'A practice quiz every week, and a unit exam every four weeks.' },
  { id: 'project', name: 'Scaffolded project', blurb: 'A discussion and a milestone every week, building toward one final project.' },
];

// For each template: its grade groups, what goes in every week, and the larger items by week.
// `g` maps a group name to its id; `n` is the week number; `due` is that week's due date.
const PLANS = {
  weekly: {
    groups: [['Discussions', 25], ['Weekly work', 30], ['Exams', 35], ['Participation', 10]],
    weekly: (n, due, g) => [
      makeDiscussion(`Week ${n} discussion`, { points: 10, groupId: g.Discussions, due }),
      makeAssignment(`Reading response ${n}`, { points: 10, groupId: g['Weekly work'], due }),
    ],
    larger: (weeks, g) => [
      { week: Math.ceil(weeks / 2), make: (due) => makeQuiz('Midterm exam', { groupId: g.Exams, due }) },
      { week: weeks, make: (due) => makeQuiz('Final exam', { groupId: g.Exams, due }) },
    ],
  },
  units: {
    groups: [['Practice quizzes', 20], ['Unit exams', 70], ['Participation', 10]],
    weekly: (n, due, g) => [makeQuiz(`Practice quiz ${n}`, { groupId: g['Practice quizzes'], due })],
    larger: (weeks, g) => everyFourWeeks(weeks).map((week, i) => (
      { week, make: (due) => makeQuiz(`Unit exam ${i + 1}`, { groupId: g['Unit exams'], due }) })),
  },
  project: {
    groups: [['Milestones', 40], ['Final project', 35], ['Discussions', 15], ['Participation', 10]],
    weekly: (n, due, g) => [
      makeDiscussion(`Week ${n} discussion`, { points: 10, groupId: g.Discussions, due }),
      makeAssignment(`Milestone ${n}`, { points: 20, groupId: g.Milestones, due }),
    ],
    larger: (weeks, g) => [{ week: weeks, make: (due) => makeAssignment('Final project', { points: 100, groupId: g['Final project'], due }) }],
  },
};

/**
 * A course filled in from one of the three ready-made plans.
 * @param {'weekly'|'units'|'project'} id
 * @param {{title: string, firstDay: string, weeks: number, dueWeekday: number}} basics
 * @returns {import('./model.js').Course}
 */
export function fromTemplate(id, basics) {
  const plan = PLANS[id];
  if (!plan) throw new Error(`Unknown template: ${id}`);
  const c = newCourse(basics);
  c.groups = plan.groups.map(([name, weight]) => makeGroup(name, weight));
  const g = Object.fromEntries(c.groups.map((x) => [x.name, x.id]));
  const due = (n) => dueDateFor(c.firstDay, n, c.dueWeekday);

  c.weekRows.forEach((rows, i) => rows.push(...plan.weekly(i + 1, due(i + 1), g)));
  for (const { week, make } of plan.larger(c.weeks, g)) c.weekRows[week - 1].push(make(due(week)));

  const intro = c.startHere.find((r) => r.title === 'Introduce yourself');
  Object.assign(intro, { points: 5, groupId: g.Participation, due: due(1) });
  return c;
}
