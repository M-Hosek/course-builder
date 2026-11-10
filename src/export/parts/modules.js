import { XML_HEAD, CANVAS_NS, tag } from '../../xml.js';

// Canvas's names for what a module item points at. WikiPage is not yet import-proven (see rounds/import-check.md).
const CONTENT_TYPE = { assignment: 'Assignment', discussion: 'DiscussionTopic', quiz: 'Quizzes::Quiz', page: 'WikiPage', header: 'ContextModuleSubHeader' };
const state = (published) => (published ? 'active' : 'unpublished');

export function files(exp, ctx) {
  const mods = exp.modules.map((mod, mi) => {
    const identifier = ctx.moduleId(mod.key);
    const items = mod.items.map((item, ii) => ({
      identifier: ctx.ids.id('module-item', `${mod.key}/${item.key}`),
      title: item.title,
      type: CONTENT_TYPE[item.kind],
      identifierref: item.kind === 'header' ? undefined : ctx.itemId(item),
      published: item.published,
      position: ii + 1,
    }));
    ctx.org.push({ identifier, title: mod.name, items });
    return `  <module identifier="${identifier}">
    ${tag('title', mod.name)}
    <workflow_state>${state(mod.published)}</workflow_state>
    <position>${mi + 1}</position>
    <require_sequential_progress>false</require_sequential_progress>
    <locked>false</locked>
    <items>
${items.map((i) => `      <item identifier="${i.identifier}">
        <content_type>${i.type}</content_type>
        <workflow_state>${state(i.published)}</workflow_state>
        ${tag('title', i.title)}${i.identifierref ? `\n        <identifierref>${i.identifierref}</identifierref>` : ''}
        <position>${i.position}</position>
        <new_tab>false</new_tab>
        <indent>0</indent>
        <link_settings_json>null</link_settings_json>
      </item>`).join('\n')}
    </items>
  </module>`;
  });
  return [{ path: 'course_settings/module_meta.xml', content: `${XML_HEAD}\n<modules ${CANVAS_NS}>\n${mods.join('\n')}\n</modules>\n` }];
}
