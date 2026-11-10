import { XML_HEAD, CANVAS_NS, tag, num } from '../../xml.js';

/** Course settings, grade groups, and the marker file Canvas uses to recognise its own format. */
export function files(exp, ctx) {
  const settings = `${XML_HEAD}
<course identifier="${ctx.courseId}" ${CANVAS_NS}>
  ${tag('title', exp.title)}
  ${tag('course_code', exp.title)}
  <start_at/>
  <conclude_at/>
  <group_weighting_scheme>${exp.weighted ? 'percent' : 'equal'}</group_weighting_scheme>
  <default_view>${exp.homePage ? 'wiki' : 'modules'}</default_view>
  <license>private</license>
</course>
`;
  const groups = `${XML_HEAD}
<assignmentGroups ${CANVAS_NS}>
${exp.groups.map((g, i) => `  <assignmentGroup identifier="${ctx.groupId(g.key)}">
    ${tag('title', g.name)}
    <position>${i + 1}</position>
    <group_weight>${num(g.weight)}</group_weight>${g.dropLowest > 0 ? `
    <rules>
      <rule>
        <drop_type>drop_lowest</drop_type>
        <drop_count>${g.dropLowest}</drop_count>
      </rule>
    </rules>` : ''}
  </assignmentGroup>`).join('\n')}
</assignmentGroups>
`;
  return [
    { path: 'course_settings/course_settings.xml', content: settings },
    { path: 'course_settings/assignment_groups.xml', content: groups },
    { path: 'course_settings/canvas_export.txt', content: 'Q: What did the panda say when he was forced out of his natural habitat?\nA: This is un-BEAR-able\n' },
  ];
}
