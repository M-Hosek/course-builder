import { slug } from './xml.js';
import { isDate } from './dates.js';
import { MAX_WEEKS } from './model.js';

export const STORAGE_KEY = 'hws-course-builder:v1';
const APP = 'hws-course-builder';
const VERSION = 1;

const NOT_OURS = 'This isn\'t a saved Course Builder file. Choose the file you got from "Download my work".';
const NEWER = 'This file was saved by a newer version of the Course Builder. Reload this page to get the latest version, then try again.';
const DAMAGED = 'This saved file is damaged and can\'t be opened.';

/** The text of a "Download my work" file. */
export function serialize(course) {
  return JSON.stringify({ app: APP, version: VERSION, savedAt: new Date().toISOString(), course }, null, 2);
}

const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isText = (x) => typeof x === 'string';
const ITEM_KINDS = ['assignment', 'discussion', 'quiz', 'page'];

/** Parts a file may leave out, and what they are then. */
const DEFAULTS = {
  dueWeekday: () => 5,
  dueTime: () => '23:59',
  format: () => 'async',
  meets: () => [],
  grading: () => 'weighted',
  extraCredit: () => ({ mode: 'none' }),
  homePage: () => ({ welcome: true, syllabus: true, communication: true, startHere: true }),
  dismissedReminders: () => [],
};

function rowIsSound(r) {
  if (!isObject(r) || !isText(r.id) || !r.id) return false;
  if (r.kind === 'class') {
    r.theme ??= '';
    r.readings ??= [];
    return (r.date === null || isDate(r.date)) && isText(r.theme) && Array.isArray(r.readings) && r.readings.every(isText)
      && (r.noClass === undefined || isObject(r.noClass));
  }
  return ITEM_KINDS.includes(r.kind) && isText(r.title) && (r.due === undefined || isDate(r.due))
    && (r.groupId === undefined || isText(r.groupId))
    && (r.submissionTypes === undefined || (Array.isArray(r.submissionTypes) && r.submissionTypes.every(isText)));
}

/**
 * Check every part of a saved course the rest of the app relies on, filling in parts that may be
 * left out. False means the file can't be trusted, and none of it is used.
 */
function makeWhole(c) {
  if (!isObject(c)) return false;
  for (const [key, make] of Object.entries(DEFAULTS)) c[key] ??= make();
  return isText(c.title) && isDate(c.firstDay)
    && Number.isInteger(c.weeks) && c.weeks >= 1 && c.weeks <= MAX_WEEKS
    && Array.isArray(c.weekRows) && c.weekRows.length === c.weeks
    && c.weekRows.every((rows) => Array.isArray(rows) && rows.every(rowIsSound))
    && Array.isArray(c.startHere) && c.startHere.every((r) => rowIsSound(r) && r.kind !== 'class')
    && Array.isArray(c.groups) && c.groups.every((g) => isObject(g) && isText(g.id) && isText(g.name))
    && Number.isInteger(c.dueWeekday) && c.dueWeekday >= 0 && c.dueWeekday <= 6
    && /^\d\d:\d\d$/.test(c.dueTime)
    && ['hybrid', 'async'].includes(c.format) && ['weighted', 'other'].includes(c.grading)
    && Array.isArray(c.meets) && c.meets.every((d) => Number.isInteger(d) && d >= 1 && d <= 5)
    && isObject(c.extraCredit) && ['none', 'separate', 'bonus'].includes(c.extraCredit.mode)
    && isObject(c.homePage)
    && Array.isArray(c.dismissedReminders) && c.dismissedReminders.every(Number.isInteger)
    && (c.parked === undefined || (Array.isArray(c.parked)
      && c.parked.every((p) => isObject(p) && Number.isInteger(p.week) && rowIsSound(p.row) && p.row.kind === 'class')));
}

/**
 * Read a saved-work file. Never throws: anything that isn't a usable file of ours comes back as a
 * plain-language message, and the caller keeps whatever is already on screen.
 * @returns {{ok: true, course: import('./model.js').Course} | {ok: false, message: string}}
 */
export function parseSaved(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, message: NOT_OURS }; }
  if (!data || typeof data !== 'object' || data.app !== APP) return { ok: false, message: NOT_OURS };
  if (Number(data.version) > VERSION) return { ok: false, message: NEWER };
  if (!makeWhole(data.course)) return { ok: false, message: DAMAGED };
  return { ok: true, course: data.course };
}

/** Save to the browser. Returns false when storage is blocked or full; never throws. */
export function autosave(course, storage) {
  try {
    storage.setItem(STORAGE_KEY, serialize(course));
    return true;
  } catch {
    return false;
  }
}

/** The autosaved course, or null when there is none or it can't be read; never throws. */
export function loadAutosave(storage) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    const result = parseSaved(text);
    return result.ok ? result.course : null;
  } catch {
    return null;
  }
}

export function clearAutosave(storage) {
  try { storage.removeItem(STORAGE_KEY); } catch { /* nothing to clear */ }
}

/** 'PSY 210 Online' → 'psy-210-online.coursebuilder.json' */
export function workFileName(title) {
  const stem = String(title ?? '').trim() ? slug(title) : 'my-course';
  return `${stem === 'item' ? 'my-course' : stem}.coursebuilder.json`;
}
