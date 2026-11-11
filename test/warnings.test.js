import test from 'node:test';
import assert from 'node:assert/strict';
import { fromTemplate } from '../src/templates.js';
import * as e from '../src/edit.js';
import { warningsFor, breakWeeks, BREAK_CALENDAR_URL } from '../src/warnings.js';

const spring = (weeks = 14) => fromTemplate('weekly', { title: 'PSY 210', firstDay: '2027-01-25', weeks, dueWeekday: 5 });
const fall = () => fromTemplate('weekly', { title: 'PSY 210', firstDay: '2027-08-30', weeks: 15, dueWeekday: 5 });
const kinds = (c, kind) => warningsFor(c).filter((w) => w.kind === kind);
const weights = (c, ws) => ({ ...c, groups: c.groups.map((g, i) => ({ ...g, weight: ws[i] })) });
const find = (c, title) => c.weekRows.flat().find((r) => r.title === title);

test('weights that miss 100% are reported, in plain words', () => {
  assert.deepEqual(kinds(spring(), 'weights'), []);
  const w = kinds(weights(spring(), [25, 30, 35, 5]), 'weights');
  assert.deepEqual(w.map((x) => [x.message, x.dismissible]), [['Grade weights add up to 95%, not 100%.', false]]);
  assert.equal(kinds(weights(spring(), [33.33, 33.33, 33.34, 0]), 'weights').length, 0);
  assert.equal(kinds(weights(spring(), [33.3, 33.3, 33.3, 0]), 'weights')[0].message, 'Grade weights add up to 99.9%, not 100%.');
});
test('Other grading and extra credit on top of 100% raise no weights warning', () => {
  assert.deepEqual(kinds(e.setGrading(weights(spring(), [25, 30, 35, 5]), 'other'), 'weights'), []);
  assert.deepEqual(kinds(e.setExtraCredit(spring(), { mode: 'separate', name: 'X', percent: 3, week: 10 }), 'weights'), []);
});
test('a weighted course with no groups is told what to do', () => {
  const c = { ...spring(), groups: [] };
  assert.equal(kinds(c, 'weights')[0].message, 'Add at least one grade group, or choose Other.');
});
test('which weeks may fall in a break', () => {
  assert.deepEqual(breakWeeks(spring()), [7, 8, 9, 10].map((week) => ({ week, kind: 'spring' })));
  assert.deepEqual(breakWeeks(fall()), [{ week: 13, kind: 'thanksgiving' }]);
  assert.deepEqual(breakWeeks(spring(5)), []);
});
test('break reminders use the exact wording and can be dismissed', () => {
  const b = kinds(spring(), 'break');
  assert.deepEqual(b.map((w) => w.week), [7, 8, 9, 10]);
  assert.equal(b[0].message, 'This week may fall during spring break. Check the HWS academic calendar before you finalize these dates.');
  assert.ok(b.every((w) => w.dismissible));
  assert.equal(kinds(fall(), 'break')[0].message, 'This week may fall during Thanksgiving break. Check the HWS academic calendar before you finalize these dates.');
  assert.equal(BREAK_CALENDAR_URL, 'https://www.hws.edu/catalogue/calendar.aspx');
  assert.deepEqual(kinds(e.dismissReminder(spring(), 8), 'break').map((w) => w.week), [7, 9, 10]);
});
test('a No class line clears that week reminder', () => {
  assert.deepEqual(kinds(e.setNoClass(spring(), 9, 'week', 'Spring break'), 'break').map((w) => w.week), [7, 8, 10]);
});
test('due dates outside the course, or outside their week, are flagged on the row', () => {
  let c = spring();
  const rr1 = find(c, 'Reading response 1');
  c = e.updateRow(c, rr1.id, { due: '2027-06-01' });
  assert.deepEqual(kinds(c, 'due-outside').map((w) => [w.rowId, w.week, w.message]), [[rr1.id, 1, 'This due date is outside the course dates.']]);
  c = e.updateRow(c, rr1.id, { due: '2027-01-20' });
  assert.equal(kinds(c, 'due-outside')[0].message, 'This due date is before the first day of class.');
  c = e.updateRow(c, rr1.id, { due: '2027-02-05' });
  assert.equal(kinds(c, 'due-outside')[0].message, 'This due date is not in Week 1.');
  const moved = e.setWeeks(spring(), 12, 'move');
  assert.ok(kinds(moved, 'due-outside').some((w) => w.message === 'This due date is outside the course dates.' && w.week === 12));
});
test('annotation assignments carry the attach-your-document reminder', () => {
  let c = spring();
  const rr1 = find(c, 'Reading response 1');
  assert.deepEqual(kinds(c, 'annotation'), []);
  c = e.updateRow(c, rr1.id, { submissionTypes: ['online_upload', 'student_annotation'] });
  assert.deepEqual(kinds(c, 'annotation').map((w) => [w.rowId, w.message]), [[rr1.id, 'Attach your document in Canvas before students see this.']]);
});
test('order: weights first, then week by week, and every warning has its own id', () => {
  let c = weights(spring(), [25, 30, 35, 5]);
  c = e.updateRow(c, find(c, 'Reading response 1').id, { due: '2027-06-01' });
  const all = warningsFor(c);
  assert.deepEqual(all.map((w) => w.kind), ['weights', 'due-outside', 'break', 'break', 'break', 'break']);
  assert.equal(new Set(all.map((w) => w.id)).size, all.length);
});
