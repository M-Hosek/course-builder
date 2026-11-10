import test from 'node:test';
import assert from 'node:assert/strict';
import { newCourse } from '../src/model.js';
import { toCanvasTime, weekLabel } from '../src/dates.js';
import { toExport } from '../src/export/outline.js';

const basics = { title: 'PSY 210', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
const GROUPS = [
  { id: 'gd', name: 'Discussions', weight: 25, dropLowest: 1 },
  { id: 'gw', name: 'Weekly work', weight: 30, dropLowest: 0 },
  { id: 'ge', name: 'Exams', weight: 35, dropLowest: 0 },
  { id: 'gp', name: 'Participation', weight: 10, dropLowest: 0 },
];
/** A small course with one of everything. */
function course(change = {}) {
  const c = newCourse(basics);
  c.groups = GROUPS.map((g) => ({ ...g }));
  c.weekRows[0] = [
    { id: 'c1', kind: 'class', date: '2027-01-26', theme: 'What is psychology?', readings: ['Myers Ch. 1'] },
    { id: 'a1', kind: 'assignment', title: 'Reading response 1', due: '2027-01-29', points: 10, groupId: 'gw', submissionTypes: ['online_upload', 'online_text_entry'] },
    { id: 'd1', kind: 'discussion', title: 'Week 1 discussion', due: '2027-01-29', points: 10, groupId: 'gd' },
  ];
  c.weekRows[6].push({ id: 'q7', kind: 'quiz', title: 'Midterm exam', due: '2027-03-12', points: 100, groupId: 'ge' });
  c.weekRows[7] = [
    { id: 'c8', kind: 'class', date: '2027-03-18', theme: 'Memory', readings: [], noClass: { reason: 'Spring break' } },
    { id: 'a8', kind: 'assignment', title: 'Annotate it', due: '2027-03-19', points: 10, groupId: 'gw', submissionTypes: ['student_annotation'] },
    { id: 'a9', kind: 'assignment', title: 'Undated', points: 5, groupId: 'gone', submissionTypes: [] },
  ];
  c.weekRows[8] = [{ id: 'c9', kind: 'class', date: null, theme: 'Learning', readings: ['Myers Ch. 7'] }];
  c.weekRows[9] = [{ id: 'c10', kind: 'class', date: null, theme: '', readings: [], noClass: { reason: 'Break' } }];
  return { ...c, ...change };
}
const mod = (e, name) => e.modules.find((m) => m.name === name);
const item = (e, key) => e.modules.flatMap((m) => m.items).find((i) => i.key === key);

test('Start Here comes first and is published; week modules are not', () => {
  const e = toExport(course());
  assert.equal(e.modules.length, 15);
  assert.deepEqual(e.modules.slice(0, 2).map((m) => [m.name, m.published]), [['Start Here', true], [weekLabel('2027-01-25', 1), false]]);
  assert.ok(e.modules[0].items.every((i) => i.published));
  assert.ok(e.modules.slice(1).every((m) => !m.published && m.items.every((i) => !i.published)));
  assert.equal(new Set(e.modules.map((m) => m.key)).size, 15);
});
test('class rows become text headers', () => {
  const e = toExport(course());
  assert.deepEqual([item(e, 'c1').kind, item(e, 'c1').title], ['header', 'Tue Jan 26 — What is psychology? · Readings: Myers Ch. 1']);
  assert.equal(item(e, 'c8').title, 'Thu Mar 18 — No class · Spring break');
  assert.equal(item(e, 'c9').title, 'Learning · Readings: Myers Ch. 7');
  assert.equal(item(e, 'c10').title, 'No class this week · Break');
});
test('an empty whole-week line produces nothing', () => {
  const e = toExport(course());
  assert.deepEqual(mod(e, weekLabel('2027-01-25', 2)).items, []);
});
test('items keep their order, points, group, due time and submission types', () => {
  const e = toExport(course());
  assert.deepEqual(mod(e, weekLabel('2027-01-25', 1)).items.map((i) => i.key), ['c1', 'a1', 'd1']);
  const a = item(e, 'a1');
  assert.deepEqual([a.kind, a.points, a.groupKey, a.dueAt], ['assignment', 10, 'gw', toCanvasTime('2027-01-29', '23:59')]);
  assert.deepEqual(a.submissionTypes, ['online_upload', 'online_text_entry']);
  assert.equal(a.body, undefined);
  assert.equal(item(e, 'a8').dueAt, toCanvasTime('2027-03-19', '23:59'));
});
test('an item with no due date has no due time, and an unknown group is dropped', () => {
  const u = item(toExport(course()), 'a9');
  assert.equal('dueAt' in u, false);
  assert.equal('groupKey' in u, false);
});
test('quizzes never carry points', () => {
  const q = item(toExport(course()), 'q7');
  assert.deepEqual([q.kind, 'points' in q, q.groupKey, q.dueAt], ['quiz', false, 'ge', toCanvasTime('2027-03-12', '23:59')]);
});
test('Start Here pages get their placeholder text, and the discussion can be ungraded', () => {
  const e = toExport(course());
  const [welcome, syllabus, intro] = e.modules[0].items;
  assert.deepEqual([welcome.kind, welcome.body], ['page', '<p>[Write your welcome message here.]</p>']);
  assert.equal(syllabus.body, '<p><a href="$CANVAS_COURSE_REFERENCE$/assignments/syllabus">Read the course syllabus</a></p>');
  assert.deepEqual(['points' in welcome, 'groupKey' in welcome, 'dueAt' in welcome], [false, false, false]);
  assert.deepEqual([intro.kind, 'points' in intro], ['discussion', false]);
});
test('annotation assignments carry the attach-your-document note', () => {
  assert.equal(item(toExport(course()), 'a8').body, '<p><strong>Attach your document in Canvas before students see this.</strong></p>');
});
test('separate extra credit: a +3% group and a 10-point assignment in its week', () => {
  const e = toExport(course({ extraCredit: { mode: 'separate', name: 'Museum visit', percent: 3, week: 10 } }));
  assert.equal(e.groups.length, 5);
  const g = e.groups[4];
  assert.deepEqual([g.name, g.weight, g.dropLowest], ['Extra credit', 3, 0]);
  const last = mod(e, weekLabel('2027-01-25', 10)).items.at(-1);
  assert.deepEqual([last.title, last.points, last.groupKey, last.submissionTypes], ['Museum visit', 10, g.key, ['online_upload']]);
});
test('bonus extra credit: a 0-point assignment in the last week that uses the group', () => {
  const e = toExport(course({ extraCredit: { mode: 'bonus', name: 'Exam bonus', groupId: 'ge' } }));
  assert.equal(e.groups.length, 4);
  const last = mod(e, weekLabel('2027-01-25', 7)).items.at(-1);
  assert.deepEqual([last.title, last.points, last.groupKey], ['Exam bonus', 0, 'ge']);
  const none = toExport(course({ extraCredit: { mode: 'bonus', name: 'B', groupId: 'gp' } }));
  assert.equal(none.modules.at(-1).items.at(-1).title, 'B');
});
test('Other grading sends no weights', () => {
  const e = toExport(course({ grading: 'other' }));
  assert.equal(e.weighted, false);
  assert.deepEqual(e.groups.map((g) => g.weight), [0, 0, 0, 0]);
  assert.equal(toExport(course()).weighted, true);
  assert.deepEqual(toExport(course()).groups.map((g) => [g.weight, g.dropLowest]), [[25, 1], [30, 0], [35, 0], [10, 0]]);
});
test('home page lists only the chosen sections, or is left out', () => {
  assert.deepEqual(toExport(course()).homePage, { sections: ['welcome', 'syllabus', 'communication', 'startHere'] });
  const some = { welcome: true, syllabus: false, communication: false, startHere: true };
  assert.deepEqual(toExport(course({ homePage: some })).homePage, { sections: ['welcome', 'startHere'] });
  const off = { welcome: false, syllabus: false, communication: false, startHere: false };
  assert.equal(toExport(course({ homePage: off })).homePage, null);
});
test('toExport does not change the course', () => {
  const c = course({ extraCredit: { mode: 'separate', name: 'X', percent: 3, week: 10 } });
  const before = JSON.stringify(c);
  toExport(c);
  assert.equal(JSON.stringify(c), before);
});
