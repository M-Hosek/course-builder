import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, fromTemplate } from '../src/templates.js';
import { dueDateFor } from '../src/dates.js';
import { buildCartridge } from '../src/export/index.js';

const basics = (weeks = 14) => ({ title: 'PSY 210', firstDay: '2027-01-25', weeks, dueWeekday: 5 });
const items = (rows) => rows.filter((r) => r.kind !== 'class');
const weeksWith = (c, test_) => c.weekRows.map((rows, i) => (rows.some(test_) ? i + 1 : 0)).filter(Boolean);
const groupName = (c, row) => c.groups.find((g) => g.id === row.groupId)?.name;
const groups = (c) => c.groups.map((g) => [g.name, g.weight, g.dropLowest]);

test('three templates, each with a name and a blurb', () => {
  assert.deepEqual(TEMPLATES.map((t) => t.id), ['weekly', 'units', 'project']);
  assert.deepEqual(TEMPLATES.map((t) => t.name), ['Weekly rhythm', 'Units with exams', 'Scaffolded project']);
  assert.ok(TEMPLATES.every((t) => t.blurb.length > 20));
});
test('weekly rhythm', () => {
  const c = fromTemplate('weekly', basics());
  assert.deepEqual(groups(c), [['Discussions', 25, 0], ['Weekly work', 30, 0], ['Exams', 35, 0], ['Participation', 10, 0]]);
  assert.deepEqual(c.weekRows[0].map((r) => r.kind), ['class', 'discussion', 'assignment']);
  assert.deepEqual(items(c.weekRows[0]).map((r) => [r.title, r.points, groupName(c, r)]),
    [['Week 1 discussion', 10, 'Discussions'], ['Reading response 1', 10, 'Weekly work']]);
  assert.deepEqual(items(c.weekRows[0])[1].submissionTypes, ['online_upload', 'online_text_entry']);
  assert.deepEqual(weeksWith(c, (r) => r.title === 'Midterm exam'), [7]);
  assert.deepEqual(weeksWith(c, (r) => r.title === 'Final exam'), [14]);
  assert.deepEqual(items(c.weekRows[13]).map((r) => r.title), ['Week 14 discussion', 'Reading response 14', 'Final exam']);
  assert.equal(groupName(c, items(c.weekRows[6]).at(-1)), 'Exams');
});
test('units with exams', () => {
  const c = fromTemplate('units', basics());
  assert.deepEqual(groups(c), [['Practice quizzes', 20, 0], ['Unit exams', 70, 0], ['Participation', 10, 0]]);
  assert.deepEqual(items(c.weekRows[0]).map((r) => [r.kind, r.title, groupName(c, r)]), [['quiz', 'Practice quiz 1', 'Practice quizzes']]);
  assert.deepEqual(weeksWith(c, (r) => /^Unit exam/.test(r.title)), [4, 8, 12, 14]);
  assert.deepEqual(c.weekRows.flat().filter((r) => /^Unit exam/.test(r.title)).map((r) => r.title), ['Unit exam 1', 'Unit exam 2', 'Unit exam 3', 'Unit exam 4']);
  assert.deepEqual(weeksWith(fromTemplate('units', basics(12)), (r) => /^Unit exam/.test(r.title)), [4, 8, 12]);
});
test('scaffolded project', () => {
  const c = fromTemplate('project', basics());
  assert.deepEqual(groups(c), [['Milestones', 40, 0], ['Final project', 35, 0], ['Discussions', 15, 0], ['Participation', 10, 0]]);
  assert.deepEqual(items(c.weekRows[0]).map((r) => [r.title, r.points, groupName(c, r)]),
    [['Week 1 discussion', 10, 'Discussions'], ['Milestone 1', 20, 'Milestones']]);
  const final = items(c.weekRows[13]).at(-1);
  assert.deepEqual([final.kind, final.title, final.points, groupName(c, final)], ['assignment', 'Final project', 100, 'Final project']);
  assert.deepEqual(weeksWith(c, (r) => r.title === 'Final project'), [14]);
});
for (const { id } of TEMPLATES) {
  test(`${id}: shared rules`, async () => {
    const c = fromTemplate(id, basics());
    assert.deepEqual([c.grading, c.extraCredit.mode, c.title, c.weeks], ['weighted', 'none', 'PSY 210', 14]);
    assert.equal(c.groups.reduce((s, g) => s + g.weight, 0), 100);
    c.weekRows.forEach((rows, i) => {
      for (const r of items(rows)) assert.equal(r.due, dueDateFor('2027-01-25', i + 1, 5), `${r.title} is due on its week's due day`);
    });
    assert.ok(c.weekRows.flat().filter((r) => r.kind === 'quiz').every((r) => !('points' in r)));
    const intro = c.startHere.find((r) => r.title === 'Introduce yourself');
    assert.deepEqual([intro.points, groupName(c, intro), intro.due], [5, 'Participation', '2027-01-29']);
    const ids = [...c.startHere, ...c.weekRows.flat()].map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok((await buildCartridge(c)).length > 1000);
    assert.ok((await buildCartridge(fromTemplate(id, basics(1)))).length > 1000);
  });
}
test('an unknown template is refused', () => {
  assert.throws(() => fromTemplate('nope', basics()));
});
