import { LAR, htmlPage, slug } from '../../xml.js';

const metas = (id, published, front = false) => `<meta name="identifier" content="${id}"/>
<meta name="editing_roles" content="teachers"/>
<meta name="workflow_state" content="${published ? 'active' : 'unpublished'}"/>
${front ? '<meta name="front_page" content="true"/>\n' : ''}<meta name="editor_type" content="rce"/>
`;

// Real headings and descriptive link text, so the page reads well with a screen reader.
const HOME = {
  welcome: () => '<h2>Welcome</h2>\n<p>[Write your welcome message here.]</p>',
  syllabus: () => '<h2>Syllabus</h2>\n<p><a href="$CANVAS_COURSE_REFERENCE$/assignments/syllabus">Read the course syllabus</a></p>',
  communication: () => '<h2>Communication preferences</h2>\n<p>[How and when to reach you.]</p>',
  startHere: (ctx) => `<h2>Start Here</h2>\n<p><a href="$CANVAS_OBJECT_REFERENCE$/modules/${ctx.moduleId('start-here')}">Go to the Start Here module</a></p>`,
};

/** The Syllabus, every page that sits in a module, and the home page. */
export function files(exp, ctx) {
  const out = [{
    path: 'course_settings/syllabus.html',
    content: htmlPage('Syllabus'),
    resource: { identifier: `${ctx.courseId}_syllabus`, type: LAR, href: 'course_settings/syllabus.html', intendeduse: 'syllabus', files: ['course_settings/syllabus.html'] },
  }];
  const used = new Set();
  const pathFor = (title) => {
    const stem = slug(title);
    let name = stem;
    for (let n = 2; used.has(name); n++) name = `${stem}-${n}`;
    used.add(name);
    return `wiki_content/${name}.html`;
  };
  const page = (id, title, body, published, front) => {
    const path = pathFor(title);
    out.push({ path, content: htmlPage(title, body, metas(id, published, front)), resource: { identifier: id, type: 'webcontent', href: path, files: [path] } });
  };

  for (const mod of exp.modules) {
    for (const item of mod.items.filter((i) => i.kind === 'page')) page(ctx.itemId(item), item.title, item.body ?? '', item.published, false);
  }
  if (exp.homePage) {
    // The home page always arrives published.
    page(ctx.ids.id('page', 'course-home'), 'Course home', exp.homePage.sections.map((s) => HOME[s](ctx)).join('\n'), true, true);
  }
  return out;
}
