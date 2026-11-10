import { autosave, loadAutosave } from '../save.js';

/** Can this browser keep our work? False in some private windows and on locked-down laptops. */
function storageWorks(storage) {
  try {
    storage.setItem('hws-course-builder:probe', '1');
    storage.removeItem('hws-course-builder:probe');
    return true;
  } catch {
    return false;
  }
}

/**
 * Holds everything the screens show. The Course is the only thing that is saved.
 *
 * State = { screen, basics, course, answers, autosaveOn, notice,
 *           saved      // autosaved course found when the page opened, offered on the start page
 *           dialog     // a question waiting for an answer, e.g. {type: 'weeks', weeks: 12}
 *           step, groupsEdited, basicsDraft, basicsErrors   // walkthrough and basics form details }
 */
export function createStore(storage) {
  let state = {
    screen: 'start', basics: null, course: null, answers: null,
    autosaveOn: storageWorks(storage), notice: '',
    saved: loadAutosave(storage), dialog: null, step: 1, groupsEdited: false, basicsDraft: null, basicsErrors: {},
  };
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(state));
  const save = () => { if (state.course) state = { ...state, autosaveOn: autosave(state.course, storage) }; };

  return {
    get: () => state,
    /** Change anything other than by editing the course: which screen, a dialog, a new course. */
    set(patch) {
      state = { ...state, ...patch };
      if ('course' in patch) save();
      notify();
    },
    /** Edit the course with one of the functions from edit.js. Autosaves and re-renders. */
    update(fn) {
      if (!state.course) return;
      state = { ...state, course: fn(state.course) };
      save();
      notify();
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
