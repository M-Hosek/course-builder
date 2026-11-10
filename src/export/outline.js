import { weekLabel, toCanvasTime } from '../dates.js';
import { classLine, noClassLine, weekLine } from '../lines.js';

export const ANNOTATION_NOTE = 'Attach your document in Canvas before students see this.';
const PAGE_BODY = {
  Welcome: '<p>[Write your welcome message here.]</p>',
  // Canvas turns this placeholder into a real link when it imports the file.
  Syllabus: '<p><a href="$CANVAS_COURSE_REFERENCE$/assignments/syllabus">Read the course syllabus</a></p>',
};
const HOME_SECTIONS = ['welcome', 'syllabus', 'communication', 'startHere'];

/** The text of the module header a class row becomes; '' means no header. */
function headerText(row) {
  if (row.date) return row.noClass ? noClassLine({ date: row.date, reason: row.noClass.reason }) : classLine(row);
  if (row.noClass) return `No class this week${row.noClass.reason?.trim() ? ` · ${row.noClass.reason.trim()}` : ''}`;
  return weekLine(row);
}

/**
 * Turn the course into a plain description of what Canvas will receive: groups, modules, and items,
 * with every rule from the design applied (who is published, what quizzes carry, extra credit, notes).
 * The file writer does no deciding of its own.
 *
 * @param {import('../model.js').Course} course
 * @returns {{title: string, weighted: boolean, groups: Array, modules: Array, homePage: null | {sections: string[]}}}
 */
export function toExport(course) {
  const weighted = course.grading === 'weighted';
  const groups = course.groups.map((g) => ({ key: g.id, name: g.name, weight: weighted ? Number(g.weight) || 0 : 0, dropLowest: Number(g.dropLowest) || 0 }));
  const groupKeys = new Set(groups.map((g) => g.key));

  const toItem = (row, published) => {
    if (row.kind === 'class') {
      const title = headerText(row);
      return title ? { key: row.id, kind: 'header', title, published } : null;
    }
    const item = { key: row.id, kind: row.kind, title: row.title, published };
    if (row.kind === 'page') return { ...item, body: PAGE_BODY[row.title] ?? '' };
    if (row.groupId && groupKeys.has(row.groupId)) item.groupKey = row.groupId;
    if (row.due) item.dueAt = toCanvasTime(row.due, course.dueTime);
    if (row.kind === 'assignment') {
      item.points = Number(row.points) || 0;
      item.submissionTypes = [...(row.submissionTypes ?? [])];
      if (item.submissionTypes.includes('student_annotation')) item.body = `<p><strong>${ANNOTATION_NOTE}</strong></p>`;
    }
    // Quizzes never carry points: Canvas takes a quiz's points from its questions.
    if (row.kind === 'discussion' && row.points != null && row.points !== '') item.points = Number(row.points) || 0;
    return item;
  };

  const modules = [
    { key: 'start-here', name: 'Start Here', published: true, items: course.startHere.map((r) => toItem(r, true)).filter(Boolean) },
    ...course.weekRows.map((rows, i) => ({
      key: `week-${i + 1}`, name: weekLabel(course.firstDay, i + 1), published: false,
      items: rows.map((r) => toItem(r, false)).filter(Boolean),
    })),
  ];
  const weekModule = (n) => modules[Math.min(Math.max(n, 1), course.weekRows.length)];

  const ec = course.extraCredit ?? { mode: 'none' };
  if (ec.mode === 'separate') {
    // A group whose weight sits on top of 100%.
    groups.push({ key: 'extra-credit', name: 'Extra credit', weight: weighted ? Number(ec.percent) || 0 : 0, dropLowest: 0 });
    weekModule(ec.week).items.push({ key: 'extra-credit-item', kind: 'assignment', title: ec.name?.trim() || 'Extra credit',
      published: false, points: 10, groupKey: 'extra-credit', submissionTypes: ['online_upload'] });
  } else if (ec.mode === 'bonus' && groupKeys.has(ec.groupId)) {
    // Worth 0 points possible, so points earned raise the group score without raising what is required.
    const holders = modules.slice(1).filter((m) => m.items.some((i) => i.groupKey === ec.groupId));
    const target = holders.at(-1) ?? modules.at(-1);
    target.items.push({ key: 'bonus-item', kind: 'assignment', title: ec.name?.trim() || 'Bonus points',
      published: target.published, points: 0, groupKey: ec.groupId, submissionTypes: ['online_upload'] });
  }

  const sections = HOME_SECTIONS.filter((s) => course.homePage?.[s]);
  return { title: course.title, weighted, groups, modules, homePage: sections.length ? { sections } : null };
}
