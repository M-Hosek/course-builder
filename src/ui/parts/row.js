import { h } from '../h.js';
import { dayLabel } from '../../dates.js';
import { noClassLine } from '../../lines.js';
import { updateRow, removeRow, moveRow, clearNoClass } from '../../edit.js';

export const COLUMNS = 6;
const KIND_NAME = { assignment: 'Assignment', discussion: 'Discussion', quiz: 'Quiz', page: 'Page' };
export const TYPE_NAME = { online_upload: 'file upload', online_text_entry: 'text entry', student_annotation: 'annotation', media_recording: 'media recording' };

/** 'Assignment · file upload, text entry' */
export function typeText(row) {
  if (row.kind !== 'assignment') return KIND_NAME[row.kind];
  const types = (row.submissionTypes ?? []).map((t) => TYPE_NAME[t]).filter(Boolean);
  return `Assignment · ${types.length ? types.join(', ') : 'nothing to hand in'}`;
}

/** What a class line is called on screen and in control names. */
export function classLabel(row) {
  if (row.noClass) {
    if (row.date) return noClassLine({ date: row.date, reason: row.noClass.reason });
    return `No class this week${row.noClass.reason?.trim() ? ` · ${row.noClass.reason.trim()}` : ''}`;
  }
  if (row.extra) return `${dayLabel(row.date)} extra class`;
  return row.date ? `${dayLabel(row.date)} class` : 'This week';
}

/** Up, Down, "to another week", Remove: the way to move a row without dragging it. */
function actions(ctx, row, name, { canChangeWeek, canRemove }) {
  const { store, week, index, count, weeks } = ctx;
  const go = (toWeek, toIndex) => store.update((c) => moveRow(c, row.id, toWeek, toIndex));
  return h('div', { class: 'row-actions' },
    h('button', { type: 'button', class: 'small', id: `${row.id}-up`, 'aria-label': `Move ${name} up`, disabled: index === 0, onclick: () => go(week, index - 1) }, 'Up'),
    h('button', { type: 'button', class: 'small', id: `${row.id}-down`, 'aria-label': `Move ${name} down`, disabled: index === count - 1, onclick: () => go(week, index + 1) }, 'Down'),
    canChangeWeek && h('select', {
      id: `${row.id}-move`, 'aria-label': `Move ${name} to another week`,
      onchange: (e) => { if (e.target.value !== '') go(Number(e.target.value), Number.MAX_SAFE_INTEGER); },
    },
    h('option', { value: '' }, 'Move to…'),
    week !== 0 && h('option', { value: '0' }, 'Start Here'),
    Array.from({ length: weeks }, (_, i) => i + 1).filter((n) => n !== week).map((n) => h('option', { value: String(n) }, `Week ${n}`))),
    canRemove && h('button', { type: 'button', class: 'small', id: `${row.id}-remove`, 'aria-label': `Remove ${name}`, onclick: () => store.update((c) => removeRow(c, row.id)) }, 'Remove'));
}

/** Dragging does the same thing as the Move buttons. */
function dragProps(ctx, row) {
  return {
    draggable: 'true',
    ondragstart: (e) => { e.dataTransfer?.setData('text/plain', row.id); e.currentTarget.classList.add('dragging'); },
    ondragend: (e) => e.currentTarget.classList.remove('dragging'),
    ondragover: (e) => e.preventDefault(),
    ondrop: (e) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      if (id && id !== row.id) ctx.store.update((c) => moveRow(c, id, ctx.week, ctx.index));
    },
  };
}

const warningRows = (warnings) => warnings.map((w) => h('tr', { class: 'row-warning' },
  h('td', { colspan: String(COLUMNS), role: 'status' }, `⚠ ${w.message}`)));

