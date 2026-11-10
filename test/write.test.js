import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCartridge, fileNameFor } from '../src/export/index.js';
import { parseXml } from '../src/xmlparse.js';
import { esc } from '../src/xml.js';
import { sampleCourse, TRICKY } from './sample.js';
import { unzip, paths, text, xml, child, els, findByTitle } from './helpers.js';

const build = async (change) => unzip(await buildCartridge(sampleCourse(change)));
const modules = async (zip) => els(await xml(zip, 'course_settings/module_meta.xml'), 'module');
const groups = async (zip) => els(await xml(zip, 'course_settings/assignment_groups.xml'), 'assignmentGroup');
const moduleItem = (mod, title) => els(mod, 'item').find((i) => child(i, 'title') === title);
const allParse = async (zip) => {
  for (const p of paths(zip).filter((x) => x.endsWith('.xml') || x.endsWith('.qti'))) {
    try { parseXml(await text(zip, p)); } catch (e) { assert.fail(`${p} is not valid XML: ${e.message}`); }
  }
};

test('the XML checker rejects malformed XML', () => {
  assert.throws(() => parseXml('<a>Q&A</a>'));
  assert.throws(() => parseXml('<a><b></a>'));
  assert.equal(esc(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&apos;f');
});
test('every file is valid, listed, and reachable', async () => {
  const zip = await build();
  await allParse(zip);
  const all = new Set(paths(zip));
  const m = await xml(zip, 'imsmanifest.xml');
  const hrefs = [...els(m, 'resource'), ...els(m, 'file')].map((e) => e.getAttribute('href')).filter(Boolean);
  assert.ok(hrefs.length > 10);
  for (const h of hrefs) assert.ok(all.has(h), `manifest lists a missing file: ${h}`);
  const ids = new Set(els(m, 'resource').map((r) => r.getAttribute('identifier')));
  const refs = els(await xml(zip, 'course_settings/module_meta.xml'), 'identifierref').map((e) => e.textContent);
  assert.ok(refs.length >= 7);
  for (const r of refs) assert.ok(ids.has(r), `a module item points at a missing resource: ${r}`);
  assert.ok(all.has('course_settings/canvas_export.txt'));
});
test('groups carry weights and drop-lowest rules', async () => {
  const zip = await build();
  const gs = await groups(zip);
  assert.deepEqual(gs.map((g) => [child(g, 'title'), Number(child(g, 'group_weight'))]),
    [['Discussions', 25], ['Weekly work', 30], ['Exams', 35], ['Participation', 10]]);
  assert.deepEqual(gs.map((g) => els(g, 'drop_count').map((e) => e.textContent)), [['1'], ['2'], [], []]);
  assert.equal(child(els(gs[0], 'rule')[0], 'drop_type'), 'drop_lowest');
  const s = await xml(zip, 'course_settings/course_settings.xml');
  assert.equal(child(s.documentElement, 'group_weighting_scheme'), 'percent');
  assert.equal(child(s.documentElement, 'title'), 'PSY 210 Online · Spring 2027');
});
test('Other grading does not turn on weighting', async () => {
  const zip = await build({ grading: 'other' });
  const s = await xml(zip, 'course_settings/course_settings.xml');
  assert.notEqual(child(s.documentElement, 'group_weighting_scheme'), 'percent');
  for (const g of await groups(zip)) assert.equal(Number(child(g, 'group_weight')), 0);
});
test('an assignment has its due time, points, submission types and group', async () => {
  const zip = await build();
  const a = await findByTitle(zip, 'assignment_settings.xml', 'Reading response 1');
  assert.equal(child(a.root, 'due_at'), '2027-01-30T04:59:00');
  assert.equal(Number(child(a.root, 'points_possible')), 10);
  assert.equal(child(a.root, 'submission_types'), 'online_upload,online_text_entry');
  const weekly = (await groups(zip)).find((g) => child(g, 'title') === 'Weekly work');
  assert.equal(child(a.root, 'assignment_group_identifierref'), weekly.getAttribute('identifier'));
  const undated = await findByTitle(zip, 'assignment_settings.xml', 'Undated');
  assert.equal(els(undated.doc, 'due_at').length, 0);
  assert.equal(child(undated.root, 'submission_types'), 'none');
});
test('a due date after the spring clock change is still 11:59 pm Eastern', async () => {
  const a = await findByTitle(await build(), 'assignment_settings.xml', 'Annotate the article');
  assert.equal(child(a.root, 'due_at'), '2027-03-20T03:59:00');
});
test('text with &, <, quotes and accents comes through unchanged everywhere', async () => {
  const c = sampleCourse();
  c.title = TRICKY;
  c.groups[1].name = TRICKY;
  c.weekRows[0][0].theme = TRICKY;
  c.weekRows[0][0].readings = [TRICKY];
  c.weekRows[0][1].title = TRICKY;
  c.weekRows[0][2].title = `${TRICKY} talk`;
  c.weekRows[6][0].title = `${TRICKY} exam`;
  c.startHere[0].title = `${TRICKY} page`;
  const zip = await unzip(await buildCartridge(c));
  await allParse(zip);
  assert.ok(await findByTitle(zip, 'assignment_settings.xml', TRICKY));
  assert.ok(await findByTitle(zip, '.xml', `${TRICKY} talk`));
  assert.ok(await findByTitle(zip, 'assessment_meta.xml', `${TRICKY} exam`));
  assert.ok((await groups(zip)).some((g) => child(g, 'title') === TRICKY));
  const w1 = (await modules(zip))[1];
  assert.equal(child(els(w1, 'item')[0], 'title'), `Tue Jan 26 — ${TRICKY} · Readings: ${TRICKY}`);
  assert.ok(moduleItem((await modules(zip))[0], `${TRICKY} page`));
});
test('Start Here and its items arrive published; weeks and their items do not', async () => {
  const zip = await build();
  const mods = await modules(zip);
  assert.deepEqual(mods.slice(0, 2).map((m) => [child(m, 'title'), child(m, 'workflow_state')]),
    [['Start Here', 'active'], ['Week 1 · Jan 25 – 31', 'unpublished']]);
  assert.ok(els(mods[0], 'item').every((i) => child(i, 'workflow_state') === 'active'));
  assert.ok(els(mods[1], 'item').every((i) => child(i, 'workflow_state') === 'unpublished'));
  const a = await findByTitle(zip, 'assignment_settings.xml', 'Reading response 1');
  assert.equal(child(a.root, 'workflow_state'), 'unpublished');
  const d = await findByTitle(zip, '.xml', 'Week 1 discussion');
  assert.equal(d.root.nodeName, 'topicMeta');
  assert.equal(child(d.root, 'workflow_state'), 'unpublished');
  const intro = await findByTitle(zip, '.xml', 'Introduce yourself');
  assert.equal(child(intro.root, 'workflow_state'), 'active');
  const q = await findByTitle(zip, 'assessment_meta.xml', 'Midterm exam');
  assert.equal(child(q.root, 'available'), 'false');
  const welcome = await text(zip, 'wiki_content/welcome.html');
  assert.match(welcome, /<meta name="workflow_state" content="active"\/>/);
});
test('a quiz is a Classic Quiz with no points and no questions', async () => {
  const zip = await build();
  const q = await findByTitle(zip, 'assessment_meta.xml', 'Midterm exam');
  const id = q.root.getAttribute('identifier');
  assert.equal(child(q.root, 'quiz_type'), 'assignment');
  assert.equal(child(q.root, 'points_possible'), '0.0');
  assert.equal(child(q.root, 'due_at'), '2027-03-13T04:59:00');
  assert.equal(els(await xml(zip, `${id}/assessment_qti.xml`), 'item').length, 0);
  assert.equal(els(await xml(zip, `non_cc_assessments/${id}.xml.qti`), 'item').length, 0);
  const nested = els(q.root, 'assignment')[0];
  assert.equal(child(nested, 'quiz_identifierref'), id);
  const exams = (await groups(zip)).find((g) => child(g, 'title') === 'Exams');
  assert.equal(child(nested, 'assignment_group_identifierref'), exams.getAttribute('identifier'));
  const res = els(await xml(zip, 'imsmanifest.xml'), 'resource').find((r) => r.getAttribute('identifier') === id);
  assert.equal(res.getAttribute('type'), 'imsqti_xmlv1p2/imscc_xmlv1p1/assessment');
});
test('a graded discussion carries points, group and due time; an ungraded one carries none', async () => {
  const zip = await build();
  const d = await findByTitle(zip, '.xml', 'Week 1 discussion');
  const a = els(d.root, 'assignment')[0];
  assert.equal(Number(child(a, 'points_possible')), 10);
  assert.equal(child(a, 'due_at'), '2027-01-30T04:59:00');
  assert.equal(child(a, 'submission_types'), 'discussion_topic');
  const res = els(await xml(zip, 'imsmanifest.xml'), 'resource').find((r) => r.getAttribute('identifier') === child(d.root, 'topic_id'));
  assert.equal(res.getAttribute('type'), 'imsdt_xmlv1p1');
  const intro = await findByTitle(zip, '.xml', 'Introduce yourself');
  assert.equal(els(intro.root, 'assignment').length, 0);
});
test('pages are files under wiki_content that their module items point at', async () => {
  const zip = await build();
  const start = (await modules(zip))[0];
  const it = moduleItem(start, 'Syllabus');
  assert.equal(child(it, 'content_type'), 'WikiPage');
  const html = await text(zip, 'wiki_content/syllabus.html');
  assert.ok(html.includes(`<meta name="identifier" content="${child(it, 'identifierref')}"/>`));
  assert.match(html, /<a href="\$CANVAS_COURSE_REFERENCE\$\/assignments\/syllabus">Read the course syllabus<\/a>/);
  assert.doesNotMatch(html, /front_page/);
});
test('two pages with the same name get different files', async () => {
  const c = sampleCourse();
  c.startHere.push({ id: 'p2', kind: 'page', title: 'Welcome' });
  const zip = await unzip(await buildCartridge(c));
  assert.equal(paths(zip).filter((p) => /^wiki_content\/welcome/.test(p)).length, 2);
});
test('the annotation note is inside the assignment', async () => {
  const zip = await build();
  const a = await findByTitle(zip, 'assignment_settings.xml', 'Annotate the article');
  const html = await text(zip, a.path.replace('assignment_settings.xml', 'annotate-the-article.html'));
  assert.ok(html.includes('Attach your document in Canvas before students see this.'));
  assert.equal(child(a.root, 'submission_types'), 'student_annotation');
});
test('the home page is the front page, with only the chosen sections', async () => {
  const zip = await build({ homePage: { welcome: true, syllabus: false, communication: true, startHere: true } });
  const home = paths(zip).find((p) => p.startsWith('wiki_content/') && p.includes('home'));
  const html = await text(zip, home);
  assert.match(html, /<meta name="front_page" content="true"\/>/);
  assert.match(html, /<meta name="workflow_state" content="active"\/>/);
  assert.deepEqual([...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]), ['Welcome', 'Communication preferences', 'Start Here']);
  const startId = (await modules(zip))[0].getAttribute('identifier');
  assert.ok(html.includes(`$CANVAS_OBJECT_REFERENCE$/modules/${startId}"`));
  const s = await xml(zip, 'course_settings/course_settings.xml');
  assert.equal(child(s.documentElement, 'default_view'), 'wiki');
});
test('no home page when every section is off', async () => {
  const zip = await build({ homePage: { welcome: false, syllabus: false, communication: false, startHere: false } });
  assert.ok(!paths(zip).some((p) => p.startsWith('wiki_content/') && p.includes('home')));
  const s = await xml(zip, 'course_settings/course_settings.xml');
  assert.equal(child(s.documentElement, 'default_view'), 'modules');
});
test('download file names', () => {
  assert.equal(fileNameFor('PSY 210 Online · Spring 2027'), 'psy-210-online-spring-2027.imscc');
  assert.equal(fileNameFor(''), 'course.imscc');
  assert.equal(fileNameFor('   '), 'course.imscc');
});
