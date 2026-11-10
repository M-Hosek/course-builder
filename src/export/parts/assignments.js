import { XML_HEAD, CANVAS_NS, LAR, tag, num, slug, htmlPage } from '../../xml.js';

/**
 * The fields of an <assignment> element, in the order Canvas exports them.
 * Shared by plain assignments, graded discussions and quizzes.
 */
export function assignmentFields(ctx, item, { submissionTypes, points, extra = '', pad = '  ' }) {
  const lines = [
    tag('title', item.title),
    item.dueAt ? tag('due_at', item.dueAt) : null,
    '<module_locked>false</module_locked>',
    item.groupKey ? tag('assignment_group_identifierref', ctx.groupId(item.groupKey)) : null,
    `<workflow_state>${item.published ? 'published' : 'unpublished'}</workflow_state>`,
    extra || null,
    `<points_possible>${num(points)}</points_possible>`,
    '<grading_type>points</grading_type>',
    '<all_day>false</all_day>',
    tag('submission_types', submissionTypes),
    `<position>${ctx.nextPosition()}</position>`,
    '<peer_reviews>false</peer_reviews>',
    '<omit_from_final_grade>false</omit_from_final_grade>',
  ];
  return lines.filter(Boolean).map((l) => pad + l).join('\n');
}

export function files(exp, ctx) {
  const out = [];
  for (const mod of exp.modules) {
    for (const item of mod.items.filter((i) => i.kind === 'assignment')) {
      const id = ctx.itemId(item);
      const html = `${id}/${slug(item.title)}.html`;
      const settings = `${id}/assignment_settings.xml`;
      out.push({
        path: html,
        content: htmlPage(`Assignment: ${item.title}`, item.body ?? ''),
        resource: { identifier: id, type: LAR, href: html, files: [html, settings] },
      });
      out.push({
        path: settings,
        content: `${XML_HEAD}
<assignment identifier="${id}" ${CANVAS_NS}>
${assignmentFields(ctx, item, { submissionTypes: item.submissionTypes?.length ? item.submissionTypes.join(',') : 'none', points: item.points ?? 0 })}
</assignment>
`,
      });
    }
  }
  return out;
}
