function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const SEEDS = [2166136261, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];

/** Stable Canvas-style identifiers: 'g' + 32 hex characters, the same for the same (prefix, key). */
export function makeIds() {
  return { id: (prefix, key) => 'g' + SEEDS.map((s) => fnv(`${prefix}:${key}`, s)).join('') };
}
