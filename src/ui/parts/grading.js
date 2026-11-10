import { h, field } from '../h.js';
import { setGrading, addGroup, updateGroup, removeGroup, setExtraCredit, setHomePage, updateRow } from '../../edit.js';
import { SUBMISSION_TYPES } from '../../model.js';
import { ANNOTATION_NOTE } from '../../export/outline.js';
import { COLUMNS } from './row.js';

export const OTHER_LABEL = 'Other — I\'ll set up my own grading in Canvas (for example, standards-based or contract grading).';
const TYPE_LABEL = { online_upload: 'File upload', online_text_entry: 'Text entry', student_annotation: 'Annotation', media_recording: 'Media recording' };
const HOME = [['welcome', 'Welcome message'], ['syllabus', 'Syllabus link'], ['communication', 'Communication preferences'], ['startHere', 'Link to Start Here']];
const cssName = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-');

/** "Weighted grade groups" or "Other". Used on the review screen and in the walkthrough. */
export function renderGradingChoice({ grading, onChange, idPrefix = 'grading' }) {
  const radio = (value, text) => h('div', { class: 'choice' },
    h('input', { type: 'radio', name: idPrefix, id: `${idPrefix}-${value}`, value, checked: grading === value, onchange: () => onChange(value) }),
    ' ', h('label', { for: `${idPrefix}-${value}` }, text));
  return h('div', { role: 'radiogroup', 'aria-label': 'How will this course be graded?' }, radio('weighted', 'Weighted grade groups'), radio('other', OTHER_LABEL));
}

/**
 * The groups table with its running total. Used on the review screen and in the walkthrough.
 * @param {{groups: Array, weighted: boolean, counts?: Object, warning?: string, idPrefix?: string,
 *   onChange: (groupId, patch) => void, onRemove: (groupId) => void, onAdd: () => void}} p
 */
export function renderGroupsTable({ groups, weighted, counts, warning, idPrefix = 'group', onChange, onRemove, onAdd }) {
  const total = groups.reduce((sum, g) => sum + (Number(g.weight) || 0), 0);
  const row = (g) => {
    const name = g.name || 'unnamed group';
    return h('tr', null,
      h('td', null, h('input', { type: 'text', id: `${idPrefix}-${g.id}-name`, value: g.name, 'aria-label': `Name of group ${name}`, onchange: (e) => onChange(g.id, { name: e.target.value }) })),
      weighted && h('td', null, h('input', { type: 'number', id: `${idPrefix}-${g.id}-weight`, min: '0', max: '100', step: 'any', value: String(g.weight), 'aria-label': `Weight % for ${name}`,
        onchange: (e) => onChange(g.id, { weight: Number(e.target.value) || 0 }) })),
      weighted && h('td', null, h('select', { id: `${idPrefix}-${g.id}-drop`, 'aria-label': `Drop lowest for ${name}`, onchange: (e) => onChange(g.id, { dropLowest: Number(e.target.value) }) },
        [0, 1, 2, 3].map((n) => h('option', { value: String(n), selected: Number(g.dropLowest) === n }, n === 0 ? 'none' : String(n))))),
      counts && h('td', { class: `count count-${cssName(g.name)}` }, String(counts[g.id] ?? 0)),
      h('td', null, h('button', { type: 'button', class: 'small', id: `${idPrefix}-${g.id}-remove`, 'aria-label': `Remove group ${name}`, onclick: () => onRemove(g.id) }, 'Remove')));
  };
  return h('div', { class: 'groups' },
    h('table', null,
      h('caption', { class: 'visually-hidden' }, 'Grade groups'),
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, 'Name'), weighted && h('th', { scope: 'col' }, 'Weight %'), weighted && h('th', { scope: 'col' }, 'Drop lowest'),
        counts && h('th', { scope: 'col' }, 'Items'), h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Remove')))),
      h('tbody', null, groups.map(row))),
    h('p', null, h('button', { type: 'button', class: 'small', id: `${idPrefix}-add`, onclick: onAdd }, 'Add a group')),
    weighted && h('p', { class: 'total' }, `Total: ${Math.round(total * 100) / 100}%`),
    !weighted && h('p', null, 'Groups still organize your items. No weights are sent to Canvas.'),
    h('div', { role: 'status' }, weighted && warning && h('p', { class: 'weights-warning field-error' }, warning)));
}

