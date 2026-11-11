import test from 'node:test';
import assert from 'node:assert/strict';
import { fromTemplate } from '../src/templates.js';
import * as e from '../src/edit.js';

const basics = { title: 'PSY 210', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
const weekly = () => fromTemplate('weekly', basics);
const hybrid = (meets = [2, 4]) => e.setMeets(e.setFormat(weekly(), 'hybrid'), meets);
const items = (rows) => rows.filter((r) => r.kind !== 'class');
const classes = (rows) => rows.filter((r) => r.kind === 'class');
const titles = (rows) => items(rows).map((r) => r.title);
const find = (c, title) => [...c.startHere, ...c.weekRows.flat()].find((r) => r.title === title);
/** Runs an edit and checks the course it was given is untouched. */
function pure(c, fn) {
  const before = JSON.stringify(c);
  const out = fn(c);
  assert.equal(JSON.stringify(c), before, 'the original course was changed');
  assert.notEqual(out, c);
  return out;
}

test('basics', () => {
  const c = pure(weekly(), (x) => e.setBasics(x, { title: 'New title', dueWeekday: 0 }));
  assert.deepEqual([c.title, c.dueWeekday], ['New title', 0]);
  assert.equal(find(c, 'Reading response 1').due, '2027-01-29', 'changing the usual due day does not move existing dates');
});
test('changing the first day moves every date by the same number of days', () => {
  const start = hybrid();
  const c = pure(start, (x) => e.setFirstDay(x, '2027-08-30'));
  assert.equal(c.firstDay, '2027-08-30');
  assert.equal(find(c, 'Reading response 1').due, '2027-09-03');
  assert.equal(find(c, 'Introduce yourself').due, '2027-09-03');
  assert.deepEqual(classes(c.weekRows[0]).map((r) => r.date), ['2027-08-31', '2027-09-02']);
  assert.equal(find(c, 'Welcome').due, undefined);
});
test('a first day in mid-week keeps class days on their weekdays', () => {
  const c = e.setFirstDay(hybrid(), '2027-09-01');
  assert.deepEqual(classes(c.weekRows[0]).map((r) => r.date), ['2027-09-02'], 'no class before the first day');
  assert.equal(find(c, 'Reading response 1').due, '2027-09-03');
});
test('lowering the weeks asks first: moving is the default, deleting is the alternative', () => {
  const c = weekly();
  assert.deepEqual(e.weeksToRemove(c, 12), { rows: 5, lines: 0 });
  assert.deepEqual(e.weeksToRemove(c, 14), { rows: 0, lines: 0 });
  const moved = pure(c, (x) => e.setWeeks(x, 12, 'move'));
  assert.deepEqual([moved.weeks, moved.weekRows.length], [12, 12]);
  assert.deepEqual(titles(moved.weekRows[11]),
    ['Week 12 discussion', 'Reading response 12', 'Week 13 discussion', 'Reading response 13', 'Week 14 discussion', 'Reading response 14', 'Final exam']);
  assert.equal(find(moved, 'Reading response 13').due, '2027-04-23', 'moved items keep their old date');
  assert.equal(classes(moved.weekRows[11]).length, 1, 'removed weeks class lines are not moved');
  const deleted = e.setWeeks(c, 12, 'delete');
  assert.deepEqual(titles(deleted.weekRows[11]), ['Week 12 discussion', 'Reading response 12']);
  assert.equal(find(deleted, 'Final exam'), undefined);
});
test('raising the weeks adds empty weeks with their class lines', () => {
  const c = pure(e.setWeeks(weekly(), 12, 'delete'), (x) => e.setWeeks(x, 14, 'move'));
  assert.equal(c.weekRows.length, 14);
  assert.deepEqual(c.weekRows[13].map((r) => [r.kind, r.date]), [['class', null]]);
  const h = e.setWeeks(hybrid(), 15, 'move');
  assert.deepEqual(h.weekRows[14].map((r) => r.date), ['2027-05-04', '2027-05-06']);
  assert.equal(e.setWeeks(weekly(), 99, 'move').weeks, 30);
  assert.equal(e.setWeeks(weekly(), 0, 'delete').weeks, 1);
});
test('hybrid: one class line per meeting day, and meeting days never touch assignments', () => {
  const before = weekly();
  const c = pure(e.setFormat(before, 'hybrid'), (x) => e.setMeets(x, [2, 4]));
  assert.deepEqual(c.weekRows[0].map((r) => r.kind), ['class', 'class', 'discussion', 'assignment']);
  assert.deepEqual(classes(c.weekRows[0]).map((r) => r.date), ['2027-01-26', '2027-01-28']);
  assert.deepEqual(c.weekRows.map(items), before.weekRows.map(items));
});
test('changing meeting days keeps the lines for days that still meet', () => {
  let c = hybrid([2, 4]);
  const tue = classes(c.weekRows[0])[0];
  c = e.updateRow(c, tue.id, { theme: 'What is psychology?', readings: ['Myers Ch. 1'] });
  c = pure(c, (x) => e.setMeets(x, [2, 5]));
  assert.deepEqual(classes(c.weekRows[0]).map((r) => [r.date, r.theme]), [['2027-01-26', 'What is psychology?'], ['2027-01-29', '']]);
  c = e.setMeets(c, [1, 2, 5]);
  assert.deepEqual(classes(c.weekRows[0]).map((r) => r.date), ['2027-01-25', '2027-01-26', '2027-01-29']);
});
test('switching format carries the theme across and back', () => {
  let c = weekly();
  c = e.updateRow(c, c.weekRows[2][0].id, { theme: 'Memory', readings: ['Myers Ch. 8'] });
  c = e.setFormat(c, 'hybrid');
  assert.deepEqual(classes(c.weekRows[2]).map((r) => [r.date, r.theme]), [[null, 'Memory']], 'nothing changes until a meeting day is picked');
  c = e.setMeets(c, [1, 3]);
  assert.deepEqual(classes(c.weekRows[2]).map((r) => [r.date, r.theme, r.readings]), [['2027-02-08', 'Memory', ['Myers Ch. 8']], ['2027-02-10', '', []]]);
  c = e.setFormat(c, 'async');
  assert.deepEqual(classes(c.weekRows[2]).map((r) => [r.date, r.theme, r.readings]), [[null, 'Memory', ['Myers Ch. 8']]]);
  assert.deepEqual(c.meets, [1, 3], 'meeting days are remembered');
});
test('adding rows', () => {
  let c = weekly();
  c = pure(c, (x) => e.addRow(x, 3, 'assignment'));
  const a = c.weekRows[2].at(-1);
  assert.deepEqual([a.kind, a.title, a.points, a.due, a.groupId], ['assignment', 'New assignment', 10, '2027-02-12', c.groups[0].id]);
  assert.deepEqual(a.submissionTypes, ['online_upload', 'online_text_entry']);
  const d = e.addRow(c, 3, 'discussion').weekRows[2].at(-1);
  assert.deepEqual([d.kind, d.title, d.points, d.due], ['discussion', 'New discussion', 10, '2027-02-12']);
  const q = e.addRow(c, 3, 'quiz').weekRows[2].at(-1);
  assert.deepEqual([q.kind, q.title, 'points' in q, q.due], ['quiz', 'New quiz', false, '2027-02-12']);
  const s = e.addRow(c, 0, 'discussion');
  assert.equal(s.startHere.at(-1).title, 'New discussion');
  assert.deepEqual(e.addRow(c, 3, 'class'), c, 'no extra class meetings in a fully asynchronous course');
  const h = e.addRow(hybrid(), 3, 'class');
  assert.deepEqual(classes(h.weekRows[2]).map((r) => [r.date, !!r.extra]), [['2027-02-08', true], ['2027-02-09', false], ['2027-02-11', false]]);
  assert.equal(classes(e.setMeets(h, [3]).weekRows[2]).some((r) => r.extra), true, 'one-off meetings survive a change of meeting days');
});
test('updating rows', () => {
  let c = weekly();
  const a = find(c, 'Reading response 1');
  c = pure(c, (x) => e.updateRow(x, a.id, { title: 'RR1', points: 15, due: '2027-01-30', submissionTypes: ['media_recording'] }));
  assert.deepEqual([find(c, 'RR1').points, find(c, 'RR1').due, find(c, 'RR1').submissionTypes], [15, '2027-01-30', ['media_recording']]);
  c = e.updateRow(c, a.id, { due: '' });
  assert.equal('due' in find(c, 'RR1'), false);
  const q = find(c, 'Midterm exam');
  assert.equal('points' in find(e.updateRow(c, q.id, { points: 100 }), 'Midterm exam'), false, 'quizzes never get points');
});
test('removing and moving rows', () => {
  let c = weekly();
  const d = find(c, 'Week 1 discussion');
  const moved = pure(c, (x) => e.moveRow(x, d.id, 1, 2));
  assert.deepEqual(titles(moved.weekRows[0]), ['Reading response 1', 'Week 1 discussion']);
  const across = e.moveRow(c, d.id, 5, 99);
  assert.deepEqual(titles(across.weekRows[0]), ['Reading response 1']);
  assert.equal(across.weekRows[4].at(-1).title, 'Week 1 discussion');
  assert.equal(across.weekRows[4].at(-1).due, '2027-02-26', 'the due date follows the item to its new week');
  const toStart = e.moveRow(c, d.id, 0, 0);
  assert.equal(toStart.startHere[0].title, 'Week 1 discussion');
  c = pure(c, (x) => e.removeRow(x, d.id));
  assert.equal(find(c, 'Week 1 discussion'), undefined);
});
test('no class: covers the chosen days, and can be undone with the theme intact', () => {
  let c = hybrid();
  const thu = classes(c.weekRows[7])[1];
  c = e.updateRow(c, thu.id, { theme: 'Memory' });
  c = pure(c, (x) => e.setNoClass(x, 8, ['2027-03-18'], 'Spring break'));
  assert.deepEqual(classes(c.weekRows[7]).map((r) => r.noClass), [undefined, { reason: 'Spring break' }]);
  c = pure(c, (x) => e.clearNoClass(x, thu.id));
  assert.deepEqual(classes(c.weekRows[7]).map((r) => [r.theme, r.noClass]), [['', undefined], ['Memory', undefined]]);
  const all = e.setNoClass(hybrid(), 8, 'week', '');
  assert.deepEqual(classes(all.weekRows[7]).map((r) => r.noClass), [{ reason: '' }, { reason: '' }]);
  const asyncWeek = e.setNoClass(weekly(), 8, 'week', 'Break');
  assert.deepEqual(asyncWeek.weekRows[7][0].noClass, { reason: 'Break' });
});
test('grading, groups and extra credit', () => {
  let c = weekly();
  assert.equal(pure(c, (x) => e.setGrading(x, 'other')).grading, 'other');
  c = pure(c, (x) => e.addGroup(x));
  assert.deepEqual([c.groups.length, c.groups[4].name, c.groups[4].weight, c.groups[4].dropLowest], [5, 'New group', 0, 0]);
  c = pure(c, (x) => e.updateGroup(x, x.groups[0].id, { name: 'Talk', weight: 20, dropLowest: 1 }));
  assert.deepEqual([c.groups[0].name, c.groups[0].weight, c.groups[0].dropLowest], ['Talk', 20, 1]);
  const exams = c.groups.find((g) => g.name === 'Exams');
  c = e.setExtraCredit(c, { mode: 'bonus', name: 'Bonus', groupId: exams.id });
  c = pure(c, (x) => e.removeGroup(x, exams.id));
  assert.equal(c.groups.some((g) => g.name === 'Exams'), false);
  assert.equal('groupId' in find(c, 'Midterm exam'), false);
  assert.deepEqual(c.extraCredit, { mode: 'none' }, 'a bonus in a removed group is dropped');
});
test('separate extra credit is pulled back when its week is removed', () => {
  let c = e.setExtraCredit(weekly(), { mode: 'separate', name: 'Museum', percent: 3, week: 14 });
  c = e.setWeeks(c, 12, 'move');
  assert.equal(c.extraCredit.week, 12);
});
test('home page sections and reminder dismissals', () => {
  let c = pure(weekly(), (x) => e.setHomePage(x, { syllabus: false }));
  assert.deepEqual(c.homePage, { welcome: true, syllabus: false, communication: true, startHere: true });
  c = pure(c, (x) => e.dismissReminder(x, 8));
  c = e.dismissReminder(c, 8);
  assert.deepEqual(c.dismissedReminders, [8]);
  assert.deepEqual(e.setWeeks(e.dismissReminder(c, 13), 12, 'delete').dismissedReminders, [8]);
});
