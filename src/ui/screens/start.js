import { h } from '../h.js';
import { parseSaved } from '../../save.js';

/** Read a chosen file as text, in any browser. */
function readText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function renderStart(state, store) {
  const openSaved = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    let result;
    try { result = parseSaved(await readText(file)); } catch { result = parseSaved(''); }
    if (result.ok) store.set({ course: result.course, screen: 'review', notice: '' });
    else store.set({ notice: result.message }); // whatever was already open stays as it was
  };

  return h('main', { class: 'start' },
    h('h1', { tabindex: '-1' }, 'HWS Online Course Builder'),
    h('p', { class: 'tagline' }, 'A user-friendly tool to quickly set up your Canvas course'),
    h('div', { class: 'door' },
      h('button', { type: 'button', class: 'primary big', id: 'start-build', onclick: () => store.set({ screen: 'basics', notice: '' }) }, 'Build a new course'),
      h('p', null, 'Start from a ready-made plan or design your own week by week.')),
    state.saved && h('p', null,
      h('button', { type: 'button', id: 'start-continue', onclick: () => store.set({ course: state.saved, screen: 'review', notice: '' }) },
        `Continue where you left off: ${state.saved.title}`)),
    h('p', { class: 'aside-note' }, 'Already taught this course? You don\'t need this tool. In Canvas, copy the old course and tick "Adjust events and due dates" to move everything to the new semester.'),
    h('div', { class: 'open-saved' },
      h('label', { for: 'open-saved-file' }, 'Open my saved work'),
      h('input', { type: 'file', id: 'open-saved-file', accept: '.json,application/json', onchange: openSaved })),
    state.notice && h('p', { class: 'alert', role: 'alert' }, state.notice));
}
