// Writes the ONE file to import into a Canvas sandbox, and its checklist.
// It exercises everything the tool does that has not yet been proven by a real import.
// Usage: node scripts/make-import-check.js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fromTemplate } from '../src/templates.js';
import * as edit from '../src/edit.js';
import { SUBMISSION_TYPES } from '../src/model.js';
import { buildCartridge } from '../src/export/index.js';

export function importCheckCourse() {
  let c = fromTemplate('weekly', { title: 'Course Builder import check', firstDay: '2027-01-25', weeks: 14, dueWeekday: 5 });
  c = edit.setMeets(edit.setFormat(c, 'hybrid'), [2, 4]);
  const tuesday = c.weekRows[0].find((r) => r.kind === 'class' && r.date === '2027-01-26');
  c = edit.updateRow(c, tuesday.id, { theme: 'What is psychology?', readings: ['Myers Ch. 1', 'Milgram (1963)'] });
  c = edit.setNoClass(c, 8, ['2027-03-18'], 'Spring break');
  c = edit.updateGroup(c, c.groups.find((g) => g.name === 'Discussions').id, { dropLowest: 1 });
  const rr1 = c.weekRows[0].find((r) => r.title === 'Reading response 1');
  c = edit.updateRow(c, rr1.id, { submissionTypes: [...SUBMISSION_TYPES] });
  return edit.setExtraCredit(c, { mode: 'separate', name: 'Extra credit: museum visit', percent: 3, week: 10 });
}

export const CHECKLIST = [
  'The import finished with no errors or warnings listed. (If it listed any, copy them into Results.)',
  'Modules: **Start Here is published** and holds Welcome, Syllabus, and Introduce yourself, all published.',
  'Welcome and Syllabus open as pages. The link on the Syllabus page opens the course Syllabus.',
  'Every week module, and everything inside it, is **unpublished**.',
  'Home shows the front page with four headings (Welcome, Syllabus, Communication preferences, Start Here), and both links on it work.',
  'Quizzes: Midterm exam and Final exam are Classic Quizzes with 0 points and no questions, and there is exactly one of each.',
  'Reading response 1 shows the note "Attach your document in Canvas before students see this." and, under Edit, offers file upload, text entry, annotation, and media recording.',
  'Assignments page: Discussions 25% (drop lowest 1), Weekly work 30%, Exams 35%, Participation 10%, Extra credit 3%.',
  'Week 1 starts with the header "Tue Jan 26 — What is psychology? · Readings: Myers Ch. 1; Milgram (1963)", and Week 8 has "Thu Mar 18 — No class · Spring break".',
  'Reading response 8 is due Fri Mar 19 at 11:59 pm.',
  'Optional, in Student View: give the test student full marks on everything, including "Extra credit: museum visit". Does the total go above 100%?',
];

async function main() {
  const root = new URL('../', import.meta.url);
  await mkdir(new URL('rounds/', root), { recursive: true });
  await writeFile(new URL('rounds/import-check.imscc', root), await buildCartridge(importCheckCourse()));

  const mdUrl = new URL('rounds/import-check.md', root);
  // Keep whatever results were already recorded.
  let results = '## Results\n\n_(nothing recorded yet)_\n';
  if (existsSync(mdUrl)) {
    const old = await readFile(mdUrl, 'utf8');
    const at = old.indexOf('## Results');
    if (at >= 0) results = old.slice(at);
  }
  await writeFile(mdUrl, `# Import check

One file, one import. It covers what the finished tool does that has not yet been tried in Canvas:
unpublished weeks, a published Start Here module and home page, pages inside a module, quizzes with
no points, and the annotation note.

## How to import
1. Use a **new, empty** sandbox course (or empty one with *Settings → Reset Course Content*). Import it **once**.
2. *Settings → Import Course Content → Common Cartridge 1.x Package*, choose \`rounds/import-check.imscc\`, pick *All content*, and click *Import*.
3. Wait for the job to say Completed, then go through the list.

## What to check
${CHECKLIST.map((line) => `- [ ] ${line}`).join('\n')}

${results}`);
  console.log('wrote rounds/import-check.imscc and rounds/import-check.md');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
