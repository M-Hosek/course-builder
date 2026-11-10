import { XML_HEAD, CANVAS_NS, LAR, tag } from '../../xml.js';
import { assignmentFields } from './assignments.js';

// A plain topic file plus a Canvas settings file that depends on it. Import-proven by the prototype.
const TOPIC_NS = 'xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imsdt_v1p1.xsd"';

export function files(exp, ctx) {
  const out = [];
  for (const mod of exp.modules) {
    for (const item of mod.items.filter((i) => i.kind === 'discussion')) {
      const topicId = ctx.itemId(item);
      const metaId = ctx.ids.id('discussion-meta', item.key);
      const graded = item.points != null;
      // The settings file goes first so it is the first file found with this title.
      out.push({
        path: `${metaId}.xml`,
        content: `${XML_HEAD}
<topicMeta identifier="${metaId}" ${CANVAS_NS}>
  <topic_id>${topicId}</topic_id>
  ${tag('title', item.title)}
  <type>topic</type>
  <discussion_type>threaded</discussion_type>
  <workflow_state>${item.published ? 'active' : 'unpublished'}</workflow_state>
  <module_locked>false</module_locked>${graded ? `
  <assignment identifier="${ctx.ids.id('discussion-assignment', item.key)}">
${assignmentFields(ctx, item, { submissionTypes: 'discussion_topic', points: item.points, pad: '    ' })}
  </assignment>` : ''}
</topicMeta>
`,
        resource: { identifier: metaId, type: LAR, href: `${metaId}.xml`, files: [`${metaId}.xml`] },
      });
      out.push({
        path: `${topicId}.xml`,
        content: `${XML_HEAD}
<topic ${TOPIC_NS}>
  ${tag('title', item.title)}
  <text texttype="text/html"></text>
</topic>
`,
        resource: { identifier: topicId, type: 'imsdt_xmlv1p1', files: [`${topicId}.xml`], dependency: metaId },
      });
    }
  }
  return out;
}