function itemRow(ctx, row) {
  const { store, course, breakWeek } = ctx;
  const name = row.title || 'this item';
  const set = (patch) => store.update((c) => updateRow(c, row.id, patch));
  const graded = row.kind === 'assignment' || row.kind === 'discussion';
  const isPage = row.kind === 'page';

  return [
    h('tr', { class: 'item-row', id: `row-${row.id}`, ...dragProps(ctx, row) },
      h('td', null, h('input', { type: 'text', id: `${row.id}-title`, value: row.title, 'aria-label': `Name of ${name}`, onchange: (e) => set({ title: e.target.value }) })),
      h('td', null, h('span', { class: 'type' }, typeText(row)), breakWeek && [' ', h('span', { class: 'break-flag' }, '⚠ check break dates')]),
      h('td', null, !isPage && h('input', { type: 'date', id: `${row.id}-due`, value: row.due ?? '', 'aria-label': `Due date of ${name}`, onchange: (e) => set({ due: e.target.value }) })),
      h('td', { class: 'points' },
        graded && h('input', { type: 'number', id: `${row.id}-points`, min: '0', step: 'any', value: row.points ?? '', 'aria-label': `Points for ${name}`,
          onchange: (e) => set({ points: e.target.value === '' ? '' : Number(e.target.value) }) }),
        row.kind === 'quiz' && 'set by its questions in Canvas'),
      h('td', null, !isPage && h('select', { class: 'group', id: `${row.id}-group`, 'aria-label': `Grade group for ${name}`, onchange: (e) => set({ groupId: e.target.value }) },
        h('option', { value: '', selected: !row.groupId }, '(no group)'),
        course.groups.map((g) => h('option', { value: g.id, selected: g.id === row.groupId }, g.name)))),
      h('td', null, actions(ctx, row, name, { canChangeWeek: true, canRemove: true }))),
    ctx.extraRows?.(row) ?? [],
    warningRows(ctx.warnings.filter((w) => w.rowId === row.id && w.kind !== 'annotation')),
  ];
}

function classRow(ctx, row) {
  const { store, breakWeek } = ctx;
  const label = classLabel(row);
  const set = (patch) => store.update((c) => updateRow(c, row.id, patch));
  const readings = (text) => text.split(';').map((s) => s.trim()).filter(Boolean);

  const body = row.noClass
    ? h('div', { class: 'class-line' },
      h('span', { class: 'when' }, label),
      h('button', { type: 'button', class: 'small', id: `${row.id}-undo`, 'aria-label': `Undo No class ${row.date ? `on ${dayLabel(row.date)}` : 'this week'}`, onclick: () => store.update((c) => clearNoClass(c, row.id)) }, 'Undo'))
    : h('div', { class: 'class-line' },
      h('span', { class: 'when' }, label),
      row.extra && h('div', { class: 'field' },
        h('label', { for: `${row.id}-date` }, 'Date'),
        h('input', { type: 'date', id: `${row.id}-date`, value: row.date, 'aria-label': `Date of ${label}`, onchange: (e) => { if (e.target.value) set({ date: e.target.value }); } })),
      h('div', { class: 'field' },
        h('label', { for: `${row.id}-theme` }, 'Theme'),
        h('input', { type: 'text', class: 'theme', id: `${row.id}-theme`, value: row.theme, 'aria-label': `Theme for ${label}`, onchange: (e) => set({ theme: e.target.value }) })),
      h('div', { class: 'field' },
        h('label', { for: `${row.id}-readings` }, 'Readings'),
        h('input', { type: 'text', class: 'readings', id: `${row.id}-readings`, value: row.readings.join('; '), 'aria-label': `Readings for ${label}`,
          placeholder: 'Reading names, separated by semicolons', onchange: (e) => set({ readings: readings(e.target.value) }) })),
      breakWeek && h('span', { class: 'break-flag' }, '⚠ check break dates'));

  return [h('tr', { class: 'class-row', id: `row-${row.id}`, ...dragProps(ctx, row) },
    h('td', { colspan: String(COLUMNS - 1) }, body),
    h('td', null, actions(ctx, row, label, { canChangeWeek: false, canRemove: !!row.extra })))];
}

/**
 * The table rows for one row of the course.
 * ctx = { store, course, week, index, count, weeks, warnings, breakWeek, extraRows? }
 */
export function renderRow(ctx, row) {
  return row.kind === 'class' ? classRow(ctx, row) : itemRow(ctx, row);
}
