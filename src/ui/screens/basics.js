import { h, field } from '../h.js';
import { isDate } from '../../dates.js';
import { MAX_WEEKS } from '../../model.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function renderBasics(state, store) {
  const draft = state.basicsDraft ?? { title: state.basics?.title ?? '', firstDay: state.basics?.firstDay ?? '', weeks: String(state.basics?.weeks ?? 14), dueWeekday: String(state.basics?.dueWeekday ?? 5) };
  const errors = state.basicsErrors ?? {};

  const title = h('input', { type: 'text', id: 'basics-title', value: draft.title, autocomplete: 'off' });
  const firstDay = h('input', { type: 'date', id: 'basics-first-day', value: draft.firstDay });
  const weeks = h('input', { type: 'number', id: 'basics-weeks', min: '1', max: String(MAX_WEEKS), value: draft.weeks });
  const dueDay = h('select', { id: 'basics-due-day' }, DAYS.map((name, i) => h('option', { value: String(i), selected: String(i) === draft.dueWeekday }, name)));

  const next = (event) => {
    event.preventDefault();
    const typed = { title: title.value, firstDay: firstDay.value, weeks: weeks.value, dueWeekday: dueDay.value };
    const count = Number(typed.weeks);
    const problems = {};
    if (!typed.title.trim()) problems.title = 'Enter a course title.';
    if (!isDate(typed.firstDay)) problems.firstDay = 'Choose the first day of class.';
    if (!Number.isInteger(count) || count < 1 || count > MAX_WEEKS) problems.weeks = `Enter a number of weeks from 1 to ${MAX_WEEKS}.`;
    if (Object.keys(problems).length) { store.set({ basicsDraft: typed, basicsErrors: problems }); return; }
    store.set({
      basics: { title: typed.title.trim(), firstDay: typed.firstDay, weeks: count, dueWeekday: Number(typed.dueWeekday) },
      basicsDraft: null, basicsErrors: {}, screen: 'templates',
    });
  };

  return h('main', { class: 'basics' },
    h('h1', { tabindex: '-1' }, 'Course basics'),
    h('p', null, 'You can change any of these later.'),
    h('form', { novalidate: true, onsubmit: next },
      field('Course title', title, { error: errors.title }),
      field('First day of class', firstDay, { error: errors.firstDay }),
      field('Number of weeks', weeks, { error: errors.weeks }),
      field('Day work is usually due', dueDay),
      h('p', { class: 'buttons' },
        h('button', { type: 'button', id: 'basics-back', onclick: () => store.set({ screen: 'start', basicsDraft: null, basicsErrors: {} }) }, 'Back'),
        h('button', { type: 'submit', class: 'primary', id: 'basics-next', onclick: next }, 'Next'))));
}
