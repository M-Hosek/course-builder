const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
/** XML-escape text for element content or attribute values. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => MAP[c]);
/** <name>escaped text</name> */
export const tag = (name, value) => `<${name}>${esc(value)}</${name}>`;
/** Canvas writes whole numbers as 10.0 */
export const num = (n) => (Number.isInteger(Number(n)) ? `${Number(n)}.0` : String(Number(n)));
export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';
/** Namespace attributes Canvas puts on its own extension files. */
export const CANVAS_NS = 'xmlns="http://canvas.instructure.com/xsd/cccv1p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd"';
export const LAR = 'associatedcontent/imscc_xmlv1p1/learning-application-resource';
/** Lowercase, dash-separated file name stem. */
export const slug = (s) => String(s).normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
export const htmlPage = (title, body = '', metas = '') => `<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>${esc(title)}</title>
${metas}</head>
<body>
${body}
</body>
</html>`;
