import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, freshRoot, byText, control, click, change, textOf, unnamedControls } from './ui-helpers.js';
import { mount } from '../src/ui/app.js';
import { defaultAnswers, suggestGroups } from '../src/walkthrough.js';
import { fromTemplate } from '../src/templates.js';

const basics = { title: 'HIST 228', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
function open() {
  const root = freshRoot();
  const store = mount(root, memoryStorage());
  store.set({ basics, answers: defaultAnswers(), step: 1, groupsEdited: false, screen: 'walkthrough' });
  return { root, store, answers: () => store.get().answers };
}
const heading = (root) => textOf(root.querySelector('h1'));
const next = (root) => click(byText(root, 'button', 'Next'));
const back = (root) => click(byText(root, 'button', 'Back'));
const named = (root, name) => [...root.querySelectorAll('[aria-label]')].find((el) => el.getAttribute('aria-label') === name);
const weights = (answers) => Object.fromEntries(answers.groups.map((g) => [g.name, g.weight]));

test('five steps, each with one heading and named controls', () => {
  const { root } = open();
  const seen = [];
  for (let i = 0; i < 5; i++) {
    seen.push(heading(root));
    assert.equal(root.querySelectorAll('h1').length, 1);
    assert.deepEqual(unnamedControls(root), [], heading(root));
    assert.equal(document.activeElement, root.querySelector('h1'), 'focus is on the heading of each step');
    if (i < 4) next(root);
  }
  assert.deepEqual(seen, [
    'Step 1 of 5: What will students do each week?',
    'Step 2 of 5: Exams and big projects',
    'Step 3 of 5: How will this course be graded?',
    'Step 4 of 5: How will students turn in assignments?',
    'Step 5 of 5: Your course home page',
  ]);
  assert.ok(byText(root, 'button', 'Build my course'));
});
test('answers are kept going forward and back', () => {
  const { root, answers } = open();
  change(control(root, 'A quiz'), true);
  next(root);
  change(control(root, 'A final exam'), true);
  change(control(root, 'A final project'), true);
  back(root);
  assert.equal(control(root, 'A quiz').checked, true);
  next(root);
  assert.equal(control(root, 'A final exam').checked, true);
  assert.deepEqual([answers().weekly.quiz, answers().exams, answers().project], [true, 'final', true]);
});
test('Back on the first step returns to the plans', () => {
  const { root, store } = open();
  back(root);
  assert.equal(store.get().screen, 'templates');
});
test('suggested groups follow the earlier answers until a weight is edited by hand', () => {
  const { root, answers } = open();
  change(control(root, 'A quiz'), true);
  assert.deepEqual(weights(answers()), weights({ groups: suggestGroups(answers()) }));
  assert.deepEqual(Object.keys(weights(answers())), ['Assignments', 'Discussions', 'Quizzes', 'Exams', 'Participation']);
  next(root); next(root);
  assert.equal(named(root, 'Weight % for Assignments').value, '24');
  change(named(root, 'Weight % for Assignments'), '40');
  back(root); back(root);
  change(control(root, 'A discussion'), false);
  assert.equal(weights(answers()).Assignments, 40, 'hand-edited groups are left alone');
  assert.ok('Discussions' in weights(answers()));
});
test('the grading step can add, remove and switch to Other', () => {
  const { root, answers } = open();
  next(root); next(root);
  click(byText(root, 'button', 'Add a group'));
  assert.equal(answers().groups.at(-1).name, 'New group');
  click(named(root, 'Remove group New group'));
  assert.equal(answers().groups.length, 4);
  change(named(root, 'Drop lowest for Discussions'), '1');
  assert.equal(answers().groups.find((g) => g.name === 'Discussions').dropLowest, 1);
  assert.equal(textOf(root.querySelector('.total')), 'Total: 100%');
  change(control(root, 'Other — I\'ll set up my own grading in Canvas (for example, standards-based or contract grading).'), true);
  assert.equal(answers().grading, 'other');
  assert.equal(root.querySelector('.total'), null);
});
test('the submission step is skipped when nothing is handed in', () => {
  const { root, store } = open();
  change(control(root, 'An assignment'), false);
  next(root); next(root); next(root);
  assert.equal(heading(root), 'Step 5 of 5: Your course home page');
  back(root);
  assert.equal(heading(root), 'Step 3 of 5: How will this course be graded?');
  assert.equal(store.get().step, 3);
});
test('submission types and home page choices are recorded', () => {
  const { root, answers } = open();
  next(root); next(root); next(root);
  change(control(root, 'Media recording'), true);
  change(control(root, 'Text entry'), false);
  assert.deepEqual(answers().submissionTypes, ['online_upload', 'media_recording']);
  next(root);
  change(control(root, 'Communication preferences'), false);
  assert.equal(answers().homePage.communication, false);
});
test('Build my course opens the review screen with the course', () => {
  const { root, store } = open();
  for (let i = 0; i < 4; i++) next(root);
  click(byText(root, 'button', 'Build my course'));
  const s = store.get();
  assert.equal(s.screen, 'review');
  assert.deepEqual(s.course.weekRows[0].filter((r) => r.kind !== 'class').map((r) => r.title), ['Week 1 assignment', 'Week 1 discussion']);
  assert.equal(s.course.title, 'HIST 228');
  assert.equal(textOf(root.querySelector('#week-1 h2')), 'Week 1 · Jan 25 – 31');
});
test('keyboard: everything in a week is a real control in the tab order', () => {
  const root = freshRoot();
  const store = mount(root, memoryStorage());
  store.set({ course: fromTemplate('weekly', basics), screen: 'review' });
  const controls = [...root.querySelectorAll('#week-1 input, #week-1 select, #week-1 button, #week-1 a')];
  assert.ok(controls.length > 20);
  for (const el of controls) {
    assert.notEqual(el.getAttribute('tabindex'), '-1', el.outerHTML.slice(0, 80));
    if (el.tagName === 'BUTTON') assert.equal(el.getAttribute('type'), 'button');
  }
  assert.equal(root.querySelectorAll('#week-1 [onclick], #week-1 div[role="button"], #week-1 span[role="button"]').length, 0, 'no click-only pretend buttons');
  const disabled = controls.filter((el) => el.disabled).map((el) => el.getAttribute('aria-label'));
  assert.deepEqual(disabled, ['Move This week up', 'Move Reading response 1 down'], 'only the moves that cannot happen are switched off');
});
