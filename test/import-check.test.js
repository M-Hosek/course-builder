import test from 'node:test';
import assert from 'node:assert/strict';
import { importCheckCourse, CHECKLIST } from '../scripts/make-import-check.js';
import { warningsFor } from '../src/warnings.js';
import { buildCartridge } from '../src/export/index.js';
import { toExport } from '../src/export/outline.js';
import { parseXml } from '../src/xmlparse.js';
import { unzip, paths, text } from './helpers.js';

test('the import-check course exercises everything not yet proven in Canvas', () => {
  const c = importCheckCourse();
  assert.deepEqual([c.title, c.firstDay, c.weeks, c.dueWeekday, c.format, c.meets], ['Course Builder import check', '2027-01-25', 14, 5, 'hybrid', [2, 4]]);
  const tue = c.weekRows[0].find((r) => r.kind === 'class' && r.date === '2027-01-26');
  assert.deepEqual([tue.theme, tue.readings], ['What is psychology?', ['Myers Ch. 1', 'Milgram (1963)']]);
  const thu = c.weekRows[7].find((r) => r.kind === 'class' && r.date === '2027-03-18');
  assert.deepEqual(thu.noClass, { reason: 'Spring break' });
  assert.equal(c.groups.find((g) => g.name === 'Discussions').dropLowest, 1);
  const rr1 = c.weekRows[0].find((r) => r.title === 'Reading response 1');
  assert.deepEqual(rr1.submissionTypes, ['online_upload', 'online_text_entry', 'student_annotation', 'media_recording']);
  assert.deepEqual(c.extraCredit, { mode: 'separate', name: 'Extra credit: museum visit', percent: 3, week: 10 });
});
test('it has nothing that would hold up a download', () => {
  const kinds = warningsFor(importCheckCourse()).map((w) => w.kind);
  assert.equal(kinds.includes('weights'), false);
  assert.equal(kinds.includes('due-outside'), false);
});
test('what Canvas receives matches the checklist', () => {
  const e = toExport(importCheckCourse());
  const titles = (name) => e.modules.find((m) => m.name === name).items.map((i) => i.title);
  assert.deepEqual(titles('Start Here'), ['Welcome', 'Syllabus', 'Introduce yourself']);
  assert.equal(titles('Week 1 · Jan 25 – 31')[0], 'Tue Jan 26 — What is psychology? · Readings: Myers Ch. 1; Milgram (1963)');
  assert.ok(titles('Week 8 · Mar 15 – 21').includes('Thu Mar 18 — No class · Spring break'));
  assert.equal(titles('Week 10 · Mar 29 – Apr 4').at(-1), 'Extra credit: museum visit');
  assert.deepEqual(e.groups.map((g) => [g.name, g.weight, g.dropLowest]),
    [['Discussions', 25, 1], ['Weekly work', 30, 0], ['Exams', 35, 0], ['Participation', 10, 0], ['Extra credit', 3, 0]]);
  assert.ok(CHECKLIST.length >= 8);
});
test('it builds, and every file in it is valid', async () => {
  const zip = await unzip(await buildCartridge(importCheckCourse()));
  for (const p of paths(zip).filter((x) => x.endsWith('.xml') || x.endsWith('.qti'))) parseXml(await text(zip, p));
  assert.ok(paths(zip).includes('imsmanifest.xml'));
});
