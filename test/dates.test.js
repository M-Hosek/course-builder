import test from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../src/dates.js';
import { classLine, noClassLine, weekLine } from '../src/lines.js';
import { newCourse, SUBMISSION_TYPES } from '../src/model.js';

test('weeks run Monday to Sunday around the first day of class', () => {
  assert.equal(d.weekStart('2027-01-27'), '2027-01-25');
  assert.deepEqual(d.weekRange('2027-01-27', 1), { start: '2027-01-25', end: '2027-01-31' });
  assert.deepEqual(d.weekRange('2027-01-25', 8), { start: '2027-03-15', end: '2027-03-21' });
});
test('week labels', () => {
  assert.equal(d.weekLabel('2027-01-25', 1), 'Week 1 · Jan 25 – 31');
  assert.equal(d.weekLabel('2027-01-25', 2), 'Week 2 · Feb 1 – 7');
  assert.equal(d.weekLabel('2027-01-25', 5), 'Week 5 · Feb 22 – 28');
  assert.equal(d.weekLabel('2027-01-29', 1), 'Week 1 · Jan 25 – 31');
  assert.equal(d.weekLabel('2027-01-25', 10), 'Week 10 · Mar 29 – Apr 4');
});
test('which week a date falls in', () => {
  assert.equal(d.weekOf('2027-01-25', '2027-03-19'), 8);
  assert.equal(d.weekOf('2027-01-25', '2027-01-20'), 0);
});
test('due dates and class dates inside a week', () => {
  assert.equal(d.dueDateFor('2027-01-25', 1, 5), '2027-01-29');
  assert.equal(d.dueDateFor('2027-01-25', 1, 0), '2027-01-31');
  assert.deepEqual(d.classDates('2027-01-25', 1, [2, 4]), ['2027-01-26', '2027-01-28']);
});
test('11:59 pm Eastern on both sides of both clock changes', () => {
  assert.equal(d.toCanvasTime('2027-03-12', '23:59'), '2027-03-13T04:59:00');
  assert.equal(d.toCanvasTime('2027-03-19', '23:59'), '2027-03-20T03:59:00');
  assert.equal(d.toCanvasTime('2027-11-05', '23:59'), '2027-11-06T03:59:00');
  assert.equal(d.toCanvasTime('2027-11-12', '23:59'), '2027-11-13T04:59:00');
});
test('Thanksgiving is the fourth Thursday of November', () => {
  assert.equal(d.thanksgiving(2027), '2027-11-25');
  assert.equal(d.thanksgiving(2026), '2026-11-26');
});
test('date arithmetic', () => {
  assert.equal(d.addDays('2027-02-27', 3), '2027-03-02');
  assert.equal(d.daysBetween('2027-01-25', '2027-08-30'), 217);
  assert.equal(d.dayLabel('2027-01-26'), 'Tue Jan 26');
});
test('class lines', () => {
  assert.equal(classLine({ date: '2027-01-26', theme: 'What is psychology?', readings: ['Myers Ch. 1', 'Milgram (1963)'] }),
    'Tue Jan 26 — What is psychology? · Readings: Myers Ch. 1; Milgram (1963)');
  assert.equal(classLine({ date: '2027-01-26', theme: 'What is psychology?', readings: [] }), 'Tue Jan 26 — What is psychology?');
  assert.equal(classLine({ date: '2027-01-26', theme: '', readings: [] }), 'Tue Jan 26 — Class meeting');
  assert.equal(classLine({ date: '2027-01-26', theme: '', readings: ['Myers Ch. 1'] }), 'Tue Jan 26 — Class meeting · Readings: Myers Ch. 1');
});
test('no-class lines', () => {
  assert.equal(noClassLine({ date: '2027-11-25', reason: 'Thanksgiving break' }), 'Thu Nov 25 — No class · Thanksgiving break');
  assert.equal(noClassLine({ date: '2027-11-25' }), 'Thu Nov 25 — No class');
});
test('whole-week lines', () => {
  assert.equal(weekLine({ theme: 'Memory', readings: ['Myers Ch. 8'] }), 'Memory · Readings: Myers Ch. 8');
  assert.equal(weekLine({ theme: 'Memory', readings: [] }), 'Memory');
  assert.equal(weekLine({ theme: '', readings: ['Myers Ch. 8'] }), 'Readings: Myers Ch. 8');
  assert.equal(weekLine({ theme: '', readings: [] }), '');
});
test('a new course has every week, one whole-week class row each, and Start Here', () => {
  const basics = { title: 'PSY 210', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
  const c = newCourse(basics);
  assert.equal(c.weekRows.length, 14);
  for (const rows of c.weekRows) assert.deepEqual(rows.map((r) => [r.kind, r.date]), [['class', null]]);
  assert.deepEqual(c.startHere.map((r) => r.kind), ['page', 'page', 'discussion']);
  assert.deepEqual(c.startHere.map((r) => r.title), ['Welcome', 'Syllabus', 'Introduce yourself']);
  assert.deepEqual([c.version, c.format, c.grading, c.dueTime, c.extraCredit.mode], [1, 'async', 'weighted', '23:59', 'none']);
  assert.deepEqual(c.homePage, { welcome: true, syllabus: true, communication: true, startHere: true });
  assert.notEqual(newCourse(basics).weekRows[0][0].id, c.weekRows[0][0].id);
  assert.equal(SUBMISSION_TYPES.length, 4);
});
