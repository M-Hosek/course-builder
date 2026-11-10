import { slug } from './xml.js';

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

const looksWhole = (c) => c && typeof c === 'object'
  && typeof c.title === 'string' && typeof c.firstDay === 'string' && Number.isInteger(c.weeks)
  && Array.isArray(c.weekRows) && c.weekRows.every(Array.isArray)
  && Array.isArray(c.startHere) && Array.isArray(c.groups);

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
  if (!looksWhole(data.course)) return { ok: false, message: DAMAGED };
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
