import { h } from '../h.js';
import { suggestGroups, fromAnswers, defaultAnswers } from '../../walkthrough.js';
import { makeGroup } from '../../rows.js';
import { renderGradingChoice, renderGroupsTable, renderSubmissionTypes, renderHomeChecklist } from '../parts/grading.js';

const TITLES = [
  'What will students do each week?',
  'Exams and big projects',
  'How will this course be graded?',
  'How will students turn in assignments?',
  'Your course home page',
];
const EXAMS = [['none', 'No exams'], ['final', 'A final exam'], ['midterm-final', 'A midterm and a final'], ['every-4', 'An exam every 4 weeks']];
const WEEKLY = [['assignment', 'An assignment'], ['discussion', 'A discussion'], ['quiz', 'A quiz']];

/** Step 4 only matters when something will be handed in. */
const handsSomethingIn = (a) => a.weekly.assignment || a.project;
const skip = (step, a) => step === 4 && !handsSomethingIn(a);

export function renderWalkthrough(state, store) {
  const a = state.answers ?? defaultAnswers();
  const step = state.step ?? 1;

  /** Record an answer. The suggested groups follow along until the faculty member edits them. */
  const answer = (patch, { shapesGroups = false } = {}) => {
    const answers = { ...a, ...patch };
    if (shapesGroups && !state.groupsEdited) answers.groups = suggestGroups(answers);
    store.set({ answers });
  };
  const editGroups = (groups) => store.set({ answers: { ...a, groups }, groupsEdited: true });
  const go = (delta) => {
    let to = step + delta;
    if (skip(to, a)) to += delta;
    if (to < 1) store.set({ screen: 'templates' });
    else store.set({ step: to });
  };
  const check = (id, text, checked, onchange) => h('div', { class: 'choice' },
    h('input', { type: 'checkbox', id, checked, onchange }), ' ', h('label', { for: id }, text));

  const body = {
    1: () => h('fieldset', null, h('legend', null, 'Every week, students will do'),
      WEEKLY.map(([key, text]) => check(`wt-weekly-${key}`, text, a.weekly[key],
        (e) => answer({ weekly: { ...a.weekly, [key]: e.target.checked } }, { shapesGroups: true }))),
      h('p', { class: 'hint' }, 'You can add, remove, or change any week later.')),
    2: () => [
      h('fieldset', null, h('legend', null, 'Exams'),
        EXAMS.map(([value, text]) => h('div', { class: 'choice' },
          h('input', { type: 'radio', name: 'wt-exams', id: `wt-exams-${value}`, value, checked: a.exams === value, onchange: () => answer({ exams: value }, { shapesGroups: true }) }),
          ' ', h('label', { for: `wt-exams-${value}` }, text))),
        h('p', { class: 'hint' }, 'Exams are created as quizzes with no questions. Their points come from the questions you add in Canvas.')),
      check('wt-project', 'A final project', a.project, (e) => answer({ project: e.target.checked }, { shapesGroups: true })),
    ],
    3: () => [
      renderGradingChoice({ grading: a.grading, idPrefix: 'wt-grading', onChange: (grading) => answer({ grading }) }),
      renderGroupsTable({
        groups: a.groups, weighted: a.grading === 'weighted', idPrefix: 'wt-group',
        warning: (() => {
          const total = a.groups.reduce((s, g) => s + (Number(g.weight) || 0), 0);
          return Math.abs(total - 100) > 0.01 ? `Grade weights add up to ${Math.round(total * 100) / 100}%, not 100%.` : '';
        })(),
        onChange: (id, patch) => editGroups(a.groups.map((g) => (g.id === id ? { ...g, ...patch } : g))),
        onRemove: (id) => editGroups(a.groups.filter((g) => g.id !== id)),
        onAdd: () => editGroups([...a.groups, makeGroup('New group', 0)]),
      }),
      h('p', { class: 'hint' }, 'Rename a group and its items stay in it. You can fix weights later on the review screen.'),
    ],
    4: () => h('fieldset', null, h('legend', null, 'Students can turn assignments in as'),
      renderSubmissionTypes({ chosen: a.submissionTypes, idPrefix: 'wt', onChange: (submissionTypes) => answer({ submissionTypes }) }),
      h('p', { class: 'hint' }, 'More than one is fine. You can change this for each assignment later.')),
    5: () => renderHomeChecklist({ homePage: a.homePage, idPrefix: 'wt-home', onChange: (patch) => answer({ homePage: { ...a.homePage, ...patch } }) }),
  }[step]();

  return h('main', { class: 'walkthrough' },
    h('h1', { tabindex: '-1' }, `Step ${step} of 5: ${TITLES[step - 1]}`),
    body,
    h('p', { class: 'buttons' },
      h('button', { type: 'button', id: 'wt-back', onclick: () => go(-1) }, 'Back'),
      step < 5
        ? h('button', { type: 'button', class: 'primary', id: 'wt-next', onclick: () => go(1) }, 'Next')
        : h('button', { type: 'button', class: 'primary', id: 'wt-build', onclick: () => store.set({ course: fromAnswers(state.basics, a), screen: 'review' }) }, 'Build my course')));
}
