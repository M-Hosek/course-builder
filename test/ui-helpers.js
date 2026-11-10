// Sets up a browser-like page for the screen tests. Import this file before any src/ui module is used.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const name of ['HTMLElement', 'Event', 'KeyboardEvent', 'File', 'FileReader', 'Blob', 'Node']) globalThis[name] = dom.window[name];

export const window = dom.window;

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
}
export const brokenStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('blocked'); } };

/** A fresh, attached element to mount the app into. */
export function freshRoot() {
  document.body.replaceChildren();
  const root = document.createElement('div');
  document.body.append(root);
  return root;
}

const clean = (s) => s.replace(/\s+/g, ' ').trim();
export const textOf = (el) => clean(el.textContent);

/** The first element matching selector whose text is exactly (string) or matches (RegExp) `text`. */
export function byText(root, selector, text) {
  return [...root.querySelectorAll(selector)].find((el) => (text instanceof RegExp ? text.test(textOf(el)) : textOf(el) === text));
}
/** The control a visible <label> with this exact text points at. */
export function control(root, labelText) {
  const label = byText(root, 'label', labelText);
  return label ? document.getElementById(label.htmlFor) : undefined;
}
export function click(el) {
  if (!el) throw new Error('click: element not found');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}
/** Type or pick a value and commit it, the way leaving a field does. */
export function change(el, value) {
  if (!el) throw new Error('change: element not found');
  if (el.type === 'checkbox' || el.type === 'radio') el.checked = value;
  else el.value = value;
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}
export const tick = () => new Promise((r) => setTimeout(r, 0));

/** The accessible name of a control: its <label for>, aria-label, aria-labelledby, or own text. */
export function nameOf(el) {
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  const by = el.getAttribute('aria-labelledby');
  if (by) return by.split(' ').map((id) => textOf(document.getElementById(id) ?? { textContent: '' })).join(' ');
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return textOf(label);
  }
  const wrapping = el.closest('label');
  if (wrapping) return textOf(wrapping);
  return el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SUMMARY' ? textOf(el) : '';
}
/** Every control inside root that has no accessible name. Should be empty. */
export function unnamedControls(root) {
  return [...root.querySelectorAll('input, select, textarea, button, a[href]')].filter((el) => !nameOf(el)).map((el) => el.outerHTML.slice(0, 120));
}

/** Wait (up to half a second) until check() is truthy; for things that finish a moment later, like reading a file. */
export async function until(check) {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  return check();
}
