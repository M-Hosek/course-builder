import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { memoryStorage, freshRoot, byText, control, click, change, textOf, until, unnamedControls } from './ui-helpers.js';
import { mount } from '../src/ui/app.js';
import { io } from '../src/ui/io.js';
import { fromTemplate } from '../src/templates.js';
import { parseSaved } from '../src/save.js';

const basics = { title: 'PSY 210 Online', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
function open() {
  const root = freshRoot();
  const store = mount(root, memoryStorage());
  store.set({ course: fromTemplate('weekly', basics), screen: 'review' });
  const downloads = [];
  io.download = (content, name, mime) => downloads.push({ content, name, mime });
  return { root, store, downloads, course: () => store.get().course, side: () => root.querySelector('aside.side') };
}
const named = (root, name) => [...root.querySelectorAll('[aria-label]')].find((el) => el.getAttribute('aria-label') === name);
const rowOf = (root, title) => [...root.querySelectorAll('tr.item-row')].find((tr) => tr.querySelector('input[type="text"]')?.value === title);

test('the grading panel lists the groups with a running total', () => {
  const { root, side } = open();
  assert.equal(textOf(side().querySelector('h2')), 'How will this course be graded?');
  assert.equal(control(root, 'Weighted grade groups').checked, true);
  assert.equal(named(root, 'Weight % for Discussions').value, '25');
  assert.equal(textOf(side().querySelector('.total')), 'Total: 100%');
  assert.equal(side().querySelector('.weights-warning'), null);
  assert.equal(textOf(side().querySelector('.count-Discussions')), '14');
  assert.deepEqual(unnamedControls(root), []);
});
test('changing a weight updates the total and the warning', () => {
  const { root, side, course } = open();
  change(named(root, 'Weight % for Participation'), '5');
  assert.equal(course().groups[3].weight, 5);
  assert.equal(textOf(side().querySelector('.total')), 'Total: 95%');
  const warning = side().querySelector('.weights-warning');
  assert.equal(textOf(warning), 'Grade weights add up to 95%, not 100%.');
  assert.equal(warning.closest('[role="status"]') !== null, true);
  change(named(root, 'Weight % for Participation'), '10');
  assert.equal(side().querySelector('.weights-warning'), null);
});
test('drop lowest and group names can be edited', () => {
  const { root, course } = open();
  change(named(root, 'Drop lowest for Discussions'), '1');
  assert.equal(course().groups[0].dropLowest, 1);
  change(named(root, 'Name of group Discussions'), 'Talk');
  assert.equal(course().groups[0].name, 'Talk');
  assert.ok(named(root, 'Weight % for Talk'));
});
test('Other grading hides the weights and says none are sent', () => {
  const { root, side, course } = open();
  change(control(root, 'Other — I\'ll set up my own grading in Canvas (for example, standards-based or contract grading).'), true);
  assert.equal(course().grading, 'other');
  assert.equal(named(root, 'Weight % for Discussions'), undefined);
  assert.equal(named(root, 'Drop lowest for Discussions'), undefined);
  assert.ok(byText(side(), 'p', 'Groups still organize your items. No weights are sent to Canvas.'));
  assert.equal(side().querySelector('.total'), null);
  assert.equal(root.querySelector('#extra-mode'), null);
});
test('adding and removing groups', () => {
  const { root, side, course } = open();
  click(byText(side(), 'button', 'Add a group'));
  assert.equal(course().groups.at(-1).name, 'New group');
  click(named(root, 'Remove group Exams'));
  assert.equal(course().groups.some((g) => g.name === 'Exams'), false);
  assert.equal(rowOf(root, 'Midterm exam').querySelector('select.group').value, '');
});
test('extra credit: one approach at a time', () => {
  const { root, course } = open();
  const mode = control(root, 'Extra credit');
  assert.deepEqual([...mode.options].map((o) => o.textContent), ['No extra credit', 'Separate extra-credit assignment', 'Bonus points inside a group']);
  change(mode, 'separate');
  change(control(root, 'Name'), 'Museum visit');
  change(control(root, 'Worth up to (+%)'), '3');
  change(control(root, 'Week'), '10');
  assert.deepEqual(course().extraCredit, { mode: 'separate', name: 'Museum visit', percent: 3, week: 10 });
  change(control(root, 'Extra credit'), 'bonus');
  const exams = course().groups.find((g) => g.name === 'Exams');
  change(control(root, 'Group'), exams.id);
  change(control(root, 'Name of the bonus item'), 'Exam bonus');
  assert.deepEqual(course().extraCredit, { mode: 'bonus', name: 'Exam bonus', groupId: exams.id });
  change(control(root, 'Extra credit'), 'none');
  assert.deepEqual(course().extraCredit, { mode: 'none' });
});
test('home page checklist', () => {
  const { root, course } = open();
  for (const label of ['Welcome message', 'Syllabus link', 'Communication preferences', 'Link to Start Here']) assert.equal(control(root, label).checked, true, label);
  change(control(root, 'Syllabus link'), false);
  assert.equal(course().homePage.syllabus, false);
});
test('submission types: more than one allowed, and annotation shows its note', () => {
  const { root, course } = open();
  assert.equal(named(root, 'File upload for Reading response 1').checked, true);
  assert.equal(named(root, 'Annotation for Reading response 1').checked, false);
  assert.equal(named(root, 'File upload for Week 1 discussion'), undefined, 'assignments only');
  change(named(root, 'Annotation for Reading response 1'), true);
  assert.deepEqual(course().weekRows[0][2].submissionTypes, ['online_upload', 'online_text_entry', 'student_annotation']);
  const note = root.querySelector('#week-1 .annotation-note');
  assert.ok(textOf(note).includes('Attach your document in Canvas before students see this.'));
  assert.equal(note.getAttribute('role'), 'status');
  assert.equal(textOf(rowOf(root, 'Reading response 1').querySelector('.type')), 'Assignment · file upload, text entry, annotation');
  change(named(root, 'File upload for Reading response 1'), false);
  assert.deepEqual(course().weekRows[0][2].submissionTypes, ['online_text_entry', 'student_annotation']);
});
test('Download my work saves a file that opens again', () => {
  const { root, downloads, course } = open();
  click(byText(root, 'button', 'Download my work'));
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'psy-210-online.coursebuilder.json');
  assert.deepEqual(parseSaved(downloads[0].content), { ok: true, course: course() });
});
test('Download for Canvas with nothing to check goes straight to the file and the instructions', async () => {
  const { root, downloads, store } = open();
  click(byText(root, 'button', 'Download for Canvas'));
  await until(() => downloads.length === 1);
  assert.equal(downloads[0].name, 'psy-210-online.imscc');
  const zip = await JSZip.loadAsync(downloads[0].content);
  assert.ok(zip.file('imsmanifest.xml'));
  assert.equal(store.get().screen, 'download');
  assert.ok(byText(root, 'p', 'Import this file once, into a new, empty Canvas course. Importing it twice makes duplicate quizzes, and importing it into a course that already has content can change that course\'s grading setup.'));
  assert.equal(root.querySelectorAll('ol.steps li').length, 4);
  assert.ok(textOf(root.querySelector('ol.steps')).includes('Common Cartridge 1.x Package'));
  assert.ok(textOf(root.querySelector('ol.steps')).includes('arrive unpublished, except Start Here and the home page'));
  click(byText(root, 'button', 'Download again'));
  await until(() => downloads.length === 2);
  click(byText(root, 'button', 'Back to my course'));
  assert.equal(store.get().screen, 'review');
});
test('Download for Canvas asks first when something still needs checking', async () => {
  const { root, downloads, store } = open();
  change(named(root, 'Weight % for Participation'), '5');
  change(rowOf(root, 'Reading response 1').querySelector('input[type="date"]'), '2027-06-01');
  click(byText(root, 'button', 'Download for Canvas'));
  const q = root.querySelector('.dialog[role="alertdialog"]');
  assert.ok(textOf(q).startsWith('There are still 2 things to check. Download anyway?'));
  assert.deepEqual([...q.querySelectorAll('li')].map(textOf), ['Grade weights add up to 95%, not 100%.', 'Reading response 1: This due date is outside the course dates.']);
  assert.equal(document.activeElement, byText(q, 'button', 'Go back'));
  click(byText(q, 'button', 'Go back'));
  assert.deepEqual([downloads.length, store.get().screen, root.querySelector('.dialog')], [0, 'review', null]);
  click(byText(root, 'button', 'Download for Canvas'));
  click(byText(root.querySelector('.dialog'), 'button', 'Download anyway'));
  await until(() => downloads.length === 1);
  assert.equal(store.get().screen, 'download');
});
test('break reminders alone do not hold up a download', async () => {
  const { root, downloads } = open();
  assert.ok(root.querySelector('#week-8 .warn'));
  click(byText(root, 'button', 'Download for Canvas'));
  await until(() => downloads.length === 1);
  assert.equal(downloads.length, 1);
});
