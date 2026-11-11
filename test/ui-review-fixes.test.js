// Screen tests added after the independent review. The logic tests are in review-fixes.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, freshRoot, byText, control, click, change, textOf } from './ui-helpers.js';
import { mount } from '../src/ui/app.js';
import { io } from '../src/ui/io.js';
import { fromTemplate } from '../src/templates.js';
import { defaultAnswers } from '../src/walkthrough.js';
import * as e from '../src/edit.js';

const basics = { title: 'PSY 210 Online', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
function open(course = fromTemplate('weekly', basics)) {
  const root = freshRoot();
  const store = mount(root, memoryStorage());
  store.set({ course, screen: 'review' });
  const downloads = [];
  io.download = (content, name, mime) => downloads.push({ content, name, mime });
  return { root, store, downloads, course: () => store.get().course };
}
const named = (root, name) => [...root.querySelectorAll('[aria-label]')].find((el) => el.getAttribute('aria-label') === name);
const rowOf = (root, title) => [...root.querySelectorAll('tr.item-row')].find((tr) => tr.querySelector('input[type="text"]')?.value === title);
/** A weekly course whose Week 14 holds nothing but a class line with a theme. */
function emptyLastWeekWithTheme() {
  let c = e.setWeeks(e.setWeeks(fromTemplate('weekly', basics), 13, 'delete'), 14, 'move');
  return e.updateRow(c, c.weekRows[13][0].id, { theme: 'Review' });
}

test('removing a week that only has a typed class line still asks first', () => {
  const { root, course } = open(emptyLastWeekWithTheme());
  change(control(root, 'Weeks'), '13');
  assert.equal(course().weeks, 14, 'nothing has changed yet');
  const q = root.querySelector('.dialog[role="alertdialog"]');
  assert.ok(textOf(q).startsWith('Week 14 has 1 class line with a theme or readings. It will be removed.'), textOf(q));
  assert.equal(byText(q, 'button', /Move them/), undefined, 'there are no items to move');
  assert.equal(document.activeElement, byText(q, 'button', 'Cancel'), 'the safe choice is focused');
  click(byText(q, 'button', 'Cancel'));
  assert.equal(course().weeks, 14);
  change(control(root, 'Weeks'), '13');
  click(byText(root.querySelector('.dialog'), 'button', 'Remove Week 14'));
  assert.deepEqual([course().weeks, root.querySelector('.dialog')], [13, null]);
});
test('the weeks question mentions typed class lines along with the items', () => {
  let c = fromTemplate('weekly', basics);
  c = e.updateRow(c, c.weekRows[13][0].id, { theme: 'Review' });
  c = e.updateRow(c, c.weekRows[12][0].id, { readings: ['Myers Ch. 14'] });
  const { root } = open(c);
  change(control(root, 'Weeks'), '12');
  const q = root.querySelector('.dialog[role="alertdialog"]');
  assert.ok(textOf(q).startsWith('Weeks 13–14 have 5 items. What should happen to them?'));
  assert.ok(textOf(q).includes('2 class lines with a theme or readings will be removed either way.'), textOf(q));
});
test('an item with no grade group says so under its row, and before a download', () => {
  const { root, downloads } = open();
  change(named(root, 'Grade group for Midterm exam'), '');
  const warning = rowOf(root, 'Midterm exam').nextElementSibling;
  assert.ok(warning.matches('tr.row-warning') && textOf(warning).includes('This item has no grade group, so it won\'t count toward the grade.'));
  click(byText(root, 'button', 'Download for Canvas'));
  const q = root.querySelector('.dialog[role="alertdialog"]');
  assert.deepEqual([...q.querySelectorAll('li')].map(textOf), ['Midterm exam: This item has no grade group, so it won\'t count toward the grade.']);
  assert.equal(downloads.length, 0);
});
test('walkthrough: a renamed group keeps its items when the course is built', () => {
  const root = freshRoot();
  const store = mount(root, memoryStorage());
  store.set({ basics, answers: defaultAnswers(), step: 3, groupsEdited: false, screen: 'walkthrough' });
  change(named(root, 'Name of group Exams'), 'Tests');
  assert.ok(byText(root, 'p', /Rename a group and its items stay in it\./));
  store.set({ step: 5 });
  click(byText(root, 'button', 'Build my course'));
  const { course } = store.get();
  const final = course.weekRows[13].find((r) => r.title === 'Final exam');
  assert.equal(course.groups.find((g) => g.id === final.groupId)?.name, 'Tests');
  assert.equal(course.groups.some((g) => 'role' in g), false, 'the course does not carry the walkthrough\'s bookkeeping');
});
