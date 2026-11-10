import test from 'node:test';
import assert from 'node:assert/strict';
import { fromTemplate } from '../src/templates.js';
import { STORAGE_KEY, serialize, parseSaved, autosave, loadAutosave, clearAutosave, workFileName } from '../src/save.js';

const course = () => fromTemplate('weekly', { title: 'PSY 210 Online', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 });
const NOT_OURS = 'This isn\'t a saved Course Builder file. Choose the file you got from "Download my work".';
const NEWER = 'This file was saved by a newer version of the Course Builder. Reload this page to get the latest version, then try again.';
const DAMAGED = 'This saved file is damaged and can\'t be opened.';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
}
const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('blocked'); } };

test('saved work opens again exactly as it was', () => {
  const c = course();
  const text = serialize(c);
  const saved = JSON.parse(text);
  assert.deepEqual([saved.app, saved.version, typeof saved.savedAt], ['hws-course-builder', 1, 'string']);
  assert.deepEqual(parseSaved(text), { ok: true, course: c });
});
test('a file that is not ours is refused in plain words', () => {
  for (const text of ['hello', '', '{"a":1}', '[1,2]', 'null', '{"app":"something-else","version":1,"course":{}}']) {
    assert.deepEqual(parseSaved(text), { ok: false, message: NOT_OURS }, JSON.stringify(text));
  }
});
test('a file from a newer version says to reload', () => {
  const newer = JSON.stringify({ ...JSON.parse(serialize(course())), version: 2 });
  assert.deepEqual(parseSaved(newer), { ok: false, message: NEWER });
});
test('a damaged file of ours is refused', () => {
  const saved = JSON.parse(serialize(course()));
  for (const key of ['title', 'firstDay', 'weeks', 'weekRows']) {
    const c = { ...saved.course };
    delete c[key];
    assert.deepEqual(parseSaved(JSON.stringify({ ...saved, course: c })), { ok: false, message: DAMAGED }, key);
  }
  assert.deepEqual(parseSaved(JSON.stringify({ ...saved, course: { ...saved.course, weekRows: 'x' } })), { ok: false, message: DAMAGED });
  assert.deepEqual(parseSaved(JSON.stringify({ ...saved, course: null })), { ok: false, message: DAMAGED });
});
test('autosave works with working storage', () => {
  const s = memoryStorage();
  const c = course();
  assert.equal(loadAutosave(s), null);
  assert.equal(autosave(c, s), true);
  assert.ok(s.data.has(STORAGE_KEY));
  assert.equal(STORAGE_KEY, 'hws-course-builder:v1');
  assert.deepEqual(loadAutosave(s), c);
  clearAutosave(s);
  assert.equal(loadAutosave(s), null);
});
test('blocked or full storage never throws', () => {
  assert.equal(autosave(course(), broken), false);
  assert.equal(loadAutosave(broken), null);
  assert.doesNotThrow(() => clearAutosave(broken));
  assert.equal(autosave(course(), undefined), false);
  assert.equal(loadAutosave(undefined), null);
});
test('garbage in storage is ignored', () => {
  const s = memoryStorage();
  s.setItem(STORAGE_KEY, 'not json');
  assert.equal(loadAutosave(s), null);
});
test('work file names', () => {
  assert.equal(workFileName('PSY 210 Online'), 'psy-210-online.coursebuilder.json');
  assert.equal(workFileName(''), 'my-course.coursebuilder.json');
});
