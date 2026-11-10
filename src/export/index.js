import { slug } from '../xml.js';
import { toExport } from './outline.js';
import { writeCartridge } from './write.js';

export { toExport, writeCartridge };

/** Course → the bytes of the file Canvas imports. */
export const buildCartridge = (course) => writeCartridge(toExport(course));

/** 'PSY 210 Online' → 'psy-210-online.imscc' */
export function fileNameFor(title) {
  const stem = slug(String(title ?? '').trim() || 'course');
  return `${stem === 'item' ? 'course' : stem}.imscc`;
}
