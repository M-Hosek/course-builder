import { h } from '../h.js';
import { io } from '../io.js';
import { buildCartridge, fileNameFor } from '../../export/index.js';
import { serialize, workFileName } from '../../save.js';

export const DOWNLOAD_COPY = 'Import this file once, into a new, empty Canvas course. Importing it twice makes duplicate quizzes, and importing it into a course that already has content can change that course\'s grading setup.';
const STEPS = [
  'In Canvas, create or open a new, empty course.',
  'Go to Settings → Import Course Content.',
  'Choose "Common Cartridge 1.x Package", pick the file you just downloaded, select All content, and click Import.',
  'Your modules and items arrive unpublished, except Start Here and the home page. Publish them when your content is ready.',
];

/** "Download my work": a file that "Open my saved work" can read later. */
export function saveWork(course) {
  io.download(serialize(course), workFileName(course.title), 'application/json');
}

/** Make the Canvas file and hand it to the browser. */
export async function downloadForCanvas(store, { thenShow = true } = {}) {
  const { course } = store.get();
  try {
    io.download(await buildCartridge(course), fileNameFor(course.title), 'application/zip');
    if (thenShow) store.set({ dialog: null, screen: 'download', notice: '' });
  } catch (error) {
    store.set({ dialog: null, notice: `The file could not be made: ${error.message}` });
  }
}

/** Things worth fixing before a download. Break reminders are not among them. */
export const toCheck = (warnings) => warnings.filter((w) => ['weights', 'due-outside', 'no-group'].includes(w.kind));

/** Download is always allowed; with unresolved warnings it asks once first. */
export function startDownload(store, warnings) {
  if (toCheck(warnings).length) store.set({ dialog: { type: 'download' } });
  else downloadForCanvas(store);
}

/** "There are still 2 things to check. Download anyway?" */
export function downloadQuestion(state, store, warnings) {
  if (state.dialog?.type !== 'download') return null;
  const list = toCheck(warnings);
  const titles = new Map([...state.course.startHere, ...state.course.weekRows.flat()].map((r) => [r.id, r.title]));
  const count = list.length === 1 ? 'There is still 1 thing to check.' : `There are still ${list.length} things to check.`;
  return h('div', { class: 'dialog', role: 'alertdialog', 'aria-labelledby': 'download-question' },
    h('p', { id: 'download-question' }, `${count} Download anyway?`),
    h('ul', null, list.map((w) => h('li', null, w.rowId ? `${titles.get(w.rowId)}: ${w.message}` : w.message))),
    h('p', { class: 'buttons' },
      h('button', { type: 'button', class: 'primary', id: 'download-back', 'data-autofocus': true, onclick: () => store.set({ dialog: null }) }, 'Go back'),
      h('button', { type: 'button', id: 'download-anyway', onclick: () => downloadForCanvas(store) }, 'Download anyway')));
}

export function renderDownload(state, store) {
  return h('main', { class: 'download' },
    h('h1', { tabindex: '-1' }, 'Your course file has been downloaded'),
    h('p', { class: 'notice' }, DOWNLOAD_COPY),
    h('h2', null, 'How to put it in Canvas'),
    h('ol', { class: 'steps' }, STEPS.map((s) => h('li', null, s))),
    state.notice && h('p', { class: 'alert', role: 'alert' }, state.notice),
    h('p', { class: 'buttons' },
      h('button', { type: 'button', id: 'download-again', onclick: () => downloadForCanvas(store, { thenShow: false }) }, 'Download again'),
      h('button', { type: 'button', class: 'primary', id: 'download-return', onclick: () => store.set({ screen: 'review' }) }, 'Back to my course')));
}