function extraCredit(course, store) {
  const ec = course.extraCredit;
  const set = (patch) => store.update((c) => setExtraCredit(c, { ...c.extraCredit, ...patch }));
  const choose = (mode) => store.update((c) => setExtraCredit(c,
    mode === 'separate' ? { mode, name: 'Extra credit', percent: 3, week: c.weekRows.length }
      : mode === 'bonus' ? { mode, name: 'Bonus points', groupId: c.groups[0]?.id ?? '' } : { mode: 'none' }));
  const option = (value, text) => h('option', { value, selected: ec.mode === value }, text);

  return h('div', { class: 'extra-credit' },
    field('Extra credit', h('select', { id: 'extra-mode', onchange: (e) => choose(e.target.value) },
      option('none', 'No extra credit'), option('separate', 'Separate extra-credit assignment'), option('bonus', 'Bonus points inside a group')),
    { hint: 'One approach per course.' }),
    ec.mode === 'separate' && [
      field('Name', h('input', { type: 'text', id: 'extra-name', value: ec.name, onchange: (e) => set({ name: e.target.value }) })),
      field('Worth up to (+%)', h('input', { type: 'number', id: 'extra-percent', min: '0', max: '100', step: 'any', value: String(ec.percent), onchange: (e) => set({ percent: Number(e.target.value) || 0 }) }),
        { hint: 'Counts on top of 100%.' }),
      field('Week', h('select', { id: 'extra-week', onchange: (e) => set({ week: Number(e.target.value) }) },
        course.weekRows.map((_, i) => h('option', { value: String(i + 1), selected: ec.week === i + 1 }, `Week ${i + 1}`)))),
    ],
    ec.mode === 'bonus' && [
      field('Group', h('select', { id: 'extra-group', onchange: (e) => set({ groupId: e.target.value }) },
        course.groups.map((g) => h('option', { value: g.id, selected: g.id === ec.groupId }, g.name)))),
      field('Name of the bonus item', h('input', { type: 'text', id: 'extra-name', value: ec.name, onchange: (e) => set({ name: e.target.value }) }),
        { hint: 'Counts toward that group without raising the points students must earn.' }),
    ]);
}

/** The home-page checklist. Used on the review screen and in the walkthrough. */
export function renderHomeChecklist({ homePage, onChange, idPrefix = 'home' }) {
  return h('fieldset', { class: 'home-page' }, h('legend', null, 'Home page'),
    HOME.map(([key, text]) => h('div', { class: 'choice' },
      h('input', { type: 'checkbox', id: `${idPrefix}-${key}`, checked: !!homePage[key], onchange: (e) => onChange({ [key]: e.target.checked }) }),
      ' ', h('label', { for: `${idPrefix}-${key}` }, text))),
    h('p', { class: 'hint' }, 'Placeholder text only. You fill it in later in Canvas.'));
}

/** The side panel of the review screen. */
export function renderGrading(course, warnings, store) {
  const weighted = course.grading === 'weighted';
  const counts = {};
  for (const r of [...course.startHere, ...course.weekRows.flat()]) if (r.groupId) counts[r.groupId] = (counts[r.groupId] ?? 0) + 1;

  return h('aside', { class: 'side', 'aria-labelledby': 'grading-title' },
    h('h2', { id: 'grading-title' }, 'How will this course be graded?'),
    renderGradingChoice({ grading: course.grading, onChange: (g) => store.update((c) => setGrading(c, g)) }),
    renderGroupsTable({
      groups: course.groups, weighted, counts,
      warning: warnings.find((w) => w.kind === 'weights')?.message,
      onChange: (id, patch) => store.update((c) => updateGroup(c, id, patch)),
      onRemove: (id) => store.update((c) => removeGroup(c, id)),
      onAdd: () => store.update((c) => addGroup(c)),
    }),
    weighted && extraCredit(course, store),
    renderHomeChecklist({ homePage: course.homePage, onChange: (patch) => store.update((c) => setHomePage(c, patch)) }));
}

/** The four submission-type checkboxes. Used under each assignment and in the walkthrough. */
export function renderSubmissionTypes({ chosen, onChange, idPrefix, nameSuffix = '' }) {
  const toggle = (type) => (e) => onChange(SUBMISSION_TYPES.filter((t) => (t === type ? e.target.checked : chosen.includes(t))));
  return h('div', { class: 'checks' }, SUBMISSION_TYPES.map((type) => h('span', { class: 'choice' },
    h('input', { type: 'checkbox', id: `${idPrefix}-type-${type}`, checked: chosen.includes(type), 'aria-label': nameSuffix ? `${TYPE_LABEL[type]}${nameSuffix}` : null, onchange: toggle(type) }),
    ' ', h('label', { for: `${idPrefix}-type-${type}` }, TYPE_LABEL[type]))));
}

/** The row under an assignment: how students turn it in, and the annotation reminder. */
export function submissionRows(row, { store }) {
  if (row.kind !== 'assignment') return [];
  const chosen = row.submissionTypes ?? [];
  return [h('tr', { class: 'sub-row' }, h('td', { colspan: String(COLUMNS) },
    h('fieldset', null, h('legend', null, 'Students can turn this in as'),
      renderSubmissionTypes({ chosen, idPrefix: row.id, nameSuffix: ` for ${row.title || 'this item'}`, onChange: (types) => store.update((c) => updateRow(c, row.id, { submissionTypes: types })) })),
    h('div', { role: 'status', class: chosen.includes('student_annotation') ? 'annotation-note warn' : 'annotation-note' },
      chosen.includes('student_annotation') && `⚠ ${ANNOTATION_NOTE}`)))];
}
