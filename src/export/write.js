import { JSZip } from '../zip.js';
import { makeIds } from '../ids.js';
import { LAR } from '../xml.js';
import { manifestXml } from './parts/manifest.js';
import * as settings from './parts/settings.js';
import * as modules from './parts/modules.js';
import * as pages from './parts/pages.js';
import * as assignments from './parts/assignments.js';
import * as discussions from './parts/discussions.js';
import * as quizzes from './parts/quizzes.js';

const PARTS = [settings, modules, pages, assignments, discussions, quizzes];

function makeCtx(exp) {
  const ids = makeIds();
  let position = 0;
  return {
    ids,
    courseId: ids.id('course', exp.title),
    groupId: (key) => ids.id('group', key),
    moduleId: (key) => ids.id('module', key),
    itemId: (item) => ids.id(item.kind, item.key),
    nextPosition: () => ++position,
    org: [],
  };
}

/**
 * Write the file Canvas imports. Identifiers are stable for the same course, so nothing here is random.
 * @param exp the result of toExport(course)
 * @returns {Promise<Uint8Array>}
 */
export async function writeCartridge(exp) {
  const ctx = makeCtx(exp);
  const entries = PARTS.flatMap((p) => p.files(exp, ctx));
  const settingsFiles = entries.map((e) => e.path).filter((p) => p.startsWith('course_settings/') && !p.endsWith('syllabus.html'));
  const resources = [
    { identifier: ctx.courseId, type: LAR, href: 'course_settings/canvas_export.txt', files: settingsFiles },
    ...entries.filter((e) => e.resource).map((e) => e.resource),
  ];
  const zip = new JSZip();
  zip.file('imsmanifest.xml', manifestXml(exp, ctx, resources, ctx.org));
  for (const e of entries) zip.file(e.path, e.content);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
