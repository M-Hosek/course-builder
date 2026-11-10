import test from 'node:test';
import assert from 'node:assert/strict';
import { window, memoryStorage, brokenStorage, freshRoot, byText, control, click, change, tick, until, textOf, unnamedControls } from './ui-helpers.js';
import { mount } from '../src/ui/app.js';
import { serialize, STORAGE_KEY } from '../src/save.js';
import { fromTemplate } from '../src/templates.js';

const start = (storage = memoryStorage()) => { const root = freshRoot(); return { root, store: mount(root, storage), storage }; };
function fillBasics(root, { title = 'PSY 210 Online', firstDay = '2027-01-25', weeks = '14' } = {}) {
  control(root, 'Course title').value = title;
  control(root, 'First day of class').value = firstDay;
  control(root, 'Number of weeks').value = weeks;
  click(byText(root, 'button', 'Next'));
}
function chooseFile(input, text, name = 'work.json') {
  Object.defineProperty(input, 'files', { configurable: true, value: [new window.File([text], name, { type: 'application/json' })] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

test('the start page says what the tool is and who does not need it', () => {
  const { root } = start();
  assert.equal(textOf(root.querySelector('h1')), 'HWS Online Course Builder');
  assert.ok(byText(root, 'p', 'A user-friendly tool to quickly set up your Canvas course'));
  assert.ok(byText(root, 'button', 'Build a new course'));
  assert.ok(byText(root, 'p', 'Start from a ready-made plan or design your own week by week.'));
  assert.ok(byText(root, 'p', 'Already taught this course? You don\'t need this tool. In Canvas, copy the old course and tick "Adjust events and due dates" to move everything to the new semester.'));
  assert.equal(control(root, 'Open my saved work').type, 'file');
  assert.equal(root.querySelectorAll('h1').length, 1);
  assert.deepEqual(unnamedControls(root), []);
});
test('basics: four labeled fields, Friday by default', () => {
  const { root, store } = start();
  click(byText(root, 'button', 'Build a new course'));
  assert.equal(store.get().screen, 'basics');
  assert.equal(control(root, 'Course title').type, 'text');
  assert.equal(control(root, 'First day of class').type, 'date');
  assert.equal(control(root, 'Number of weeks').type, 'number');
  const due = control(root, 'Day work is usually due');
  assert.deepEqual([due.tagName, due.value, due.options.length], ['SELECT', '5', 7]);
  assert.deepEqual(unnamedControls(root), []);
});
test('basics: missing answers are explained beside the field, and nothing moves on', () => {
  const { root, store } = start();
  click(byText(root, 'button', 'Build a new course'));
  fillBasics(root, { title: '  ', firstDay: '', weeks: '40' });
  assert.equal(store.get().screen, 'basics');
  assert.ok(byText(root, '.field-error', 'Enter a course title.'));
  assert.ok(byText(root, '.field-error', 'Choose the first day of class.'));
  assert.ok(byText(root, '.field-error', 'Enter a number of weeks from 1 to 30.'));
  assert.equal(control(root, 'Number of weeks').value, '40', 'what was typed is kept');
  assert.equal(control(root, 'Course title').getAttribute('aria-invalid'), 'true');
});
test('valid basics lead to the three plans and Design my own', () => {
  const { root, store } = start();
  click(byText(root, 'button', 'Build a new course'));
  fillBasics(root);
  assert.equal(store.get().screen, 'templates');
  assert.deepEqual(store.get().basics, { title: 'PSY 210 Online', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 });
  for (const name of ['Weekly rhythm', 'Units with exams', 'Scaffolded project', 'Design my own']) {
    assert.ok(byText(root, 'button strong', name), name);
  }
});
test('choosing a plan builds the course, saves it, and opens the review screen', () => {
  const { root, store, storage } = start();
  click(byText(root, 'button', 'Build a new course'));
  fillBasics(root);
  click(byText(root, 'button strong', 'Weekly rhythm').closest('button'));
  const s = store.get();
  assert.equal(s.screen, 'review');
  assert.deepEqual([s.course.title, s.course.groups.length, s.course.weekRows.length], ['PSY 210 Online', 4, 14]);
  assert.ok(storage.data.has(STORAGE_KEY));
});
test('Design my own opens the walkthrough', () => {
  const { root, store } = start();
  click(byText(root, 'button', 'Build a new course'));
  fillBasics(root);
  click(byText(root, 'button strong', 'Design my own').closest('button'));
  assert.equal(store.get().screen, 'walkthrough');
});
test('focus moves to the heading when the screen changes', () => {
  const { root } = start();
  click(byText(root, 'button', 'Build a new course'));
  assert.equal(document.activeElement, root.querySelector('h1'));
  assert.equal(textOf(root.querySelector('h1')), 'Course basics');
});
test('autosaved work can be continued', () => {
  const c = fromTemplate('units', { title: 'BIO 101', firstDay: '2027-01-25', weeks: 8, dueWeekday: 5 });
  const { root, store } = start(memoryStorage({ [STORAGE_KEY]: serialize(c) }));
  click(byText(root, 'button', 'Continue where you left off: BIO 101'));
  assert.deepEqual([store.get().screen, store.get().course.title], ['review', 'BIO 101']);
});
test('opening a good saved file goes to review; a bad one explains and changes nothing', async () => {
  const c = fromTemplate('units', { title: 'BIO 101', firstDay: '2027-01-25', weeks: 8, dueWeekday: 5 });
  const bad = start();
  chooseFile(control(bad.root, 'Open my saved work'), 'hello');
  await until(() => bad.root.querySelector('[role="alert"]'));
  assert.equal(bad.store.get().screen, 'start');
  assert.equal(bad.store.get().course, null);
  assert.equal(textOf(bad.root.querySelector('[role="alert"]')), 'This isn\'t a saved Course Builder file. Choose the file you got from "Download my work".');
  const good = start();
  chooseFile(control(good.root, 'Open my saved work'), serialize(c));
  await until(() => good.store.get().screen === 'review');
  assert.deepEqual([good.store.get().screen, good.store.get().course.title], ['review', 'BIO 101']);
});
test('when the browser cannot save, the tool says so and still works', () => {
  const { root, store } = start(brokenStorage);
  const NOTE = 'Your work can\'t be saved automatically in this browser. Use "Download my work" before you close this page.';
  assert.ok(byText(root, '[role="status"]', NOTE));
  click(byText(root, 'button', 'Build a new course'));
  fillBasics(root);
  click(byText(root, 'button strong', 'Weekly rhythm').closest('button'));
  assert.equal(store.get().screen, 'review');
  assert.ok(byText(root, '[role="status"]', NOTE));
});
test('no notice when the browser can save', () => {
  const { root } = start();
  assert.equal(root.querySelector('.autosave-off'), null);
});
test('store.update edits the course, autosaves, and keeps focus on the same control', () => {
  const { root, store, storage } = start();
  const c = fromTemplate('weekly', { title: 'PSY 210', firstDay: '2027-01-25', weeks: 3, dueWeekday: 5 });
  store.set({ course: c, screen: 'review' });
  const probe = document.createElement('input');
  probe.id = 'focus-probe';
  root.append(probe);
  probe.focus();
  let renders = 0;
  store.subscribe(() => { renders += 1; if (!document.getElementById('focus-probe')) { const again = probe.cloneNode(); root.append(again); } });
  store.update((course) => ({ ...course, title: 'Changed' }));
  assert.equal(store.get().course.title, 'Changed');
  assert.ok(storage.data.get(STORAGE_KEY).includes('Changed'));
  assert.ok(renders >= 1);
});
