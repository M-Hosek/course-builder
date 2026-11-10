import { XML_HEAD, CANVAS_NS, LAR, tag, esc } from '../../xml.js';
import { assignmentFields } from './assignments.js';

// An empty Classic Quiz: a question file, a Canvas settings file with a nested assignment, and a second
// question file under non_cc_assessments/. No points and no questions: Canvas takes a quiz's points
// from its questions, which faculty add later.
const qti = (id, title, schema, fields) => `${XML_HEAD}
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 ${schema}">
  <assessment ident="${id}" title="${esc(title)}">
    <qtimetadata>
${fields.map(([label, entry]) => `      <qtimetadatafield>
        <fieldlabel>${label}</fieldlabel>
        <fieldentry>${entry}</fieldentry>
      </qtimetadatafield>`).join('\n')}
    </qtimetadata>
    <section ident="root_section">
    </section>
  </assessment>
</questestinterop>
`;

export function files(exp, ctx) {
  const out = [];
  for (const mod of exp.modules) {
    for (const item of mod.items.filter((i) => i.kind === 'quiz')) {
      const id = ctx.itemId(item);
      const metaId = ctx.ids.id('quiz-meta', item.key);
      const due = item.dueAt ? `\n  ${tag('due_at', item.dueAt)}` : '';
      const group = item.groupKey ? `\n  ${tag('assignment_group_identifierref', ctx.groupId(item.groupKey))}` : '';
      const paths = { qti: `${id}/assessment_qti.xml`, meta: `${id}/assessment_meta.xml`, canvasQti: `non_cc_assessments/${id}.xml.qti` };
      out.push({
        path: paths.qti,
        content: qti(id, item.title, 'http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_qtiasiv1p2p1_v1p0.xsd', [
          ['cc_profile', 'cc.exam.v0p1'], ['qmd_assessmenttype', 'Examination'], ['qmd_scoretype', 'Percentage'], ['cc_maxattempts', '1'],
        ]),
        resource: { identifier: id, type: 'imsqti_xmlv1p2/imscc_xmlv1p1/assessment', files: [paths.qti], dependency: metaId },
      });
      out.push({
        path: paths.meta,
        content: `${XML_HEAD}
<quiz identifier="${id}" ${CANVAS_NS}>
  ${tag('title', item.title)}
  <description></description>${due}
  <shuffle_answers>false</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <quiz_type>assignment</quiz_type>
  <points_possible>0.0</points_possible>
  <show_correct_answers>true</show_correct_answers>
  <allowed_attempts>1</allowed_attempts>
  <available>${item.published ? 'true' : 'false'}</available>
  <module_locked>false</module_locked>
  <assignment identifier="${ctx.ids.id('quiz-assignment', item.key)}">
${assignmentFields(ctx, item, { submissionTypes: 'online_quiz', points: 0, extra: `<quiz_identifierref>${id}</quiz_identifierref>`, pad: '    ' })}
  </assignment>${group}
</quiz>
`,
        resource: { identifier: metaId, type: LAR, href: paths.meta, files: [paths.meta, paths.canvasQti] },
      });
      out.push({ path: paths.canvasQti, content: qti(id, item.title, 'http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd', [['cc_maxattempts', '1']]) });
    }
  }
  return out;
}
