import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, freshRoot, byText, control, click, change, textOf, unnamedControls } from './ui-helpers.js';
import { mount } from '../src/ui/app.js';
import { fromTemplate } from '../src/templates.js';

const basics = { title: 'PSY 210 Online', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
function open(template = 'weekly', b = basics) {
  const root = freshRoot();
  const store = mount(root, memoryStorage());
  store.set({ course: fromTemplate(template, b), screen: 'review' });
  return { root, store, course: () => store.get().course };
}
const week = (root, n) => root.querySelector(`#week-${n}`);
const rowOf = (root, title) => [...root.querySelectorAll('tr.item-row')].find((tr) => tr.querySelector('input[type="text"]')?.value === title);
const itemTitles = (root, n) => [...week(root, n).querySelectorAll('tr.item-row input[type="text"]')].map((i) => i.value);
const classLabels = (root, n) => [...week(root, n).querySelectorAll('tr.class-row .when')].map(textOf);
const named = (root, name) => [...root.querySelectorAll('[aria-label]')].find((el) => el.getAttribute('aria-label') === name);
const addTo = (root, n, what) => click(byText(week(root, n).querySelector('.add-menu'), 'button', what));
const hybridTTh = (root) => { change(control(root, 'Hybrid'), true); click(byText(root, 'button', 'TTh')); };

test('a section per week plus Start Here, with real table headers', () => {
  const { root } = open();
  assert.equal(textOf(root.querySelector('h1')), 'Review and adjust');
  assert.equal(root.querySelectorAll('section.week').length, 15);
  assert.equal(textOf(week(root, 0).querySelector('h2')), 'Start Here');
  assert.equal(textOf(week(root, 1).querySelector('h2')), 'Week 1 · Jan 25 – 31');
  const heads = [...week(root, 1).querySelectorAll('thead th')];
  assert.ok(heads.every((th) => th.getAttribute('scope') === 'col'));
  assert.deepEqual(heads.slice(0, 5).map(textOf), ['Item name', 'Type', 'Due date', 'Points', 'Grade group']);
  assert.deepEqual(itemTitles(root, 0), ['Welcome', 'Syllabus', 'Introduce yourself']);
  assert.deepEqual(itemTitles(root, 1), ['Week 1 discussion', 'Reading response 1']);
});
test('every control has an accessible name, and names are not repeated within a week', () => {
  const { root } = open();
  hybridTTh(root);
  assert.deepEqual(unnamedControls(root), []);
  const names = [...week(root, 1).querySelectorAll('input, select, button')].map((el) => el.getAttribute('aria-label') ?? textOf(el));
  assert.equal(new Set(names).size, names.length, 'each control in a week can be told apart by name');
});
test('the top bar edits the title', () => {
  const { root, course } = open();
  change(control(root, 'Course title'), 'PSY 211');
  assert.equal(course().title, 'PSY 211');
  assert.equal(control(root, 'Course title').value, 'PSY 211');
});
test('editing a row changes the course', () => {
  const { root, course } = open();
  const row = rowOf(root, 'Reading response 1');
  change(row.querySelector('input[type="text"]'), 'RR 1');
  assert.equal(course().weekRows[0][2].title, 'RR 1');
  change(rowOf(root, 'RR 1').querySelector('input[type="number"]'), '15');
  assert.equal(course().weekRows[0][2].points, 15);
  change(rowOf(root, 'RR 1').querySelector('input[type="date"]'), '2027-01-30');
  assert.equal(course().weekRows[0][2].due, '2027-01-30');
  const exams = course().groups.find((g) => g.name === 'Exams');
  change(rowOf(root, 'RR 1').querySelector('select.group'), exams.id);
  assert.equal(course().weekRows[0][2].groupId, exams.id);
});
test('the Type column says what each item is', () => {
  const { root } = open();
  assert.equal(textOf(rowOf(root, 'Reading response 1').querySelector('.type')), 'Assignment · file upload, text entry');
  assert.equal(textOf(rowOf(root, 'Week 1 discussion').querySelector('.type')), 'Discussion');
  assert.equal(textOf(rowOf(root, 'Welcome').querySelector('.type')), 'Page');
});
test('a quiz shows where its points come from and has no points box', () => {
  const { root } = open();
  const quiz = rowOf(root, 'Midterm exam');
  assert.equal(textOf(quiz.querySelector('.type')), 'Quiz');
  assert.equal(textOf(quiz.querySelector('.points')), 'set by its questions in Canvas');
  assert.equal(quiz.querySelector('input[type="number"]'), null);
});
test('changing the first day re-dates everything', () => {
  const { root, course } = open();
  change(control(root, 'First day'), '2027-08-30');
  assert.equal(textOf(week(root, 1).querySelector('h2')), 'Week 1 · Aug 30 – Sep 5');
  assert.equal(rowOf(root, 'Reading response 1').querySelector('input[type="date"]').value, '2027-09-03');
  assert.equal(course().firstDay, '2027-08-30');
});
test('fully asynchronous: one theme and readings line per week, and no Meets row', () => {
  const { root, course } = open();
  assert.equal(control(root, 'Fully asynchronous').checked, true);
  assert.equal(root.querySelector('#meets'), null);
  assert.deepEqual(classLabels(root, 1), ['This week']);
  const row = week(root, 3).querySelector('tr.class-row');
  change(row.querySelector('input.theme'), 'Memory');
  change(week(root, 3).querySelector('tr.class-row input.readings'), 'Myers Ch. 8;  Loftus (1975) ; ');
  assert.deepEqual([course().weekRows[2][0].theme, course().weekRows[2][0].readings], ['Memory', ['Myers Ch. 8', 'Loftus (1975)']]);
  assert.equal(week(root, 3).querySelector('tr.class-row input.readings').value, 'Myers Ch. 8; Loftus (1975)');
});
test('hybrid: meeting days make class lines and never touch assignments', () => {
  const { root, course } = open();
  const before = itemTitles(root, 1);
  hybridTTh(root);
  assert.deepEqual(course().meets, [2, 4]);
  assert.deepEqual(classLabels(root, 1), ['Tue Jan 26 class', 'Thu Jan 28 class']);
  assert.deepEqual(itemTitles(root, 1), before);
  assert.equal(named(root, 'Tuesday').checked, true);
  change(named(root, 'Friday'), true);
  assert.deepEqual(classLabels(root, 1), ['Tue Jan 26 class', 'Thu Jan 28 class', 'Fri Jan 29 class']);
  click(byText(root, 'button', 'MWF'));
  assert.deepEqual(course().meets, [1, 3, 5]);
});
test('adding to a week', () => {
  const { root } = open();
  assert.equal(week(root, 3).querySelector('.add-menu').getAttribute('aria-label'), 'Add to Week 3');
  addTo(root, 3, 'Assignment');
  assert.equal(itemTitles(root, 3).at(-1), 'New assignment');
  addTo(root, 3, 'Quiz or exam');
  assert.equal(itemTitles(root, 3).at(-1), 'New quiz');
  addTo(root, 3, 'Discussion');
  assert.equal(itemTitles(root, 3).at(-1), 'New discussion');
  assert.equal(byText(week(root, 3).querySelector('.add-menu'), 'button', 'Class meeting'), undefined, 'no extra meetings when fully asynchronous');
  hybridTTh(root);
  addTo(root, 3, 'Class meeting');
  assert.equal(week(root, 3).querySelectorAll('tr.class-row').length, 3);
});
test('moving and removing rows without dragging', () => {
  const { root } = open();
  click(named(root, 'Move Week 1 discussion down'));
  assert.deepEqual(itemTitles(root, 1), ['Reading response 1', 'Week 1 discussion']);
  click(named(root, 'Move Week 1 discussion up'));
  assert.deepEqual(itemTitles(root, 1), ['Week 1 discussion', 'Reading response 1']);
  change(named(root, 'Move Week 1 discussion to another week'), '5');
  assert.deepEqual(itemTitles(root, 1), ['Reading response 1']);
  assert.equal(itemTitles(root, 5).at(-1), 'Week 1 discussion');
  assert.equal(rowOf(root, 'Week 1 discussion').querySelector('input[type="date"]').value, '2027-02-26');
  click(named(root, 'Remove Reading response 1'));
  assert.deepEqual(itemTitles(root, 1), []);
});
test('break reminder: exact words, a calendar link, and Dismiss', () => {
  const { root, course } = open();
  const note = week(root, 8).querySelector('.warn');
  assert.equal(note.getAttribute('role'), 'status');
  assert.ok(textOf(note).startsWith('This week may fall during spring break. Check the HWS academic calendar before you finalize these dates.'));
  const link = note.querySelector('a');
  assert.deepEqual([textOf(link), link.getAttribute('href')], ['HWS academic calendar', 'https://www.hws.edu/catalogue/calendar.aspx']);
  assert.ok(week(root, 8).querySelector('.break-flag'), 'rows in that week are flagged too');
  assert.equal(week(root, 2).querySelector('.warn'), null);
  click(byText(note, 'button', 'Dismiss'));
  assert.equal(week(root, 8).querySelector('.warn'), null);
  assert.equal(week(root, 8).querySelector('.break-flag'), null);
  assert.deepEqual(course().dismissedReminders, [8]);
  assert.ok(week(root, 9).querySelector('.warn'), 'other weeks keep theirs');
});
test('a "No class" line: pick the days, give a reason, and it can be undone', () => {
  const { root, course } = open();
  hybridTTh(root);
  addTo(root, 8, '"No class" line');
  const form = week(root, 8).querySelector('.dialog');
  assert.equal(document.activeElement.closest('.dialog'), form, 'focus moves into the form');
  change(control(form, 'Tue Mar 16'), false);
  change(control(form, 'Reason (optional)'), 'Spring break');
  click(byText(form, 'button', 'Add "No class" line'));
  assert.deepEqual(classLabels(root, 8), ['Tue Mar 16 class', 'Thu Mar 18 — No class · Spring break']);
  assert.equal(week(root, 8).querySelector('.warn'), null, 'the break reminder is cleared');
  click(named(root, 'Undo No class on Thu Mar 18'));
  assert.deepEqual(classLabels(root, 8), ['Tue Mar 16 class', 'Thu Mar 18 class']);
  assert.equal(course().weekRows[7].some((r) => r.noClass), false);
});
test('a "No class" line in a fully asynchronous course covers the week', () => {
  const { root } = open();
  addTo(root, 8, '"No class" line');
  const form = week(root, 8).querySelector('.dialog');
  assert.equal(form.querySelectorAll('input[type="checkbox"]').length, 0);
  click(byText(form, 'button', 'Cancel'));
  assert.equal(week(root, 8).querySelector('.dialog'), null);
  addTo(root, 8, '"No class" line');
  click(byText(week(root, 8).querySelector('.dialog'), 'button', 'Add "No class" line'));
  assert.deepEqual(classLabels(root, 8), ['No class this week']);
});
test('lowering the weeks asks before anything changes', () => {
  const { root, course } = open();
  change(control(root, 'Weeks'), '12');
  assert.equal(course().weeks, 14, 'nothing has changed yet');
  const q = root.querySelector('.dialog[role="alertdialog"]');
  assert.ok(textOf(q).startsWith('Weeks 13–14 have 5 items. What should happen to them?'));
  assert.equal(document.activeElement, byText(q, 'button', 'Move them into Week 12'), 'the safe choice is focused');
  click(byText(q, 'button', 'Cancel'));
  assert.deepEqual([course().weeks, control(root, 'Weeks').value, root.querySelector('.dialog')], [14, '14', null]);
  change(control(root, 'Weeks'), '12');
  click(byText(root.querySelector('.dialog'), 'button', 'Move them into Week 12'));
  assert.equal(course().weeks, 12);
  assert.equal(itemTitles(root, 12).at(-1), 'Final exam');
  assert.equal(root.querySelectorAll('section.week').length, 13);
});
test('deleting instead, and raising the weeks, need no second question', () => {
  const { root, course } = open();
  change(control(root, 'Weeks'), '13');
  assert.ok(textOf(root.querySelector('.dialog')).startsWith('Week 14 has 3 items.'));
  click(byText(root.querySelector('.dialog'), 'button', 'Delete them'));
  assert.equal(course().weeks, 13);
  assert.equal(itemTitles(root, 13).includes('Final exam'), false);
  change(control(root, 'Weeks'), '15');
  assert.deepEqual([course().weeks, root.querySelector('.dialog')], [15, null]);
});
test('a due date outside its week is flagged under the row', () => {
  const { root } = open();
  change(rowOf(root, 'Reading response 1').querySelector('input[type="date"]'), '2027-02-05');
  const warning = week(root, 1).querySelector('tr.row-warning');
  assert.equal(warning.querySelector('[role="status"]') !== null || warning.getAttribute('role') === 'status', true);
  assert.ok(textOf(warning).includes('This due date is not in Week 1.'));
});
