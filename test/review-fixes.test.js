// Tests added after the independent review. Logic only; the screen tests are in ui-review-fixes.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromTemplate } from '../src/templates.js';
import * as e from '../src/edit.js';
import { classDates } from '../src/dates.js';
import { warningsFor } from '../src/warnings.js';
import { toExport } from '../src/export/outline.js';
import { serialize, parseSaved } from '../src/save.js';
import { defaultAnswers, fromAnswers } from '../src/walkthrough.js';

const basics = { title: 'PSY 210', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
const weekly = (b = basics) => fromTemplate('weekly', b);
const hybrid = (meets = [2, 4]) => e.setMeets(e.setFormat(weekly(), 'hybrid'), meets);
const classes = (rows) => rows.filter((r) => r.kind === 'class');
const DAMAGED = 'This saved file is damaged and can\'t be opened.';
const saved = (change) => { const s = JSON.parse(serialize(weekly())); change(s.course); return JSON.stringify(s); };
const kinds = (c, kind) => warningsFor(c).filter((w) => w.kind === kind);

// I2: saved files
test('a saved file missing optional parts opens with sensible defaults', () => {
  const r = parseSaved(saved((c) => { delete c.dismissedReminders; delete c.dueTime; delete c.meets; delete c.homePage; delete c.extraCredit; }));
  assert.equal(r.ok, true);
  assert.deepEqual([r.course.dismissedReminders, r.course.dueTime, r.course.meets, r.course.extraCredit], [[], '23:59', [], { mode: 'none' }]);
  assert.deepEqual(r.course.homePage, { welcome: true, syllabus: true, communication: true, startHere: true });
  assert.doesNotThrow(() => { warningsFor(r.course); toExport(r.course); });
});
test('a saved file with broken insides is refused, not half-opened', () => {
  const bad = [
    (c) => { c.weekRows[0][0] = null; },
    (c) => { c.weekRows[0].push({ id: 'x', kind: 'mystery', title: 'X' }); },
    (c) => { c.weekRows[0].push({ kind: 'assignment', title: 'No id' }); },
    (c) => { c.firstDay = 'banana'; },
    (c) => { c.weeks = 99; },
    (c) => { c.weekRows = []; c.weeks = 0; },
    (c) => { c.groups = [null]; },
    (c) => { c.startHere = 'x'; },
    (c) => { delete c.weekRows[0][0].readings; c.weekRows[0][0].theme = 5; },
  ];
  bad.forEach((change, i) => assert.deepEqual(parseSaved(saved(change)), { ok: false, message: DAMAGED }, `case ${i}`));
});

// I3: extra credit under Other grading
test('Other grading sends no extra credit at all', () => {
  let c = e.setExtraCredit(weekly(), { mode: 'separate', name: 'Museum', percent: 3, week: 10 });
  c = e.setGrading(c, 'other');
  const x = toExport(c);
  assert.equal(x.groups.some((g) => g.name === 'Extra credit'), false);
  assert.equal(x.modules.flatMap((m) => m.items).some((i) => i.title === 'Museum'), false);
  const b = toExport(e.setGrading(e.setExtraCredit(weekly(), { mode: 'bonus', name: 'Bonus', groupId: weekly().groups[0].id }), 'other'));
  assert.equal(b.modules.flatMap((m) => m.items).some((i) => i.title === 'Bonus'), false);
});

// I4: class lines are not lost silently
test('the weeks question also counts class lines that have something typed in them', () => {
  let c = weekly();
  assert.deepEqual(e.weeksToRemove(c, 14), { rows: 0, lines: 0 });
  c = e.setWeeks(c, 13, 'delete');
  c = e.setWeeks(c, 14, 'move');
  c = e.updateRow(c, c.weekRows[13][0].id, { theme: 'Review' });
  assert.deepEqual(e.weeksToRemove(c, 13), { rows: 0, lines: 1 });
  c = e.setNoClass(c, 13, 'week', 'Break');
  assert.deepEqual(e.weeksToRemove(c, 12), { rows: 2, lines: 2 });
});
test('unticking a meeting day and ticking it again brings its theme back', () => {
  let c = hybrid([2, 4]);
  const thu = classes(c.weekRows[2])[1];
  c = e.updateRow(c, thu.id, { theme: 'Memory', readings: ['Myers Ch. 8'] });
  c = e.setNoClass(c, 5, ['2027-02-25'], 'Snow day');
  c = e.setMeets(c, [2]);
  assert.deepEqual(classes(c.weekRows[2]).map((r) => r.date), ['2027-02-09']);
  c = e.setMeets(c, [2, 4]);
  assert.deepEqual(classes(c.weekRows[2]).map((r) => [r.date, r.theme, r.readings]), [['2027-02-09', '', []], ['2027-02-11', 'Memory', ['Myers Ch. 8']]]);
  assert.deepEqual(classes(c.weekRows[4])[1].noClass, { reason: 'Snow day' });
});
test('switching to fully asynchronous and back keeps every meeting and its text', () => {
  let c = hybrid([2, 4]);
  c = e.updateRow(c, classes(c.weekRows[0])[0].id, { theme: 'Tuesday theme' });
  c = e.updateRow(c, classes(c.weekRows[0])[1].id, { theme: 'Thursday theme' });
  c = e.addRow(c, 1, 'class');
  c = e.updateRow(c, classes(c.weekRows[0]).find((r) => r.extra).id, { theme: 'Guest speaker' });
  c = e.setFormat(c, 'async');
  assert.deepEqual(classes(c.weekRows[0]).map((r) => [r.date, r.theme]), [[null, 'Tuesday theme']]);
  c = e.setFormat(c, 'hybrid');
  assert.deepEqual(classes(c.weekRows[0]).map((r) => [r.date, r.theme, !!r.extra]),
    [['2027-01-25', 'Guest speaker', true], ['2027-01-26', 'Tuesday theme', false], ['2027-01-28', 'Thursday theme', false]]);
});
test('parked class lines move with the first day and never reach Canvas', () => {
  let c = hybrid([2, 4]);
  c = e.updateRow(c, classes(c.weekRows[0])[1].id, { theme: 'Thursday theme' });
  c = e.setMeets(c, [2]);
  c = e.setFirstDay(c, '2027-08-30');
  assert.equal(toExport(c).modules.flatMap((m) => m.items).some((i) => i.title.includes('Thursday theme')), false);
  c = e.setMeets(c, [2, 4]);
  assert.deepEqual(classes(c.weekRows[0]).map((r) => [r.date, r.theme]), [['2027-08-31', ''], ['2027-09-02', 'Thursday theme']]);
  assert.deepEqual(parseSaved(serialize(c)), { ok: true, course: c });
});

// I5: a first day that is not a Monday
test('no class meets before the first day of class', () => {
  assert.deepEqual(classDates('2027-01-27', 1, [1, 3, 5]), ['2027-01-27', '2027-01-29']);
  assert.deepEqual(classDates('2027-01-27', 2, [1, 3, 5]), ['2027-02-01', '2027-02-03', '2027-02-05']);
  let c = e.setMeets(e.setFormat(weekly(), 'hybrid'), [1, 3, 5]);
  c = e.setFirstDay(c, '2027-09-01');
  assert.deepEqual(classes(c.weekRows[0]).map((r) => r.date), ['2027-09-01', '2027-09-03']);
});
test('a due date before the first day of class is flagged', () => {
  const c = fromTemplate('weekly', { ...basics, firstDay: '2027-01-27', dueWeekday: 1 });
  const w = kinds(c, 'due-outside').filter((x) => x.week === 1);
  assert.deepEqual([...new Set(w.map((x) => x.message))], ['This due date is before the first day of class.']);
  assert.equal(kinds(weekly(), 'due-outside').length, 0);
});

// I6: items with no grade group
test('graded items with no group are flagged in a weighted course', () => {
  let c = weekly();
  assert.deepEqual(kinds(c, 'no-group'), []);
  c = e.removeGroup(c, c.groups.find((g) => g.name === 'Exams').id);
  const w = kinds(c, 'no-group');
  assert.equal(w.length, 2);
  assert.equal(w[0].message, 'This item has no grade group, so it won\'t count toward the grade.');
  assert.deepEqual(kinds(e.setGrading(c, 'other'), 'no-group'), []);
});
test('an ungraded discussion and a page need no group', () => {
  const c = e.addRow(weekly(), 1, 'discussion');
  const added = c.weekRows[0].at(-1);
  const ungraded = e.updateRow(e.updateRow(c, added.id, { groupId: '' }), added.id, { points: '' });
  assert.deepEqual(kinds(ungraded, 'no-group'), []);
});
test('renaming a suggested group in the walkthrough keeps its items in it', () => {
  const a = defaultAnswers();
  a.groups = a.groups.map((g) => (g.name === 'Exams' ? { ...g, name: 'Tests' } : g));
  const c = fromAnswers(basics, a);
  const midterm = c.weekRows[6].at(-1);
  assert.equal(c.groups.find((g) => g.id === midterm.groupId)?.name, 'Tests');
});

// I7
test('changing the first day brings dismissed break reminders back', () => {
  let c = e.dismissReminder(weekly(), 13);
  c = e.setFirstDay(c, '2027-08-30');
  assert.deepEqual(c.dismissedReminders, []);
  assert.ok(kinds(c, 'break').some((w) => w.week === 13));
  const same = e.setFirstDay(e.dismissReminder(weekly(), 8), '2027-01-26');
  assert.deepEqual(same.dismissedReminders, [8], 'a change inside the same week keeps them');
});
