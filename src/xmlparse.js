// Browser: native DOMParser (strict). Node (tests, scripts): xmldom builds the DOM, but it
// quietly accepts malformed XML such as a bare '&', so saxes checks well-formedness first.
const native = typeof globalThis.DOMParser === 'function';
const Parser = native ? globalThis.DOMParser : (await import('@xmldom/xmldom')).DOMParser;
const Strict = native ? null : (await import('saxes')).SaxesParser;

/** Parse XML text. Throws on malformed XML. */
export function parseXml(s) {
  if (native) {
    const doc = new Parser().parseFromString(s, 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error(err.textContent);
    return doc;
  }
  const check = new Strict();
  check.on('error', (e) => { throw e; });
  check.write(s).close();
  return new Parser().parseFromString(s, 'application/xml');
}
