import { h } from '../h.js';
import { TEMPLATES, fromTemplate } from '../../templates.js';
import { defaultAnswers } from '../../walkthrough.js';

export function renderTemplates(state, store) {
  const card = (id, name, blurb, onclick) => h('li', null,
    h('button', { type: 'button', class: 'card', id: `plan-${id}`, onclick }, h('strong', null, name), h('span', null, blurb)));

  return h('main', { class: 'templates' },
    h('h1', { tabindex: '-1' }, 'Pick a plan'),
    h('p', null, 'Every plan fills in each week for you. You can change anything on the next screen.'),
    h('ul', { class: 'cards' },
      TEMPLATES.map((t) => card(t.id, t.name, t.blurb, () => store.set({ course: fromTemplate(t.id, state.basics), screen: 'review' }))),
      card('own', 'Design my own', 'Answer a few questions and build it step by step.',
        () => store.set({ answers: state.answers ?? defaultAnswers(), step: 1, groupsEdited: false, screen: 'walkthrough' }))),
    h('p', { class: 'buttons' }, h('button', { type: 'button', id: 'plan-back', onclick: () => store.set({ screen: 'basics' }) }, 'Back')));
}
