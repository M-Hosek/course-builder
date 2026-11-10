import { XML_HEAD, esc, tag } from '../../xml.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource" xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lomresource_v1p0.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lommanifest_v1p0.xsd"';

/**
 * @param resources Array<{identifier, type, href?, intendeduse?, files: string[], dependency?: string}>
 * @param org Array<{identifier, title, items: Array<{identifier, title, identifierref?}>}> modules, for the outline
 */
export function manifestXml(course, ctx, resources, org = []) {
  const orgXml = org.map((m) => `        <item identifier="${m.identifier}">
          ${tag('title', m.title)}
${m.items.map((i) => `          <item identifier="${i.identifier}"${i.identifierref ? ` identifierref="${i.identifierref}"` : ''}>
            ${tag('title', i.title)}
          </item>`).join('\n')}
        </item>`).join('\n');
  const resXml = resources.map((r) => `    <resource identifier="${r.identifier}" type="${r.type}"${r.href ? ` href="${esc(r.href)}"` : ''}${r.intendeduse ? ` intendeduse="${r.intendeduse}"` : ''}>
${r.files.map((f) => `      <file href="${esc(f)}"/>`).join('\n')}${r.dependency ? `\n      <dependency identifierref="${r.dependency}"/>` : ''}
    </resource>`).join('\n');
  return `${XML_HEAD}
<manifest identifier="${ctx.ids.id('manifest', course.title)}" ${NS}>
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
    <lomimscc:lom>
      <lomimscc:general>
        <lomimscc:title>
          <lomimscc:string>${esc(course.title)}</lomimscc:string>
        </lomimscc:title>
      </lomimscc:general>
    </lomimscc:lom>
  </metadata>
  <organizations>
    <organization identifier="org_1" structure="rooted-hierarchy">
      <item identifier="LearningModules">
${orgXml}
      </item>
    </organization>
  </organizations>
  <resources>
${resXml}
  </resources>
</manifest>
`;
}
