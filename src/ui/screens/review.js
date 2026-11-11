import { h, field } from '../h.js';
import { isDate } from '../../dates.js';
import { MAX_WEEKS } from '../../model.js';
import { setBasics, setFirstDay, setWeeks, weeksToRemove, setFormat, setMeets } from '../../edit.js';
import { warningsFor } from '../../warnings.js';
import { renderWeek } from '../parts/week.js';

const DAY_NAMES = { 1: ['M', 'Monday'], 2: ['T', 'Tuesday'], 3: ['W', 'Wednesday'], 4: ['Th', 'Thursday'], 5: ['F', 'Friday'] };
const QUICK_PICKS = [['MWF', [1, 3, 5]], ['TTh', [2, 4]], ['WF', [3, 5]]];

function topBar(course, store) {
  const changeWeeks = (e) => {
    const weeks = Math.round(Number(e.target.value));
    if (!Number.isFinite(weeks) || weeks < 1 || weeks > MAX_WEEKS) { store.set({}); return; } // put the old number back
    // Nothing is removed until the faculty member has seen what those weeks hold and said what should happen.
    const gone = weeksToRemove(course, weeks);
    if (weeks < course.weeks && gone.rows + gone.lines > 0) store.set({ dialog: { type: 'weeks', weeks } });
    else store.update((c) => setWeeks(c, weeks, 'move'));
  };
  const radio = (value, text) => h('span', { class: 'choice' },
    h('input', { type: 'radio', name: 'format', id: `format-${value}`, value, checked: course.format === value, onchange: () => store.update((c) => setFormat(c, value)) }),
    ' ', h('label', { for: `format-${value}` }, text));
  const toggle = (day) => (e) => store.update((c) => setMeets(c, e.target.checked ? [...c.meets, day] : c.meets.filter((d) => d !== day)));

  return h('header', { class: 'topbar' },
    h('div', { class: 'row' },
      field('Course title', h('input', { type: 'text', id: 'course-title', value: course.title, onchange: (e) => store.update((c) => setBasics(c, { title: e.target.value })) })),
      field('First day', h('input', { type: 'date', id: 'course-first-day', value: course.firstDay,
        onchange: (e) => (isDate(e.target.value) ? store.update((c) => setFirstDay(c, e.target.value)) : store.set({})) })),
      field('Weeks', h('input', { type: 'number', id: 'course-weeks', min: '1', max: String(MAX_WEEKS), value: String(course.weeks), onchange: changeWeeks })),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', id: 'btn-save-work' }, 'Download my work'),
      h('button', { type: 'button', class: 'primary', id: 'btn-download' }, 'Download for Canvas')),
    h('div', { class: 'row' },
      h('fieldset', { id: 'format' }, h('legend', null, 'Format'), h('div', { class: 'checks' }, radio('hybrid', 'Hybrid'), radio('async', 'Fully asynchronous'))),
      course.format === 'hybrid' && h('fieldset', { id: 'meets' }, h('legend', null, 'Meets'),
        h('div', { class: 'checks' },
          Object.entries(DAY_NAMES).map(([day, [short, full]]) => h('span', { class: 'choice' },
            h('input', { type: 'checkbox', id: `meets-${day}`, 'aria-label': full, checked: course.meets.includes(Number(day)), onchange: toggle(Number(day)) }),
            ' ', h('label', { for: `meets-${day}`, 'aria-hidden': 'true' }, short))),
          QUICK_PICKS.map(([text, days]) => h('button', { type: 'button', class: 'small', id: `meets-pick-${text}`, onclick: () => store.update((c) => setMeets(c, days)) }, text))),
        h('p', { class: 'hint' }, 'Meeting days only make the class lines below. They never change assignments or due dates.'))));
}

/** "Weeks 13–14 have 2 items. What should happen to them?" — asked before any week is removed. */
function weeksQuestion(course, dialog, store) {
  const { rows, lines } = weeksToRemove(course, dialog.weeks);
  const first = dialog.weeks + 1;
  const one = first === course.weeks;
  const which = one ? `Week ${first} has` : `Weeks ${first}–${course.weeks} have`;
  const typed = `${lines} class ${lines === 1 ? 'line' : 'lines'} with a theme or readings`;
  const answer = (how) => () => { store.set({ dialog: null }); store.update((c) => setWeeks(c, dialog.weeks, how)); };
  const cancel = (focused) => h('button', { type: 'button', id: 'weeks-cancel', 'data-autofocus': focused || null, onclick: () => store.set({ dialog: null }) }, 'Cancel');

  if (rows === 0) {
    // Only typed class lines are at stake. Class lines belong to their week, so they cannot be moved.
    return h('div', { class: 'dialog', role: 'alertdialog', 'aria-labelledby': 'weeks-question' },
      h('p', { id: 'weeks-question' }, `${which} ${typed}. ${lines === 1 ? 'It' : 'They'} will be removed.`),
      h('p', { class: 'buttons' },
        cancel(true),
        h('button', { type: 'button', id: 'weeks-delete', onclick: answer('delete') }, one ? `Remove Week ${first}` : `Remove Weeks ${first}–${course.weeks}`)));
  }
  return h('div', { class: 'dialog', role: 'alertdialog', 'aria-labelledby': 'weeks-question' },
    h('p', { id: 'weeks-question' }, `${which} ${rows} ${rows === 1 ? 'item' : 'items'}. What should happen to them?`,
      lines > 0 && ` Also, ${typed} will be removed either way.`),
    h('p', { class: 'buttons' },
      h('button', { type: 'button', class: 'primary', id: 'weeks-move', 'data-autofocus': true, onclick: answer('move') }, `Move them into Week ${dialog.weeks}`),
      h('button', { type: 'button', id: 'weeks-delete', onclick: answer('delete') }, 'Delete them'),
      cancel(false)));
}

/** Parts other tasks plug into the review screen: the side panel, rows under an item, and more questions. */
export const slots = { side: null, extraRows: null, dialogs: null, wire: null };

export function renderReview(state, store) {
  const { course, dialog } = state;
  const warnings = warningsFor(course);
  const weekNumbers = Array.from({ length: course.weekRows.length + 1 }, (_, n) => n);
  const extraRows = slots.extraRows ? (row) => slots.extraRows(row, { course, warnings, store }) : undefined;

  const view = h('main', { class: 'review' },
    h('h1', { tabindex: '-1' }, 'Review and adjust'),
    h('p', null, 'Change anything here. Nothing goes to Canvas until you choose Download for Canvas.'),
    topBar(course, store),
    dialog?.type === 'weeks' && weeksQuestion(course, dialog, store),
    slots.dialogs?.(state, store, warnings),
    h('div', { class: 'layout' },
      h('div', { class: 'weeks' }, weekNumbers.map((n) => renderWeek(course, n, warnings, store, { dialog, extraRows }))),
      slots.side ? slots.side(course, warnings, store) : h('aside', { class: 'side' })));
  slots.wire?.(view, state, store, warnings);
  return view;
}
