import { h } from '../h.js';
import { dayLabel } from '../../dates.js';
import { addRow, setNoClass } from '../../edit.js';

/** The "+ Add to Week N" buttons at the end of a week. */
export function renderAddMenu(course, n, store) {
  const where = n === 0 ? 'Start Here' : `Week ${n}`;
  const add = (kind) => () => store.update((c) => addRow(c, n, kind));
  const button = (id, text, onclick) => h('button', { type: 'button', class: 'small', id: `add-${n}-${id}`, onclick }, text);
  return h('div', { class: 'add-menu', role: 'group', 'aria-label': `Add to ${where}` },
    h('span', { class: 'label', 'aria-hidden': 'true' }, `+ Add to ${where}`),
    button('assignment', 'Assignment', add('assignment')),
    button('discussion', 'Discussion', add('discussion')),
    button('quiz', 'Quiz or exam', add('quiz')),
    n > 0 && course.format === 'hybrid' && button('class', 'Class meeting', add('class')),
    n > 0 && button('noclass', '"No class" line', () => store.set({ dialog: { type: 'noclass', week: n } })));
}

/**
 * The small form behind '"No class" line': which of the week's meeting days it covers, and why.
 * A fully asynchronous course has no days to pick; the line covers the week.
 */
export function renderNoClassForm(course, n, store) {
  const days = course.weekRows[n - 1].filter((r) => r.kind === 'class' && r.date && !r.noClass);
  const boxes = days.map((r, i) => h('input', { type: 'checkbox', id: `noclass-${n}-${r.date}`, value: r.date, checked: true, 'data-autofocus': i === 0 }));
  const reason = h('input', { type: 'text', id: `noclass-${n}-reason`, 'data-autofocus': days.length === 0 });
  const close = () => store.set({ dialog: null });
  const submit = (event) => {
    event.preventDefault();
    const dates = days.length ? boxes.filter((b) => b.checked).map((b) => b.value) : 'week';
    store.set({ dialog: null });
    if (dates === 'week' || dates.length) store.update((c) => setNoClass(c, n, dates, reason.value.trim()));
  };
  return h('form', { class: 'dialog', role: 'group', 'aria-label': `Add a "No class" line to Week ${n}`, onsubmit: submit },
    h('h3', null, `No class in Week ${n}`),
    days.length > 0 && h('fieldset', null, h('legend', null, 'Which days?'),
      h('div', { class: 'checks' }, boxes.map((b, i) => h('span', null, b, ' ', h('label', { for: b.id }, dayLabel(days[i].date)))))),
    days.length === 0 && h('p', null, 'This marks the whole week as having no class.'),
    h('div', { class: 'field' }, h('label', { for: reason.id }, 'Reason (optional)'), reason),
    h('p', { class: 'buttons' },
      h('button', { type: 'submit', class: 'primary', id: `noclass-${n}-add`, onclick: submit }, 'Add "No class" line'),
      h('button', { type: 'button', id: `noclass-${n}-cancel`, onclick: close }, 'Cancel')));
}
