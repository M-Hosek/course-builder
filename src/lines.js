import { dayLabel } from './dates.js';

const readingsPart = (readings = []) => {
  const list = readings.map((r) => r.trim()).filter(Boolean);
  return list.length ? `Readings: ${list.join('; ')}` : '';
};

/** 'Tue Jan 26 — What is psychology? · Readings: Myers Ch. 1; Milgram (1963)' */
export function classLine({ date, theme, readings }) {
  const r = readingsPart(readings);
  return `${dayLabel(date)} — ${theme?.trim() || 'Class meeting'}${r ? ` · ${r}` : ''}`;
}

/** 'Thu Nov 25 — No class · Thanksgiving break' */
export function noClassLine({ date, reason }) {
  return `${dayLabel(date)} — No class${reason?.trim() ? ` · ${reason.trim()}` : ''}`;
}

/** A fully asynchronous week's line: 'Memory · Readings: Myers Ch. 8'. Empty when there is nothing to say. */
export function weekLine({ theme, readings }) {
  return [theme?.trim(), readingsPart(readings)].filter(Boolean).join(' · ');
}
