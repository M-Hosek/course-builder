import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { parseXml } from '../src/xmlparse.js';

export const fixture = (name) => readFile(new URL(`../fixtures/${name}`, import.meta.url)).then((b) => new Uint8Array(b));
export const unzip = (bytes) => JSZip.loadAsync(bytes);
export const paths = (zip) => Object.keys(zip.files).filter((p) => !zip.files[p].dir);
export const text = (zip, path) => zip.file(path).async('string');
export const xml = async (zip, path) => parseXml(await text(zip, path));
/** Text of the first <name> element that is a direct child of el. */
export const child = (el, name) => {
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && n.nodeName === name) return n.textContent;
  return undefined;
};
export const els = (doc, name) => Array.from(doc.getElementsByTagName(name));
/** Parsed XML files ending in `suffix` whose root (or nested <assignment>) has this title. */
export async function findByTitle(zip, suffix, title) {
  for (const p of paths(zip).filter((x) => x.endsWith(suffix))) {
    const doc = await xml(zip, p);
    if (child(doc.documentElement, 'title') === title) return { path: p, doc, root: doc.documentElement };
  }
  return undefined;
}
