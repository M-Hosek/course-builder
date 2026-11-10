import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAnswers, suggestGroups, fromAnswers } from '../src/walkthrough.js';
import { buildCartridge } from '../src/export/index.js';

const basics = { title: 'HIST 228', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 };
const byName = (groups) => Object.fromEntries(groups.map((g) => [g.name, g.weight]));
const items = (rows) => rows.filter((r) => r.kind !== 'class');
const weeksWith = (c, title) => c.weekRows.map((rows, i) => (rows.some((r) => r.title === title) ? i + 1 : 0)).filter(Boolean);
const withGroups = (a) => ({ ...a, groups: suggestGroups(a) });
const groupName = (c, row) => c.groups.find((g) => g.id === row.groupId)?.name;

test('default answers', () => {
  const a = defaultAnswers();
  assert.deepEqual(a.weekly, { assignment: true, discussion: true, quiz: false });
  assert.deepEqual([a.exams, a.project, a.grading], ['midterm-final', false, 'weighted']);
  assert.deepEqual(a.submissionTypes, ['online_upload', 'online_text_entry']);
  assert.deepEqual(a.homePage, { welcome: true, syllabus: true, communication: true, startHere: true });
  assert.deepEqual(byName(a.groups), byName(suggestGroups(a)));
});
test('suggested groups share 90% and leave 10% for participation', () => {
  assert.deepEqual(byName(suggestGroups(defaultAnswers())), { Assignments: 30, Discussions: 30, Exams: 30, Participation: 10 });
});
test('a remainder goes to the first group', () => {
  const a = { ...defaultAnswers(), weekly: { assignment: true, discussion: true, quiz: true }, project: true };
  const g = suggestGroups(a);
  assert.deepEqual(g.map((x) => x.name), ['Assignments', 'Discussions', 'Quizzes', 'Exams', 'Project', 'Participation']);
  assert.deepEqual(g.map((x) => x.weight), [18, 18, 18, 18, 18, 10]);
  const four = suggestGroups({ ...a, project: false });
  assert.deepEqual(four.map((x) => x.weight), [24, 22, 22, 22, 10]);
  assert.equal(four.reduce((s, x) => s + x.weight, 0), 100);
});
test('nothing chosen leaves participation at 100%', () => {
  const a = { ...defaultAnswers(), weekly: { assignment: false, discussion: false, quiz: false }, exams: 'none' };
  assert.deepEqual(byName(suggestGroups(a)), { Participation: 100 });
});
test('the default answers build a weekly course with a midterm and a final', async () => {
  const c = fromAnswers(basics, defaultAnswers());
  assert.deepEqual(items(c.weekRows[0]).map((r) => [r.kind, r.title, r.points, groupName(c, r)]),
    [['assignment', 'Week 1 assignment', 10, 'Assignments'], ['discussion', 'Week 1 discussion', 10, 'Discussions']]);
  assert.equal(items(c.weekRows[0])[0].due, '2027-01-29');
  assert.deepEqual(weeksWith(c, 'Midterm exam'), [7]);
  assert.deepEqual(weeksWith(c, 'Final exam'), [14]);
  assert.equal(groupName(c, c.weekRows[6].at(-1)), 'Exams');
  assert.equal('points' in c.weekRows[6].at(-1), false);
  const intro = c.startHere.find((r) => r.title === 'Introduce yourself');
  assert.deepEqual([intro.points, groupName(c, intro)], [5, 'Participation']);
  assert.deepEqual([c.title, c.weeks, c.grading], ['HIST 228', 14, 'weighted']);
  assert.ok((await buildCartridge(c)).length > 1000);
});
test('the other exam choices', () => {
  const only = (exams) => fromAnswers(basics, withGroups({ ...defaultAnswers(), exams }));
  assert.deepEqual(weeksWith(only('final'), 'Final exam'), [14]);
  assert.deepEqual(weeksWith(only('final'), 'Midterm exam'), []);
  assert.deepEqual(only('every-4').weekRows.flat().filter((r) => /^Unit exam/.test(r.title)).map((r) => r.title),
    ['Unit exam 1', 'Unit exam 2', 'Unit exam 3', 'Unit exam 4']);
  assert.equal(only('none').weekRows.flat().some((r) => r.kind === 'quiz'), false);
});
test('weekly quizzes and a final project', () => {
  const a = withGroups({ ...defaultAnswers(), weekly: { assignment: false, discussion: false, quiz: true }, exams: 'none', project: true });
  const c = fromAnswers(basics, a);
  assert.deepEqual(items(c.weekRows[2]).map((r) => [r.kind, r.title, groupName(c, r)]), [['quiz', 'Week 3 quiz', 'Quizzes']]);
  const final = c.weekRows[13].at(-1);
  assert.deepEqual([final.kind, final.title, final.points, groupName(c, final)], ['assignment', 'Final project', 100, 'Project']);
});
test('submission types, grading choice and home page are carried over', () => {
  const home = { welcome: true, syllabus: false, communication: false, startHere: true };
  const c = fromAnswers(basics, { ...defaultAnswers(), submissionTypes: ['media_recording'], grading: 'other', homePage: home });
  assert.deepEqual(items(c.weekRows[0])[0].submissionTypes, ['media_recording']);
  assert.equal(c.grading, 'other');
  assert.deepEqual(c.homePage, home);
});
test('items whose group was renamed away get no group and still build', async () => {
  const a = defaultAnswers();
  a.groups = a.groups.filter((g) => g.name !== 'Exams');
  const c = fromAnswers(basics, a);
  assert.equal('groupId' in c.weekRows[6].at(-1), false);
  assert.ok((await buildCartridge(c)).length > 1000);
});
test('answers are not changed by building', () => {
  const a = defaultAnswers();
  const before = JSON.stringify(a);
  fromAnswers(basics, a);
  assert.equal(JSON.stringify(a), before);
});
