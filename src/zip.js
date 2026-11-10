// Browser: JSZip global from the CDN script tag. Node: the npm package.
export const JSZip = globalThis.JSZip ?? (await import('jszip')).default;
