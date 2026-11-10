import { h } from './h.js';
import { createStore } from './store.js';
import { renderStart } from './screens/start.js';
import { renderBasics } from './screens/basics.js';
import { renderTemplates } from './screens/templates.js';
import { renderWalkthrough } from './screens/walkthrough.js';
import { renderReview } from './screens/review.js';
import { renderDownload } from './screens/download.js';
import './wire.js';

const SCREENS = { start: renderStart, basics: renderBasics, templates: renderTemplates, walkthrough: renderWalkthrough, review: renderReview, download: renderDownload };
export const AUTOSAVE_OFF = 'Your work can\'t be saved automatically in this browser. Use "Download my work" before you close this page.';

/**
 * Show the app inside `root` and keep it up to date.
 * After every change the whole screen is drawn again, so focus is put back by hand:
 * on the heading when the screen (or walkthrough step) changes, on a dialog's default button when a
 * question appears, and otherwise on the control with the same id as before.
 */
export function mount(root, storage) {
  const store = createStore(storage);
  let lastPlace = null;
  let lastDialog = null;

  const render = () => {
    const state = store.get();
    const active = document.activeElement;
    const keep = active && active !== document.body && active.id
      ? { id: active.id, start: safe(() => active.selectionStart), end: safe(() => active.selectionEnd) } : null;

    root.replaceChildren(h('div', { class: `app screen-${state.screen}` },
      !state.autosaveOn && h('p', { class: 'notice autosave-off', role: 'status' }, AUTOSAVE_OFF),
      SCREENS[state.screen](state, store)));

    const place = `${state.screen}/${state.screen === 'walkthrough' ? state.step : ''}`;
    const dialog = state.dialog ? JSON.stringify(state.dialog) : null;
    if (place !== lastPlace) {
      root.querySelector('h1')?.focus();
    } else if (dialog && dialog !== lastDialog) {
      root.querySelector('[data-autofocus]')?.focus();
    } else if (keep) {
      const el = document.getElementById(keep.id);
      if (el) {
        el.focus();
        if (keep.start !== null && keep.start !== undefined) safe(() => el.setSelectionRange(keep.start, keep.end));
      }
    }
    lastPlace = place;
    lastDialog = dialog;
  };

  store.subscribe(render);
  render();
  return store;
}

function safe(fn) {
  try { return fn(); } catch { return null; }
}

// In the browser, start as soon as the page is ready. Tests call mount() themselves.
if (typeof window !== 'undefined' && document.getElementById('app') && !window.__COURSE_BUILDER_TEST__) {
  let storage;
  try { storage = window.localStorage; } catch { storage = undefined; }
  window.courseBuilder = mount(document.getElementById('app'), storage);
}
