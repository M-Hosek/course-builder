import { h } from '../h.js';
import { weekLabel } from '../../dates.js';
import { dismissReminder, moveRow } from '../../edit.js';
import { BREAK_CALENDAR_URL } from '../../warnings.js';
import { renderRow, COLUMNS } from './row.js';
import { renderAddMenu, renderNoClassForm } from './addmenu.js';

const HEADERS = ['Item name', 'Type', 'Due date', 'Points', 'Grade group', 'Move or remove'];

/** The break reminder: a notice with a link to the real calendar. Its only button is Dismiss. */
function breakNotice(warning, n, store) {
  const [before, after] = warning.message.split('HWS academic calendar');
  return h('p', { class: 'warn', role: 'status' },
    before, h('a', { href: BREAK_CALENDAR_URL, target: '_blank', rel: 'noopener' }, 'HWS academic calendar'), after, ' ',
    h('button', { type: 'button', class: 'small', id: `dismiss-${n}`, 'aria-label': `Dismiss the break reminder for Week ${n}`, onclick: () => store.update((c) => dismissReminder(c, n)) }, 'Dismiss'));
}

/**
 * One week (n = 0 is Start Here): a heading, any break reminder, a table of rows, and the Add buttons.
 * `extraRows(row)` lets the review screen add rows under an item (its submission types).
 */
export function renderWeek(course, n, warnings, store, { dialog = null, extraRows } = {}) {
  const rows = n === 0 ? course.startHere : course.weekRows[n - 1];
  const title = n === 0 ? 'Start Here' : weekLabel(course.firstDay, n);
  const mine = warnings.filter((w) => w.week === n);
  const reminder = mine.find((w) => w.kind === 'break');
  const ctxFor = (index) => ({ store, course, week: n, index, count: rows.length, weeks: course.weekRows.length, warnings: mine, breakWeek: !!reminder, extraRows });

  return h('section', {
    class: 'week', id: `week-${n}`, 'aria-labelledby': `week-${n}-title`,
    // Dropping a dragged row on the week itself puts it at the end.
    ondragover: (e) => e.preventDefault(),
    ondrop: (e) => {
      if (e.target.closest?.('tr')) return;
      const id = e.dataTransfer?.getData('text/plain');
      if (id) store.update((c) => moveRow(c, id, n, Number.MAX_SAFE_INTEGER));
    },
  },
  h('h2', { id: `week-${n}-title` }, title),
  n === 0 && h('p', { class: 'muted' }, 'Students see this module first. It arrives published; everything else arrives unpublished.'),
  reminder && breakNotice(reminder, n, store),
  h('table', null,
    h('caption', { class: 'visually-hidden' }, `${title}: items and class lines`),
    h('thead', null, h('tr', null, HEADERS.map((text, i) => h('th', { scope: 'col', class: i === COLUMNS - 1 ? 'actions' : null }, text)))),
    h('tbody', null, rows.length
      ? rows.map((row, index) => renderRow(ctxFor(index), row))
      : h('tr', null, h('td', { colspan: String(COLUMNS), class: 'muted' }, 'Nothing here yet.')))),
  dialog?.type === 'noclass' && dialog.week === n ? renderNoClassForm(course, n, store) : renderAddMenu(course, n, store));
}
